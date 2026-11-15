// Guarda o app no celular pra abrir sem internet. Trocar VERSAO a cada atualização publicada.
const VERSAO = 'revenda-v3';
const ARQUIVOS = ['./', 'index.html', 'styles.css', 'app.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // A leitura da foto (Gemini) sempre vai pra internet
  if (url.hostname.includes('generativelanguage.googleapis.com')) return;
  const fonte = url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com');
  if (url.origin !== location.origin && !fonte) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: url.origin === location.origin }).then((cached) => {
      const rede = fetch(req).then((res) => {
        if (res && (res.ok || res.type === 'opaque')) {
          const copia = res.clone();
          caches.open(VERSAO).then((c) => c.put(req, copia));
        }
        return res;
      }).catch(() => cached);
      return cached || rede;
    })
  );
});
