/**
 * ============================================================================
 * CABANA TEKOHA — Worker de Reservas (Asaas)
 * ----------------------------------------------------------------------------
 * O que este arquivo faz:
 *   1) POST /reservar        -> cria (ou acha) o cliente no Asaas e gera a
 *                               cobrança. Antes, confere se a data está livre
 *                               (Airbnb + reservas pagas). Devolve a invoiceUrl
 *                               (página do Asaas com Pix, boleto e cartão).
 *   2) POST /webhook         -> o Asaas chama aqui quando a cobrança é paga.
 *                               Se confirmado, grava a reserva e bloqueia a data.
 *   3) GET  /disponibilidade -> o site usa isto pra montar o calendário.
 *   4) GET  /calendario.ics  -> iCal das SUAS reservas diretas pra COLAR no Airbnb.
 *
 * Onde roda: Cloudflare Workers (de graça pro seu volume).
 * Segredos (nas Variables/Secrets do Worker, NUNCA no site):
 *   - ASAAS_API_KEY     -> sua chave de API do Asaas
 *   - ASAAS_WEBHOOK_TOKEN -> um token que VOCÊ inventa e configura no painel do
 *                            Asaas, pra garantir que o webhook é mesmo dele.
 * Reservas: num KV Namespace chamado RESERVAS.
 * ============================================================================
 */

// -------- AJUSTE AQUI (coisas da Cabana, não são segredo) --------------------
const CONFIG = {
  // sandbox (testes) ou produção. Comece em sandbox!
  //   sandbox:  https://api-sandbox.asaas.com/v3
  //   produção: https://api.asaas.com/v3
  ASAAS_BASE: "https://api-sandbox.asaas.com/v3",

  AIRBNB_ICAL_URL: "https://www.airbnb.com.br/calendar/ical/SEU_LINK.ics",

  // Pra onde o hóspede volta depois de pagar
  REDIRECT_OK: "https://www.cabanatekoha.com.br/reserva-confirmada.html",

  ORIGENS_PERMITIDAS: [
    "https://www.cabanatekoha.com.br",
    "https://cabanatekoha.com.br",
  ],

  NOME_UNIDADE: "Cabana Tekoha",

  // Quantos dias o hóspede tem pra pagar (vencimento da cobrança).
  // Pra reserva, curto é melhor: 1 dia segura a data sem prender por muito tempo.
  DIAS_PARA_VENCIMENTO: 1,
};
// -----------------------------------------------------------------------------


export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return semConteudo(corsHeaders(origin));
    }

    try {
      if (url.pathname === "/reservar" && request.method === "POST") {
        return await criarReserva(request, env, origin);
      }
      if (url.pathname === "/webhook" && request.method === "POST") {
        return await receberWebhook(request, env);
      }
      if (url.pathname === "/disponibilidade" && request.method === "GET") {
        return await listarDisponibilidade(env, origin);
      }
      if (url.pathname === "/calendario.ics" && request.method === "GET") {
        return await gerarICal(env);
      }
      // Preços: cotação pública (o site usa pra mostrar o total ao hóspede)
      if (url.pathname === "/cotar" && request.method === "POST") {
        return await cotar(request, env, origin);
      }
      // Admin de tarifas (protegido por senha): ler e salvar
      if (url.pathname === "/admin/precos" && request.method === "GET") {
        return await adminLerPrecos(request, env, origin);
      }
      if (url.pathname === "/admin/precos" && request.method === "POST") {
        return await adminSalvarPrecos(request, env, origin);
      }
      return json({ erro: "rota_nao_encontrada" }, 404, corsHeaders(origin));
    } catch (e) {
      console.error("ERRO:", e && e.stack ? e.stack : e);
      return json({ erro: "falha_interna" }, 500, corsHeaders(origin));
    }
  },
};


/* =========================================================================
 * 1) CRIAR RESERVA -> cria cliente + cobrança no Asaas
 * ========================================================================= */
async function criarReserva(request, env, origin) {
  const dados = await request.json().catch(() => null);
  if (!dados) return json({ erro: "json_invalido" }, 400, corsHeaders(origin));

  const erroVal = validarEntrada(dados);
  if (erroVal) return json({ erro: erroVal }, 400, corsHeaders(origin));

  const { checkin, checkout, hospedes, nome, telefone, email, cpfCnpj } = dados;

  // Anti-overbooking: confere Airbnb AGORA + reservas já pagas.
  const ocupadas = await datasOcupadas(env);
  if (haConflito(checkin, checkout, ocupadas)) {
    return json({ erro: "datas_indisponiveis" }, 409, corsHeaders(origin));
  }

  // PREÇO CALCULADO NO SERVIDOR (nunca confia no valor que veio do site).
  // Isso impede que alguém adultere o total no navegador pra pagar menos.
  const tarifas = await lerTarifas(env);
  const cotacao = calcularPreco(checkin, checkout, hospedes, tarifas);
  if (!cotacao.ok) {
    return json({ erro: cotacao.erro, detalhe: cotacao }, 400, corsHeaders(origin));
  }
  const valorReais = cotacao.total;

  const headersAsaas = {
    "Content-Type": "application/json",
    "access_token": env.ASAAS_API_KEY,
  };

  // ---- Passo 1: criar (ou reaproveitar) o cliente ----
  const cliente = await acharOuCriarCliente(env, headersAsaas, {
    nome, telefone, email, cpfCnpj,
  });
  if (!cliente || !cliente.id) {
    return json({ erro: "falha_criar_cliente" }, 502, corsHeaders(origin));
  }

  // Identificador da reserva no NOSSO sistema (casamos com o webhook via externalReference)
  const externalRef = crypto.randomUUID();

  // Guarda a reserva como pendente (expira em 26h se não pagar — folga sobre o vencimento de 1 dia)
  const reservaPendente = {
    status: "pendente",
    checkin, checkout, hospedes,
    nome, telefone, email,
    valorReais: Number(valorReais),
    asaasCustomerId: cliente.id,
    criadaEm: new Date().toISOString(),
  };
  await env.RESERVAS.put(`pendente:${externalRef}`, JSON.stringify(reservaPendente), {
    expirationTtl: 60 * 60 * 26,
  });

  // ---- Passo 2: criar a cobrança ----
  const respCobranca = await fetch(`${CONFIG.ASAAS_BASE}/payments`, {
    method: "POST",
    headers: headersAsaas,
    body: JSON.stringify({
      customer: cliente.id,
      billingType: "UNDEFINED",           // hóspede escolhe Pix, boleto ou cartão
      value: Number(valorReais),
      dueDate: dataVencimento(CONFIG.DIAS_PARA_VENCIMENTO),
      description: `${CONFIG.NOME_UNIDADE} — ${formatarBR(checkin)} a ${formatarBR(checkout)} (${hospedes} hóspede(s))`,
      externalReference: externalRef,
      callback: {
        successUrl: CONFIG.REDIRECT_OK,
        autoRedirect: true,
      },
    }),
  });

  if (!respCobranca.ok) {
    const txt = await respCobranca.text().catch(() => "");
    console.error("Asaas recusou a cobrança:", respCobranca.status, txt);
    return json({ erro: "gateway_indisponivel" }, 502, corsHeaders(origin));
  }

  const cobranca = await respCobranca.json();

  // Guarda o id da cobrança do Asaas junto da pendente (pra conferência no webhook)
  reservaPendente.asaasPaymentId = cobranca.id;
  await env.RESERVAS.put(`pendente:${externalRef}`, JSON.stringify(reservaPendente), {
    expirationTtl: 60 * 60 * 26,
  });

  // invoiceUrl = página do Asaas com todas as formas de pagamento
  return json({
    url: cobranca.invoiceUrl,
    pedido: externalRef,
  }, 200, corsHeaders(origin));
}


/* =========================================================================
 * 2) WEBHOOK -> Asaas avisa que a cobrança foi paga
 * ========================================================================= */
async function receberWebhook(request, env) {
  // Segurança: o Asaas manda um token no header que você configurou no painel.
  const tokenRecebido = request.headers.get("asaas-access-token");
  if (env.ASAAS_WEBHOOK_TOKEN && tokenRecebido !== env.ASAAS_WEBHOOK_TOKEN) {
    console.warn("Webhook com token inválido — ignorado.");
    return new Response("token_invalido", { status: 401 });
  }

  const evento = await request.json().catch(() => null);
  if (!evento || !evento.payment) return new Response("bad", { status: 400 });

  // Só nos interessam pagamentos confirmados/recebidos.
  const tipo = evento.event; // ex.: PAYMENT_RECEIVED, PAYMENT_CONFIRMED
  const pago = tipo === "PAYMENT_RECEIVED" || tipo === "PAYMENT_CONFIRMED";
  if (!pago) {
    // Responde 200 pra não ficar recebendo retentativa de evento que não usamos.
    return new Response("ignorado", { status: 200 });
  }

  const externalRef = evento.payment.externalReference;
  if (!externalRef) return new Response("sem_ref", { status: 200 });

  // Confere de forma independente na API do Asaas se está mesmo pago.
  const confirmado = await conferirCobranca(env, evento.payment.id);
  if (!confirmado) {
    // Devolve 400 -> Asaas re-tenta o webhook mais tarde.
    return new Response("ainda_nao_confirmado", { status: 400 });
  }

  const brutoPendente = await env.RESERVAS.get(`pendente:${externalRef}`);
  const reserva = brutoPendente
    ? JSON.parse(brutoPendente)
    : reservaDoEvento(evento.payment);

  // Última checagem anti-overbooking antes de confirmar de vez.
  const ocupadas = await datasOcupadas(env, externalRef);
  if (reserva.checkin && haConflito(reserva.checkin, reserva.checkout, ocupadas)) {
    reserva.status = "conflito_pos_pagamento";
    await env.RESERVAS.put(`reserva:${externalRef}`, JSON.stringify(reserva));
    console.error("CONFLITO PÓS-PAGAMENTO — estornar:", externalRef, reserva);
    return new Response("ok", { status: 200 });
  }

  reserva.status = "confirmada";
  reserva.pagoEm = new Date().toISOString();
  reserva.valorPagoReais = evento.payment.value;
  reserva.formaPagamento = evento.payment.billingType || "desconhecida";
  reserva.asaasPaymentId = evento.payment.id;

  await env.RESERVAS.put(`reserva:${externalRef}`, JSON.stringify(reserva));
  await env.RESERVAS.delete(`pendente:${externalRef}`);

  // (Etapa 5) aqui depois entra o aviso pra você: WhatsApp/e-mail.
  // await avisarTotali(reserva);

  return new Response("ok", { status: 200 });
}


/* =========================================================================
 * 3) DISPONIBILIDADE
 * ========================================================================= */
async function listarDisponibilidade(env, origin) {
  const ocupadas = await datasOcupadas(env);
  return json({ ocupadas: [...ocupadas].sort() }, 200, corsHeaders(origin));
}


/* =========================================================================
 * 4) GERAR iCAL (pra colar no Airbnb)
 * ========================================================================= */
async function gerarICal(env) {
  const lista = await env.RESERVAS.list({ prefix: "reserva:" });
  let linhas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Cabana Tekoha//Reservas Diretas//PT",
    "CALSCALE:GREGORIAN",
  ];

  for (const chave of lista.keys) {
    const bruto = await env.RESERVAS.get(chave.name);
    if (!bruto) continue;
    const r = JSON.parse(bruto);
    if (r.status !== "confirmada") continue;

    const uid = chave.name.replace("reserva:", "");
    linhas.push(
      "BEGIN:VEVENT",
      `UID:${uid}@cabanatekoha.com.br`,
      `DTSTAMP:${icalData(r.pagoEm || r.criadaEm)}`,
      `DTSTART;VALUE=DATE:${soData(r.checkin)}`,
      `DTEND;VALUE=DATE:${soData(r.checkout)}`,
      "SUMMARY:Reserva direta (site)",
      "END:VEVENT",
    );
  }

  linhas.push("END:VCALENDAR");
  return new Response(linhas.join("\r\n"), {
    headers: { "Content-Type": "text/calendar; charset=utf-8" },
  });
}


/* =========================================================================
 * FUNÇÕES DE APOIO — ASAAS
 * ========================================================================= */

// Acha um cliente pelo e-mail (ou cria um novo).
async function acharOuCriarCliente(env, headers, { nome, telefone, email, cpfCnpj }) {
  // Tenta achar por e-mail pra não duplicar cliente a cada reserva.
  if (email) {
    const busca = await fetch(
      `${CONFIG.ASAAS_BASE}/customers?email=${encodeURIComponent(email)}`,
      { headers },
    );
    if (busca.ok) {
      const res = await busca.json();
      if (res.data && res.data.length > 0) return res.data[0];
    }
  }

  // Cria novo cliente.
  const corpo = {
    name: nome,
    mobilePhone: soNumeros(telefone),
  };
  if (email) corpo.email = email;
  if (cpfCnpj) corpo.cpfCnpj = soNumeros(cpfCnpj);

  const resp = await fetch(`${CONFIG.ASAAS_BASE}/customers`, {
    method: "POST",
    headers,
    body: JSON.stringify(corpo),
  });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    console.error("Asaas falha criar cliente:", resp.status, txt);
    return null;
  }
  return await resp.json();
}

// Confere na API do Asaas se a cobrança está realmente paga.
async function conferirCobranca(env, paymentId) {
  try {
    const resp = await fetch(`${CONFIG.ASAAS_BASE}/payments/${paymentId}`, {
      headers: { "access_token": env.ASAAS_API_KEY },
    });
    if (!resp.ok) return false;
    const p = await resp.json();
    return p.status === "RECEIVED" || p.status === "CONFIRMED";
  } catch (e) {
    console.error("Falha conferindo cobrança:", e);
    return false;
  }
}


/* =========================================================================
 * MOTOR DE PREÇOS + ADMIN DE TARIFAS
 * ========================================================================= */

const TARIFAS_PADRAO = {
  diariaBase: 300,
  diariaFimDeSemana: 400,
  diariaTemporadaAlta: 500,
  hospedeExtra: 100,
  pessoasInclusas: 2,
  capacidadeMaxima: 6,
  taxaLimpeza: 140,
  minNoitesSemana: 1,
  minNoitesFimDeSemana: 2,
  temporadaAlta: [
    { nome: "Fim de ano", inicio: "12-20", fim: "01-05" },
    { nome: "Julho", inicio: "07-01", fim: "07-31" },
  ],
};

// Lê as tarifas do KV (ou devolve o padrão se ainda não salvou nenhuma).
async function lerTarifas(env) {
  const bruto = await env.RESERVAS.get("config:tarifas");
  if (!bruto) return { ...TARIFAS_PADRAO };
  try {
    return { ...TARIFAS_PADRAO, ...JSON.parse(bruto) };
  } catch {
    return { ...TARIFAS_PADRAO };
  }
}

function ehFimDeSemanaPreco(iso) {
  const dia = new Date(iso + "T12:00:00Z").getUTCDay();
  return dia === 5 || dia === 6;
}
function ehTemporadaAltaPreco(iso, periodos) {
  const mmdd = iso.slice(5);
  for (const p of periodos || []) {
    if (!p.inicio || !p.fim) continue;
    if (p.inicio <= p.fim) { if (mmdd >= p.inicio && mmdd <= p.fim) return true; }
    else { if (mmdd >= p.inicio || mmdd <= p.fim) return true; }
  }
  return false;
}
function precoDaNoitePreco(iso, t) {
  if (ehTemporadaAltaPreco(iso, t.temporadaAlta)) return t.diariaTemporadaAlta;
  if (ehFimDeSemanaPreco(iso)) return t.diariaFimDeSemana;
  return t.diariaBase;
}

// Calcula o total. Retorna { ok, erro?, total, noites, resumo }.
function calcularPreco(checkin, checkout, hospedes, t) {
  if (checkout <= checkin) return { ok: false, erro: "checkout_antes_do_checkin" };
  const pessoas = Number(hospedes) || 1;
  if (pessoas < 1) return { ok: false, erro: "hospedes_invalido" };
  if (pessoas > t.capacidadeMaxima) {
    return { ok: false, erro: "acima_da_capacidade", capacidadeMaxima: t.capacidadeMaxima };
  }
  const detalhe = [];
  let d = new Date(checkin + "T00:00:00Z");
  const fim = new Date(checkout + "T00:00:00Z");
  let temFds = false;
  while (d < fim) {
    const iso = d.toISOString().slice(0, 10);
    const preco = precoDaNoitePreco(iso, t);
    if (ehFimDeSemanaPreco(iso)) temFds = true;
    detalhe.push({ data: iso, preco });
    d.setUTCDate(d.getUTCDate() + 1);
  }
  const noites = detalhe.length;
  const minEx = temFds ? t.minNoitesFimDeSemana : t.minNoitesSemana;
  if (noites < minEx) {
    return { ok: false, erro: "minimo_de_noites", minimoExigido: minEx, noitesSolicitadas: noites };
  }
  const subtotalDiarias = detalhe.reduce((s, n) => s + n.preco, 0);
  const extras = Math.max(0, pessoas - t.pessoasInclusas);
  const subtotalExtras = extras * t.hospedeExtra * noites;
  const total = subtotalDiarias + subtotalExtras + t.taxaLimpeza;
  return {
    ok: true, total, noites,
    resumo: { subtotalDiarias, hospedesExtras: extras, subtotalExtras, taxaLimpeza: t.taxaLimpeza, total },
  };
}

// POST /cotar -> o site pede o total (não cobra nada, só calcula)
async function cotar(request, env, origin) {
  const dados = await request.json().catch(() => null);
  if (!dados) return json({ erro: "json_invalido" }, 400, corsHeaders(origin));
  const t = await lerTarifas(env);
  const r = calcularPreco(dados.checkin, dados.checkout, dados.hospedes, t);
  const status = r.ok ? 200 : 400;
  return json(r, status, corsHeaders(origin));
}

// Confere a senha do admin (comparação de tempo constante).
function senhaConfere(recebida, correta) {
  if (!correta) return false;
  const a = String(recebida || "");
  const b = String(correta);
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

// GET /admin/precos -> devolve as tarifas (exige senha no header)
async function adminLerPrecos(request, env, origin) {
  if (!senhaConfere(request.headers.get("x-admin-senha"), env.ADMIN_SENHA)) {
    return json({ erro: "nao_autorizado" }, 401, corsHeaders(origin));
  }
  const t = await lerTarifas(env);
  return json(t, 200, corsHeaders(origin));
}

// POST /admin/precos -> salva as tarifas (exige senha no header)
async function adminSalvarPrecos(request, env, origin) {
  if (!senhaConfere(request.headers.get("x-admin-senha"), env.ADMIN_SENHA)) {
    return json({ erro: "nao_autorizado" }, 401, corsHeaders(origin));
  }
  const nova = await request.json().catch(() => null);
  if (!nova) return json({ erro: "json_invalido" }, 400, corsHeaders(origin));

  // valida o básico pra não salvar lixo
  const campos = ["diariaBase", "diariaFimDeSemana", "diariaTemporadaAlta",
    "hospedeExtra", "pessoasInclusas", "capacidadeMaxima", "taxaLimpeza",
    "minNoitesSemana", "minNoitesFimDeSemana"];
  for (const c of campos) {
    if (typeof nova[c] !== "number" || nova[c] < 0 || !isFinite(nova[c])) {
      return json({ erro: `campo_invalido:${c}` }, 400, corsHeaders(origin));
    }
  }
  if (!Array.isArray(nova.temporadaAlta)) nova.temporadaAlta = [];

  await env.RESERVAS.put("config:tarifas", JSON.stringify(nova));
  return json({ ok: true }, 200, corsHeaders(origin));
}


/* =========================================================================
 * FUNÇÕES DE APOIO — DATAS / iCAL (idênticas à versão testada)
 * ========================================================================= */

async function datasOcupadas(env, ignorarRef = null) {
  const set = new Set();

  try {
    const resp = await fetch(CONFIG.AIRBNB_ICAL_URL, { cf: { cacheTtl: 300 } });
    if (resp.ok) {
      const texto = await resp.text();
      for (const [ini, fim] of intervalosDoICal(texto)) {
        marcarIntervalo(set, ini, fim);
      }
    } else {
      console.warn("iCal Airbnb status:", resp.status);
    }
  } catch (e) {
    console.warn("Falha lendo iCal Airbnb:", e);
  }

  const lista = await env.RESERVAS.list({ prefix: "reserva:" });
  for (const chave of lista.keys) {
    if (ignorarRef && chave.name === `reserva:${ignorarRef}`) continue;
    const bruto = await env.RESERVAS.get(chave.name);
    if (!bruto) continue;
    const r = JSON.parse(bruto);
    if (r.status !== "confirmada") continue;
    marcarIntervalo(set, r.checkin, r.checkout);
  }

  return set;
}

function marcarIntervalo(set, checkin, checkout) {
  let d = new Date(checkin + "T00:00:00Z");
  const fim = new Date(checkout + "T00:00:00Z");
  while (d < fim) {
    set.add(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
}

function haConflito(checkin, checkout, ocupadas) {
  let d = new Date(checkin + "T00:00:00Z");
  const fim = new Date(checkout + "T00:00:00Z");
  while (d < fim) {
    if (ocupadas.has(d.toISOString().slice(0, 10))) return true;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return false;
}

function intervalosDoICal(texto) {
  const eventos = [];
  const blocos = texto.split("BEGIN:VEVENT").slice(1);
  for (const b of blocos) {
    const ini = (b.match(/DTSTART(?:;VALUE=DATE)?:(\d{8})/) || [])[1];
    const fim = (b.match(/DTEND(?:;VALUE=DATE)?:(\d{8})/) || [])[1];
    if (ini && fim) eventos.push([formatarISO(ini), formatarISO(fim)]);
  }
  return eventos;
}


/* =========================================================================
 * VALIDAÇÃO / FORMATAÇÃO
 * ========================================================================= */

function validarEntrada(d) {
  if (!d.checkin || !d.checkout) return "datas_obrigatorias";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.checkin)) return "checkin_invalido";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.checkout)) return "checkout_invalido";
  if (d.checkout <= d.checkin) return "checkout_antes_do_checkin";
  if (!d.nome || d.nome.trim().length < 2) return "nome_obrigatorio";
  if (!d.telefone || soNumeros(d.telefone).length < 10) return "telefone_invalido";
  const h = Number(d.hospedes);
  if (!h || h < 1) return "hospedes_invalido";
  return null;
}

function reservaDoEvento(payment) {
  return {
    status: "pendente",
    checkin: null,
    checkout: null,
    nome: "Hóspede",
    telefone: "",
    email: "",
    valorReais: payment.value,
    criadaEm: new Date().toISOString(),
  };
}

function dataVencimento(dias) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function formatarISO(yyyymmdd) {
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}
function soData(iso) { return iso.replace(/-/g, ""); }
function formatarBR(iso) {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}
function icalData(iso) {
  return new Date(iso).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}
function soNumeros(s) { return String(s || "").replace(/\D/g, ""); }

function corsHeaders(origin) {
  const permitido = CONFIG.ORIGENS_PERMITIDAS.includes(origin)
    ? origin
    : CONFIG.ORIGENS_PERMITIDAS[0];
  return {
    "Access-Control-Allow-Origin": permitido,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
function json(obj, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...extraHeaders },
  });
}
function semConteudo(extraHeaders = {}) {
  return new Response(null, { status: 204, headers: extraHeaders });
}
