'use strict';

const APP_CACHE = 'daily-review-app-v1';
const DATA_CACHE = 'daily-review-data-v1';
const APP_SHELL = [
  './',
  'index.html',
  'styles.css',
  'app.js',
  'manifest.webmanifest',
  'icon.svg',
  'og.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(APP_CACHE).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all([
    caches.keys().then((names) => Promise.all(names
      .filter((name) => name.startsWith('daily-review-app-') && name !== APP_CACHE)
      .map((name) => caches.delete(name)))),
    self.clients.claim(),
  ]));
});

async function networkFirst(request, cacheName, fallbackPath, normalizeSearch) {
  const cache = await caches.open(cacheName);
  const requestUrl = new URL(request.url);
  const cacheKey = normalizeSearch ? new Request(requestUrl.origin + requestUrl.pathname) : request;
  try {
    const response = await fetch(request);
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
    event.respondWith(networkFirst(request, APP_CACHE, 'index.html'));
    return;
  }
  if (url.pathname.includes('/data/')) {
    event.respondWith(networkFirst(request, DATA_CACHE, null, true));
    return;
  }
  event.respondWith(caches.open(APP_CACHE).then(async (cache) => {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  }));
});
