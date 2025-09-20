const CACHE_NAME = 'frontx-v1';
const SCOPE = self.registration.scope; // e.g., https://host/frontx/

// Build URLs relative to scope so they work under /frontx
const SHELL_URLS = [
  SCOPE,                          // '/frontx/'
  new URL('index.html', SCOPE).href
  // If you copy sw.js to dist, you can also precache poster if it lives under /frontx/
  // new URL('poster.jpg', SCOPE).href,
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((c) => c.addAll(SHELL_URLS)).catch(()=>{})
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      // clean old versions if you bump CACHE_NAME
      const keys = await caches.keys();
      await Promise.all(keys.map(k => (k !== CACHE_NAME ? caches.delete(k) : Promise.resolve())));
      await self.clients.claim();
    })()
  );
});

// Helper: should we bypass cache entirely?
function shouldBypass(req) {
  const url = new URL(req.url);

  // Don’t touch Range requests (audio/video streams)
  if (req.headers.get('range')) return true;

  // Bypass audio completely (covers both patterns)
  if (req.destination === 'audio') return true;
  if (url.pathname.startsWith('/public/Audio/') || url.pathname.startsWith('/Audio/')) return true;
  if (/\.(mp3|wav|ogg|flac)$/i.test(url.pathname)) return true;

  // Don’t cache APIs, WS handshakes, or server state endpoints
  if (url.pathname.startsWith('/ws') || url.pathname === '/current' || url.pathname.startsWith('/manifest')) return true;

  // Only same-origin
  if (url.origin !== location.origin) return true;

  return false;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;

  if (shouldBypass(req)) {
    // straight network
    return; // letting the browser fetch normally (no respondWith)
  }

  // Navigation requests: SPA fallback to /frontx/index.html
  if (req.mode === 'navigate') {
    e.respondWith(
      (async () => {
        try {
          const net = await fetch(req);
          return net;
        } catch {
          const cache = await caches.open(CACHE_NAME);
          // serve the SPA shell offline
          return (await cache.match(new URL('index.html', SCOPE).href)) || Response.error();
        }
      })()
    );
    return;
  }

  // Static assets & other GETs: stale-while-revalidate
  if (req.method === 'GET') {
    e.respondWith(
      caches.match(req).then((cached) => {
        const netFetch = fetch(req).then((resp) => {
          // Cache successful, cacheable responses
          if (resp && resp.ok && resp.type !== 'opaque') {
            const copy = resp.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(()=>{});
          }
          return resp;
        }).catch(() => cached || Promise.reject('offline'));
        return cached ? cached : netFetch;
      })
    );
  }
});