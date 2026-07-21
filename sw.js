// NewsStream Service Worker — v9: Web Push (daily 07:00 via GitHub Actions cron)
const CACHE = 'newsstream-v9';
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

// Daily 07:00 push, sent by the GitHub Actions cron.
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; }
  catch (_) { d = {body: e.data ? e.data.text() : ''}; }
  e.waitUntil(self.registration.showNotification(d.title || '☀️ NewsStream', {
    body: d.body || 'Dein täglicher Brief ist bereit.',
    icon: './icon.svg',
    badge: './icon.svg',
    tag: d.tag || 'daily-brief',
    renotify: true,
    data: {url: d.url || './'},
  }));
});

// Tapping the notification focuses an open app window or opens a new one.
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(
    clients.matchAll({type: 'window', includeUncontrolled: true}).then(cs => {
      for (const c of cs) { if ('focus' in c) return c.focus(); }
      if (clients.openWindow) return clients.openWindow(target);
    })
  );
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
