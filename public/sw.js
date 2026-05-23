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
  // Intercept PWA Share Target POST request for offline/client-only support (e.g. on Netlify)
  if (e.request.method === 'POST' && e.request.url.includes('/api/share-target')) {
    e.respondWith(
      (async () => {
        try {
          const formData = await e.request.formData();
          const files = formData.getAll('files');
          const title = formData.get('title') || '';
          const text = formData.get('text') || '';

          const cache = await caches.open('pwa-shares');

          if (files && files.length > 0) {
            const file = files[0];
            const headers = new Headers();
            headers.set('Content-Type', file.type || 'image/jpeg');
            headers.set('X-File-Name', encodeURIComponent(file.name || 'received_shared_file'));
            await cache.put(
              new Request('/shares/latest-file'),
              new Response(file, { headers })
            );
          } else {
            await cache.delete('/shares/latest-file');
          }

          await cache.put(
            new Request('/shares/latest-metadata'),
            new Response(JSON.stringify({ title, text }), {
              headers: { 'Content-Type': 'application/json' }
            })
          );

          return Response.redirect('/?shared-file=true', 303);
        } catch (err) {
          console.error('[SW Share Intercept Error]', err);
          return Response.redirect('/?shareError=' + encodeURIComponent(err.message || 'unknown'), 303);
        }
      })()
    );
    return;
  }

  // Always let other non-GET requests pass directly to the network
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
