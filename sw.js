// NewsStream Service Worker — v6: don't pre-cache index.html at install
// (avoids CDN propagation race that causes truncated HTML in cache)
const CACHE = 'newsstream-v6';
// Only pre-cache static assets that never change mid-deploy
const SHELL = ['./manifest.json','./icon.svg','./icon-maskable.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = e.request.url;
  // GitHub raw data: network first, cache fallback
  if (url.includes('raw.githubusercontent.com')) {
    e.respondWith(
      fetch(e.request).then(r => {
        if (r.ok) caches.open(CACHE).then(c => c.put(e.request, r.clone()));
        return r;
      }).catch(() => caches.match(e.request))
    );
    return;
  }
  // App shell (including index.html): network first, cache on success, fallback to cache
  // Network-first ensures we always get the latest HTML; only falls back if offline
  if (e.request.method === 'GET') {
    e.respondWith(
      fetch(e.request).then(r => {
        if (r.ok) caches.open(CACHE).then(c => c.put(e.request, r.clone()));
        return r;
      }).catch(() => caches.match(e.request))
    );
  }
});
