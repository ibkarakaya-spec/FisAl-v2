const CACHE_NAME = 'fisai-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch(() => {});
    })
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // Always let POST and non-GET requests pass directly to the network
  if (e.request.method !== 'GET') {
    return;
  }

  // Exclude API calls or live dev-server/HMR websocket connections from being cached
  if (e.request.url.includes('/api/') || e.request.url.includes('socket') || e.request.url.includes('@vite')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Network-First Strategy for all other static assets & index.html
  e.respondWith(
    fetch(e.request)
      .then((response) => {
        // If response is valid, clone and cache it
        if (response && response.status === 200 && response.type === 'basic') {
          const responseCopy = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseCopy);
          });
        }
        return response;
      })
      .catch(() => {
        // If network request fails (offline), try to serve from cache
        return caches.match(e.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If accessing index.html/root and offline, ensure we return the cached home route
          if (e.request.mode === 'navigate') {
            return caches.match('/');
          }
        });
      })
  );
});
