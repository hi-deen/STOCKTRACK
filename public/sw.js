const APP_SHELL = [
  '/',
  '/dashboard/operations',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/apple-touch-icon.png',
];

const BUILD_ID = new URL(self.location.href).searchParams.get('build') || 'dev';
const CACHE_NAME = `stocktrack-${BUILD_ID}`;
const IMAGE_CACHE_NAME = `stocktrack-images-${BUILD_ID}`;
const IMAGE_CACHE_LIMIT = 50;

async function cacheFirstWithLimit(request, cacheName, limit) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }

  const response = await fetch(request);
  if (response && response.ok) {
    await cache.put(request, response.clone());
    const keys = await cache.keys();
    if (keys.length > limit) {
      await cache.delete(keys[0]);
    }
  }
  return response;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') {
    return;
  }

  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match('/dashboard/operations').then((cached) => cached || caches.match('/')))
    );
    return;
  }

  if (request.destination === 'image' || request.destination === 'manifest' || request.destination === 'script' || request.destination === 'style') {
    if (url.hostname.includes('supabase')) {
      event.respondWith(cacheFirstWithLimit(request, IMAGE_CACHE_NAME, IMAGE_CACHE_LIMIT));
      return;
    }

    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      }))
    );
    return;
  }

  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_next/') || url.pathname.includes('supabase')) {
    return;
  }

  event.respondWith(fetch(request));
});
