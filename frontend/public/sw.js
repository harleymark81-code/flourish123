const CACHE_NAME = 'flourish-v1';
const APP_SHELL = ['/', '/index.html'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  // Network-first for API calls
  if (url.pathname.startsWith('/api/') || url.hostname.includes('railway.app')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }
  // Cache-first for everything else (app shell, static assets)
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
