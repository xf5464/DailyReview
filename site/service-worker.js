'use strict';

// scripts/build.js replaces this placeholder so every published shell revision
// produces a different worker and cache name.
const APP_CACHE = 'daily-review-app-__APP_VERSION__';
const DATA_CACHE = 'daily-review-data-v2';
const ARCHIVE_URL = 'https://raw.githubusercontent.com/xf5464/DailyReview/main/site/reader/data/recent.json';
const APP_SHELL = [
  './',
  'index.html',
  'styles.css',
  'app.js',
  'manifest.webmanifest',
  'icon.svg',
  'og.png',
  'reader/index.html',
  'reader/reader.css',
  'reader/reader.js',
  'reader/manifest.webmanifest',
  'reader/icon-192.png',
  'reader/icon-512.png',
  'reader/data/recent.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(APP_CACHE).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    const previousAppCaches = names.filter((name) => name.startsWith('daily-review-app-') && name !== APP_CACHE);
    await Promise.all(previousAppCaches.map((name) => caches.delete(name)));
    await self.clients.claim();
    if (previousAppCaches.length) {
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

async function latestNews() {
  try {
    const response = await fetch(ARCHIVE_URL + '?v=' + Date.now(), { cache: 'no-store' });
    if (!response.ok) throw new Error(String(response.status));
    const archive = await response.json();
    return (archive.days || []).flatMap((day) => day.items || [])[0] || null;
  } catch {
    return null;
  }
}

self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    const item = await latestNews();
    const target = new URL('reader/', self.registration.scope);
    if (item?.id) target.searchParams.set('open', item.id);
    await self.registration.showNotification('DailyReview 新热点', {
      body: item?.titleZh || item?.title || '新一批科技与美股热点已经更新',
      icon: new URL('reader/icon-192.png', self.registration.scope).href,
      badge: new URL('reader/icon-192.png', self.registration.scope).href,
      tag: `dailyreview-${item?.id || Date.now()}`,
      data: { url: target.href },
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const target = event.notification.data?.url || new URL('reader/', self.registration.scope).href;
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find((client) => client.url.startsWith(self.registration.scope));
    if (existing) {
      await existing.navigate(target);
      return existing.focus();
    }
    return self.clients.openWindow(target);
  })());
});
