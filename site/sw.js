// Service Worker: keeps the app working offline.
// Packages and sheets already live in IndexedDB; only the app shell goes here.
const CACHE_VERSION = 0; // AUTO (the deploy replaces it with the run number)
const CACHE = `statforge-${CACHE_VERSION}`;

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const list = await fetch('precache.json').then(r => r.json()).catch(() => []);
    const c = await caches.open(CACHE);
    await c.addAll(['./', 'index.html', ...list]);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

// App files: network first (to pick up updates), cache when offline.
// Requests to other sites (package links) pass straight through.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith((async () => {
    try {
      const r = await fetch(e.request);
      if (r.ok) (await caches.open(CACHE)).put(e.request, r.clone());
      return r;
    } catch {
      return (await caches.match(e.request, { ignoreSearch: true })) || (await caches.match('index.html'));
    }
  })());
});
