/* Service worker do app de campo.
   Estratégia:
   - PÁGINAS (HTML): network-first — sempre busca a versão online mais recente;
     usa o cache só como reserva quando estiver sem sinal (offline no mato).
   - ASSETS (imagens/manifest): stale-while-revalidate — abre rápido do cache e
     atualiza em segundo plano.
   Ao trocar a versão do cache, o SW antigo e seu conteúdo são descartados. */
const CACHE = 'tekoha-campo-v2';
const SHELL = [
  'coletar.html',
  'favicon-instituto.png',
  'logo-instituto-marca.png',
  'manifest-instituto.json'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isHTML(req) {
  return req.mode === 'navigate'
    || (req.headers.get('accept') || '').includes('text/html')
    || req.url.endsWith('.html');
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  if (isHTML(req)) {
    // network-first
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then(hit => hit || caches.match('coletar.html')))
    );
    return;
  }

  // assets: stale-while-revalidate
  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => hit);
      return hit || net;
    })
  );
});
