// Network first, cache as fallback: always fresh online, still playable offline.
const CACHE = 'poko-path-v28';
const SHELL = ['./', 'index.html', 'style.css', 'manifest.json', 'icon.svg',
  'src/main.js', 'src/game.js', 'src/stages.js', 'src/gen/v1.js', 'src/gen/v2.js', 'src/gen/v3.js', 'src/gen/weekly-v1.js', 'src/gen/weekly.js', 'src/gen/wide.js', 'src/gen/bridge.js', 'src/draw.js', 'src/real.js', 'src/ads.js', 'src/portal.js', 'src/i18n.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })),
  );
});
