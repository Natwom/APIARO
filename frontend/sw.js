const CACHE_NAME = 'apiaro-v3-assets'; // Bumped to force old cache deletion
const STATIC_ASSETS = [
    '/css/styles.css',
    '/css/loading.css',
    '/js/auth.js',
    '/js/cart.js',
    '/js/products.js',
    '/js/checkout.js',
    '/pwa.js',
    '/favicon.png',
    '/apple-touch-icon.png',
    '/icon-192x192.png',
    '/icon-512x512.png',
    '/manifest.json'
];

// INSTALL: Cache only static assets. Do NOT cache HTML.
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(STATIC_ASSETS))
            .then(() => self.skipWaiting())
    );
});

// ACTIVATE: Delete every old cache immediately and take control of all clients
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((name) => {
                    if (name !== CACHE_NAME) {
                        console.log('[SW] Deleting old cache:', name);
                        return caches.delete(name);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// FETCH: HTML = always network first (never cached). Assets = cache first.
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Ignore cross-origin requests (CDNs, etc.)
    if (url.origin !== self.location.origin) return;

    // HTML pages: always fetch fresh from network
    if (request.mode === 'navigate' || request.destination === 'document') {
        event.respondWith(
            fetch(request)
                .then((response) => response)
                .catch(() => caches.match(request)) // offline fallback only
        );
        return;
    }

    // Static assets: cache first, update in background
    event.respondWith(
        caches.match(request).then((cached) => {
            const fetchPromise = fetch(request).then((networkResponse) => {
                if (networkResponse && networkResponse.ok && request.method === 'GET') {
                    const clone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                }
                return networkResponse;
            }).catch(() => cached);

            return cached || fetchPromise;
        })
    );
});

// Listen for skipWaiting message from pwa.js
self.addEventListener('message', (event) => {
    if (event.data && event.data.action === 'skipWaiting') {
        self.skipWaiting();
    }
});