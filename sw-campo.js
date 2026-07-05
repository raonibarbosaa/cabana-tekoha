/* Service worker do app de campo — cacheia a casca para uso offline no mato.
   MODO_DEMO: dados ficam só na memória do app; aqui só garantimos que a
   interface abre sem sinal. */
const CACHE = 'tekoha-campo-v1';
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
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match('coletar.html')))
  );
});
