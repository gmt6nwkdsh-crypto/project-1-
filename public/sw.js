// Service worker: opens the app with no connection, shows notifications, and opens the app when one is tapped.
const CACHE = 'am-shell-v1';
const SHELL = ['/', '/manifest.webmanifest', '/icon.svg', '/apple-touch-icon.png', '/icon-512.png', '/library.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// Pages and app files: try the network first so updates show up right away, fall back to the saved copy offline.
// The API is never cached here; the page keeps its own offline copy of your log.
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  const page = req.mode === 'navigate';
  e.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res.ok && (page || SHELL.includes(url.pathname))) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(page ? '/' : req, copy)).catch(() => {});
      }
      return res;
    } catch (err) {
      const hit = await caches.match(page ? '/' : req);
      if (hit) return hit;
      throw err;
    }
  })());
});

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (er) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Andrade Macros', {
    body: d.body || 'Open the app to log today.',
    tag: d.tag || 'am',
    icon: '/apple-touch-icon.png',
    badge: '/icon-512.png',
    data: { url: d.url || '/' }
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) { if (new URL(w.url).origin === location.origin) { await w.focus(); return; } }
    await self.clients.openWindow(target);
  })());
});
