// Minimal fixture service worker. UJM's real SW imports Firebase + does cache
// management; for boot tests we only need to verify registration + activation
// + cache naming, so this is a trimmed-down stand-in.

const UJ_BUILD_JSON = {
  config: {
    brand: { id: 'ujm-fixture' },
    uj:    { environment: 'production', cache_breaker: 'fixture-1' },
  },
};

const brand        = UJ_BUILD_JSON.config.brand.id;
const cacheBreaker = UJ_BUILD_JSON.config.uj.cache_breaker;
const CACHE_NAME   = `${brand}-${cacheBreaker}`;

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.command === 'get-cache-name') {
    event.ports[0] && event.ports[0].postMessage({ name: CACHE_NAME });
  }
});
