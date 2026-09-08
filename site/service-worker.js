'use strict';

// scripts/build.js replaces this placeholder so every published shell revision
// produces a different worker and app-shell cache name.
const APP_CACHE = 'daily-review-app-__APP_VERSION__';
// Keep this aligned with site/app.js OFFLINE_DATA_CACHE so app updates do not
// delete the user's downloaded offline dataset.
const DATA_CACHE = 'daily-review-data-v1';
const APP_SHELL = [
  './',
  'index.html',
  'styles.css',
  'app.js',
  'manifest.webmanifest',
  'toy-icon-a1190c863e-180.png',
  'toy-icon-a1190c863e-192.png',
  'toy-icon-a1190c863e-512.png',
  'og.png',
  'reader/index.html',
  'reader/reader.css',
  'reader/reader.js',
  'reader/manifest.webmanifest',
  'reader/icon-192.png',
  'reader/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(APP_CACHE).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    const previousAppCaches = names.filter((name) => name.startsWith('daily-review-app-') && name !== APP_CACHE);
    const previousDataCaches = names.filter((name) => name.startsWith('daily-review-data-') && name !== DATA_CACHE);
    await Promise.all([...previousAppCaches, ...previousDataCaches].map((name) => caches.delete(name)));
    await self.clients.claim();
    if (previousAppCaches.length || previousDataCaches.length) {
      const windows = await self.clients.matchAll({ type: 'window' });
      await Promise.all(windows.map((client) => client.navigate(client.url)));
    }
  })());
});

async function networkFirst(request, cacheName, fallbackPath, normalizeSearch) {
  const cache = await caches.open(cacheName);
  const requestUrl = new URL(request.url);
  const cacheKey = normalizeSearch ? new Request(requestUrl.origin + requestUrl.pathname) : request;
  try {
    const response = await fetch(request, normalizeSearch ? { cache: 'no-store' } : undefined);
    if (response.ok) await cache.put(cacheKey, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(cacheKey, { ignoreSearch: true });
    if (cached) return cached;
    if (fallbackPath) {
      const fallback = await caches.match(fallbackPath, { ignoreSearch: true });
      if (fallback) return fallback;
    }
    throw error;
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    const fallback = url.pathname.includes('/reader/') ? 'reader/index.html' : 'index.html';
    event.respondWith(networkFirst(request, APP_CACHE, fallback));
    return;
  }
  if (url.pathname.includes('/data/')) {
    event.respondWith(networkFirst(request, DATA_CACHE, null, true));
    return;
  }
  event.respondWith(networkFirst(request, APP_CACHE));
});
