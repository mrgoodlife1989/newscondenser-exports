// NewsStream Service Worker — v7: bypass browser HTTP cache for app shell
const CACHE = 'newsstream-v7';
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
  // GitHub raw data: network first (no-store), SW cache fallback
  if (url.includes('raw.githubusercontent.com')) {
    e.respondWith(
      fetch(new Request(e.request, {cache: 'no-store'})).then(r => {
        if (r.ok) caches.open(CACHE).then(c => c.put(e.request, r.clone()));
        return r;
      }).catch(() => caches.match(e.request))
    );
    return;
  }
  // App shell: network first with no-store to bypass browser HTTP cache,
  // fall back to SW cache if offline
  if (e.request.method === 'GET') {
    e.respondWith(
      fetch(new Request(e.request, {cache: 'no-store'})).then(r => {
        if (r.ok) caches.open(CACHE).then(c => c.put(e.request, r.clone()));
        return r;
      }).catch(() => caches.match(e.request))
    );
  }
});
