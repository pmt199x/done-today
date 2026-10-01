// Bump CACHE whenever app assets change so installed PWAs pick up the new version.
const CACHE = 'done-today-v3';
const ASSETS = ['./', './index.html', './styles.css', './app.js', './manifest.json', './icon-192.png', './icon-512.png', './icon-180.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS.map(url => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('done-today-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: e.request.mode === 'navigate' })
      .then(r => r || fetch(e.request).catch(() => caches.match('./index.html')))
  );
});
