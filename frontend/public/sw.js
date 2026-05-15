// Bump on every deploy that changes caching behavior. Anything not matching
// this name is purged on activate, so old shells can't survive a release.
const CACHE_NAME = 'flourish-v2';
const APP_SHELL = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  // Don't wait for old tabs to close — new SW takes over immediately.
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Allow the app to force activation of a waiting SW immediately on demand.
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

function isNavigationRequest(request) {
  return request.mode === 'navigate'
    || (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'));
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // API: network-first with cache fallback (unchanged behavior).
  if (url.pathname.startsWith('/api/') || url.hostname.includes('railway.app')) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  // App shell (HTML/navigation): network-first. Critically, this is what
  // prevents a stale cached index.html from referencing JS bundle hashes that
  // no longer exist after a deploy — which is what caused the blank screen.
  if (isNavigationRequest(request)) {
    event.respondWith(
      fetch(request)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put('/index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('/index.html').then(r => r || caches.match('/')))
    );
    return;
  }

  // Hashed static assets (/static/...): cache-first is safe because the file
  // name changes when content changes, so the cache key is effectively the
  // content hash. Fall back to network on miss and warm the cache.
  if (url.pathname.startsWith('/static/')) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(request, copy)).catch(() => {});
          return res;
        });
      })
    );
    return;
  }

  // Everything else: stale-while-revalidate.
  event.respondWith(
    caches.match(request).then(cached => {
      const network = fetch(request).then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(request, copy)).catch(() => {});
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
