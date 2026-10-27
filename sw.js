// Offline support: keep a copy of the game on the phone so it opens without
// internet. Serves the saved copy instantly and quietly fetches any update in
// the background, which is used the next time the app is opened.
const CACHE = 'fruit-picnic-v50';
const FILES = [
  './', 'index.html', 'style.css', 'game.js', 'tiles.js', 'tutorial.js', 'leaderboard.js', 'privacy.html', 'manifest.webmanifest',
  'fonts/nunito-latin.woff2', 'fonts/baloo2-800-latin.woff2',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(e.request, { ignoreSearch: true });
      const fresh = fetch(e.request)
        .then(res => { if (res.ok) cache.put(e.request, res.clone()); return res; })
        .catch(() => cached);
      return cached || fresh;
    })
  );
});
