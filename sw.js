// Offline support: keep a copy of the game on the phone so it opens without
// internet. When online, the newest version is always loaded (and saved for
// later); the saved copy is only used when the network is slow or missing.
const CACHE = 'fruit-picnic-v57';
const NETWORK_WAIT_MS = 3000;   // after this long, fall back to the saved copy
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
      // by address: a page-open request can't be re-sent with cache options
      const fresh = fetch(e.request.url, { cache: 'no-cache', credentials: 'same-origin' })
        .then(res => { if (res.ok) cache.put(e.request, res.clone()); return res; });
      if (!cached) return fresh;
      // Network first; the saved copy only if the network fails or is too slow
      const slow = new Promise(resolve => setTimeout(() => resolve(cached), NETWORK_WAIT_MS));
      return Promise.race([fresh.catch(() => cached), slow]);
    })
  );
});
