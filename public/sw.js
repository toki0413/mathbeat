const CACHE_NAME = 'mathbeat-v1';
const PRECACHE = [
  './',
  './index.html',
  './composer.html',
  './manifest.json',
  './assets/main-DdPP5r7n.js',
  './assets/composer-x79rWTeB.js',
  './assets/modulepreload-polyfill-B5Qt9EMX.js',
  './assets/mascot.svg',
  './assets/w1.svg',
  './assets/w2.svg',
  './assets/w3.svg',
  './assets/w4.svg',
  './assets/w5.svg',
  './assets/w6.svg',
  './assets/w7.svg',
  './assets/w8.svg',
  './icons/32x32.png',
  './icons/128x128.png',
  './icons/256x256.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(PRECACHE).catch(function () {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) {
          return key !== CACHE_NAME;
        }).map(function (key) {
          return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (e) {
  e.respondWith(
    caches.match(e.request).then(function (cached) {
      if (cached) return cached;
      return fetch(e.request).then(function (response) {
        if (response.ok && e.request.method === 'GET') {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(e.request, clone);
          });
        }
        return response;
      }).catch(function () {
        return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
      });
    })
  );
});
