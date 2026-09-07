// Self-destroying service worker to ensure stale assets are never served
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => caches.delete(key)));
    }).then(() => self.registration.unregister()).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Always fetch live from network
  event.respondWith(fetch(event.request));
});
