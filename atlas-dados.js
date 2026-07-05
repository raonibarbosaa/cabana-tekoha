/* Atlas Vivo Tekoha — banco público de espécies (abelhas + flora).
   Só informação pública. Coordenada sensível NÃO entra aqui:
   ocorrências de espécie sensível usam sens:'ofuscado' ou 'restrito'
   (o mapa público nunca mostra o ponto exato de ninho protegido). */
window.ESPECIES = [
  /* ================= ABELHAS ================= */
  {
    slug:'urucu', tipo:'abelha', cor:'#d99321',
    nomePopular:'Uruçu', nomeCientifico:'Melipona scutellaris', familia:'Apidae · Meliponini',
    selos:['nativa','sem ferrão','melipona'],
    resumo:'A maior e mais icônica abelha sem ferrão do Nordeste, produtora de um mel muito apreciado.',
    descricao:'A uruçu é uma abelha sem ferrão de grande porte, dócil, que nidifica em ocos de árvores. É símbolo da meliponicultura nordestina e uma das espécies mais criadas em meliponários. Suas colônias podem ter milhares de operárias, e o mel — mais fluido e ácido que o das abelhas com ferrão — tem alto valor.',
    ficha:{
      'Família':'Apidae (tribo Meliponini)',
      'Porte':'Grande (~10–12 mm)',
      'Ninho':'Oco de árvores vivas',
      'Ferrão':'Atrofiado (não ferroa)',
      'Distribuição':'Mata Atlântica do Nordeste',
      'Mel':'Fluido, levemente ácido'
    },
    curiosidade:'Não tem rainhas "de reserva" como abelhas com ferrão: a uruçu produz muitas rainhas virgens, e a colônia escolhe uma.',
    importancia:'Poliniza dezenas de espécies nativas; visita intensamente flores de mirtáceas e leguminosas do santuário.',
    ocorrencias:[{municipio:'Itabaiana',uf:'SE',sens:'restrito',lat:-10.7488,lng:-37.3421}]
  },
  {
    slug:'jatai', tipo:'abelha', cor:'#e0a838',
    nomePopular:'Jataí', nomeCientifico:'Tetragonisca angustula', familia:'Apidae · Meliponini',
    selos:['nativa','sem ferrão','urbana'],
    resumo:'Pequena, mansa e comum até em cidades — a "porta de entrada" da meliponicultura.',
    descricao:'A jataí é uma das abelhas sem ferrão mais conhecidas e distribuídas do Brasil. Faz ninhos em cavidades pequenas (ocos, muros, caixas) com uma entrada de cera em forma de tubo característico, guardada por operárias sentinelas que pairam na entrada. Seu mel é valorizado em usos medicinais tradicionais.',
    ficha:{
      'Família':'Apidae (tribo Meliponini)',
      'Porte':'Pequeno (~4–5 mm)',
      'Ninho':'Cavidades pequenas; entrada em tubo de cera',
      'Ferrão':'Atrofiado (não ferroa)',
      'Distribuição':'Quase todo o Brasil',
      'Mel':'Pouco volume, muito valorizado'
    },
    curiosidade:'Operárias "guardas" ficam voando paradas na entrada do ninho, vigiando contra invasores como a abelha-limão (Lestrimelitta).',
    importancia:'Polinizadora generalista; ótima indicadora de ambiente porque tolera áreas alteradas.',
    ocorrencias:[{municipio:'Areia Branca',uf:'SE',sens:'publico',lat:-10.7556,lng:-37.3308}]
  },
  {
    slug:'mandaguari', tipo:'abelha', cor:'#c9871c',
    nomePopular:'Mandaguari', nomeCientifico:'Scaptotrigona postica', familia:'Apidae · Meliponini',
    selos:['nativa','sem ferrão'],
    resumo:'Abelha de colônias populosas e defensivas, de entrada de ninho inconfundível.',
    descricao:'A mandaguari forma colônias muito populosas e é mais defensiva que a jataí — enrosca no cabelo e morde, mas não ferroa. A entrada do ninho é um tubo de cera escura, às vezes ramificado. Boa produtora de mel e própolis (geoprópolis).',
    ficha:{
      'Família':'Apidae (tribo Meliponini)',
      'Porte':'Médio (~6–8 mm)',
      'Ninho':'Ocos; entrada em tubo de cera escura',
      'Ferrão':'Atrofiado (morde para se defender)',
      'Distribuição':'Ampla no Brasil',
      'Produtos':'Mel e geoprópolis'
    },
    curiosidade:'Produz bastante própolis — a "geoprópolis" das sem-ferrão mistura resina de plantas com barro.',
    importancia:'Colônias grandes = muitas forrageiras; alta pressão de polinização na floração.',
    ocorrencias:[{municipio:'Areia Branca',uf:'SE',sens:'ofuscado',lat:-10.7602,lng:-37.3402}]
  },
  {
    slug:'jandaira', tipo:'abelha', cor:'#b8791f',
    nomePopular:'Jandaíra', nomeCientifico:'Melipona subnitida', familia:'Apidae · Meliponini',
    selos:['nativa','sem ferrão','caatinga'],
    resumo:'A abelha-símbolo da Caatinga, adaptada ao semiárido e ao mel de sertão.',
    descricao:'A jandaíra é a principal Melipona da Caatinga, criada tradicionalmente por sertanejos há gerações. Resiste bem à seca e à escassez, armazenando alimento para os períodos difíceis. Seu mel é referência cultural e econômica no Nordeste semiárido.',
    ficha:{
      'Família':'Apidae (tribo Meliponini)',
      'Porte':'Médio-grande (~8–10 mm)',
      'Ninho':'Ocos de árvores da Caatinga',
      'Ferrão':'Atrofiado (não ferroa)',
      'Distribuição':'Caatinga (NE do Brasil)',
      'Mel':'Aromático, típico do sertão'
    },
    curiosidade:'É tão ligada à cultura que virou tema de projetos de conservação e de indicação geográfica do mel.',
    importancia:'Polinizadora-chave de plantas da Caatinga; sofre com desmatamento e captura ilegal de ninhos.',
    ocorrencias:[{municipio:'Malhador',uf:'SE',sens:'restrito',lat:-10.664,lng:-37.305}]
  },

  /* ================= FLORA ================= */
  {
    slug:'sabia', tipo:'flora', cor:'#6f8a3f',
    nomePopular:'Sabiá', nomeCientifico:'Mimosa caesalpiniifolia', familia:'Fabaceae',
    selos:['nativa','melífera','leguminosa'],
    resumo:'Leguminosa nordestina de floração intensa e generosa em pólen e néctar.',
    descricao:'Árvore de médio porte, espinhosa, muito usada em cercas vivas e recuperação de áreas degradadas por fixar nitrogênio no solo. Na floração, cobre-se de espigas cremes visitadas por grande número de abelhas — é uma das melhores plantas melíferas do Nordeste.',
    ficha:{
      'Família':'Fabaceae',
      'Forma de vida':'Árvore (4–8 m)',
      'Floração':'Ago–Nov (variável)',
      'Recurso p/ abelhas':'Néctar e pólen',
      'Frutificação':'Vagens',
      'Usos':'Cerca viva, lenha, recuperação de solo'
    },
    curiosidade:'Fixa nitrogênio pelas raízes — melhora o solo enquanto cresce, e por isso é aliada da restauração.',
    importancia:'Floração farta que sustenta as colônias de abelhas na estação; alvo prioritário de plantio no santuário.',
    ocorrencias:[{municipio:'Areia Branca',uf:'SE',sens:'publico',lat:-10.7521,lng:-37.3375}]
  },
  {
    slug:'ipe-roxo', tipo:'flora', cor:'#8a5fae',
    nomePopular:'Ipê-roxo', nomeCientifico:'Handroanthus impetiginosus', familia:'Bignoniaceae',
    selos:['nativa','melífera','ornamental'],
    resumo:'Explosão roxa que anuncia a estação seca e atrai abelhas de grande porte.',
    descricao:'Árvore que perde as folhas e floresce em massa, cobrindo-se de flores roxas antes de rebrotar. As flores tubulares oferecem néctar abundante e são visitadas por abelhas grandes (inclusive Melipona), além de beija-flores. Madeira nobre e árvore símbolo do cerrado e da caatinga.',
    ficha:{
      'Família':'Bignoniaceae',
      'Forma de vida':'Árvore (8–20 m)',
      'Floração':'Jun–Set (flores antes das folhas)',
      'Recurso p/ abelhas':'Néctar',
      'Frutificação':'Cápsula alongada',
      'Usos':'Ornamental, madeira, medicinal'
    },
    curiosidade:'A floração é sincronizada por queda de temperatura/chuva: quase todos os ipês de uma região abrem juntos.',
    importancia:'Fonte de néctar na entressafra; a floração em massa é um evento-chave no calendário do santuário.',
    ocorrencias:[{municipio:'Areia Branca',uf:'SE',sens:'publico',lat:-10.7517,lng:-37.3382}]
  },
  {
    slug:'cajueiro', tipo:'flora', cor:'#c78a2a',
    nomePopular:'Cajueiro', nomeCientifico:'Anacardium occidentale', familia:'Anacardiaceae',
    selos:['nativa','melífera'],
    resumo:'Nativa do Nordeste, com floração muito visitada por abelhas antes do caju.',
    descricao:'Árvore nativa da costa nordestina, hoje cultivada em todo o mundo. Antes de formar o pseudofruto (o "caju") e a castanha, produz panículas de flores pequenas ricas em néctar, muito procuradas por abelhas — que ajudam justamente na polinização e na produção.',
    ficha:{
      'Família':'Anacardiaceae',
      'Forma de vida':'Árvore (5–10 m, copa ampla)',
      'Floração':'Set–Jan (variável)',
      'Recurso p/ abelhas':'Néctar e pólen',
      'Frutificação':'Castanha + pseudofruto (caju)',
      'Usos':'Alimentício, sombra'
    },
    curiosidade:'O "caju" que comemos é um pseudofruto (o pedúnculo inchado); o fruto verdadeiro é a castanha.',
    importancia:'A polinização por abelhas aumenta a frutificação — exemplo direto do valor econômico das nativas.',
    ocorrencias:[{municipio:'Itabaiana',uf:'SE',sens:'publico',lat:-10.7529,lng:-37.3352}]
  },
  {
    slug:'juazeiro', tipo:'flora', cor:'#5f8a34',
    nomePopular:'Juazeiro', nomeCientifico:'Ziziphus joazeiro', familia:'Rhamnaceae',
    selos:['nativa','melífera','caatinga'],
    resumo:'Verde o ano todo na Caatinga, floresce na seca e salva as abelhas na escassez.',
    descricao:'Árvore emblemática da Caatinga que permanece verde mesmo na estiagem, quando quase tudo perde as folhas. Floresce justamente no período seco, oferecendo néctar num momento crítico — por isso é considerada uma planta "salva-vidas" para as colônias de abelhas do sertão.',
    ficha:{
      'Família':'Rhamnaceae',
      'Forma de vida':'Árvore (6–12 m)',
      'Floração':'Estação seca',
      'Recurso p/ abelhas':'Néctar (crítico na escassez)',
      'Frutificação':'Drupa (juá)',
      'Usos':'Sombra, forragem, medicinal'
    },
    curiosidade:'A casca e a folha do juazeiro eram usadas para fazer sabão e pasta de dente caseira no sertão.',
    importancia:'Sustenta as abelhas no auge da seca — peça central da segurança alimentar das colônias.',
    ocorrencias:[{municipio:'Campo do Brito',uf:'SE',sens:'publico',lat:-10.7398,lng:-37.493}]
  }
];
