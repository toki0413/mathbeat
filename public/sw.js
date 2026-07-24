/* MathBeat Service Worker
 *
 * 安全缓存策略：
 *  - HTML 文档：network-first，确保用户拿到最新 HTML（避免缓存投毒长期化）
 *  - JS/CSS 静态资源：stale-while-revalidate，先用缓存快速响应，后台更新
 *  - 图片/SVG：cache-first，节省带宽
 *  - 其他请求：透传，不缓存
 *
 * 缓存版本由构建期注入（或手工 bump），每次发布必须更新 CACHE_NAME。
 */

// 缓存版本号：每次发版必须 bump，否则旧缓存不会清理
const CACHE_NAME = 'mathbeat-v2-2026-07';
const PRECACHE = [
  './',
  './index.html',
  './composer.html',
  './manifest.json',
  './assets/mascot.svg',
  './assets/bgs/w1.svg',
  './assets/bgs/w2.svg',
  './assets/bgs/w3.svg',
  './assets/bgs/w4.svg',
  './assets/bgs/w5.svg',
  './assets/bgs/w6.svg',
  './assets/bgs/w7.svg',
  './assets/bgs/w8.svg',
  './assets/icons/w1.svg',
  './assets/icons/w2.svg',
  './assets/icons/w3.svg',
  './assets/icons/w4.svg',
  './assets/icons/w5.svg',
  './assets/icons/w6.svg',
  './assets/icons/w7.svg',
  './assets/icons/w8.svg',
  './icons/32x32.png',
  './icons/128x128.png',
  './icons/192x192.png',
  './icons/256x256.png',
  './icons/512x512.png'
  // 注意：JS/CSS 的 hashed 文件名由运行时缓存策略自动捕获，
  // 不在 PRECACHE 中硬编码，避免 hash 变更后预缓存 404
];

// HTML 与导航请求：network-first
function handleNavigation(request) {
  return fetch(request)
    .then(function (response) {
      if (response && response.ok) {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          // TODO(LRU): 未来在此处实现 LRU 淘汰策略——限制缓存条目数（如 ≤ 100），
          // 超限时删除最久未访问的 entry。当前依赖 CACHE_NAME 版本号 bump 失效整批旧缓存，
          // 已能保证发版后旧资源被清理，但单版本周期内无条目上限，长会话可能膨胀。
          cache.put(request, clone);
        });
      }
      return response;
    })
    .catch(function () {
      // 离线时回退到缓存的 HTML，再退到根路径
      return caches.match(request).then(function (cached) {
        return cached || caches.match('./index.html');
      });
    });
}

// JS/CSS：stale-while-revalidate
function handleStaticAsset(request) {
  return caches.match(request).then(function (cached) {
    var fetchPromise = fetch(request)
      .then(function (response) {
        // 仅缓存同源、GET、成功的响应（防止跨域或错误响应污染缓存）
        if (
          response &&
          response.ok &&
          response.type === 'basic' &&
          request.method === 'GET'
        ) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(request, clone);
          });
        }
        return response;
      })
      .catch(function () {
        return cached || new Response('', { status: 504, statusText: 'Gateway Timeout' });
      });
    // 有缓存就先返回，后台再更新
    return cached || fetchPromise;
  });
}

// 图片/SVG：cache-first
function handleImage(request) {
  return caches.match(request).then(function (cached) {
    return (
      cached ||
      fetch(request).then(function (response) {
        if (response && response.ok && response.type === 'basic') {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(request, clone);
          });
        }
        return response;
      })
    );
  });
}

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(function (cache) {
        // use addAll with ignoreFailures semantics：单项失败不阻断 install
        return Promise.all(
          PRECACHE.map(function (url) {
            return cache.add(url).catch(function () {
              /* 部分资源 404 不阻断 SW 安装 */
            });
          })
        );
      })
      .then(function () {
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys
            .filter(function (key) {
              return key !== CACHE_NAME;
            })
            .map(function (key) {
              return caches.delete(key);
            })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return; // 仅拦截 GET

  const url = new URL(req.url);
  // 仅处理同源请求，跨域透传
  if (url.origin !== self.location.origin) return;

  // 导航请求（HTML）
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    e.respondWith(handleNavigation(req));
    return;
  }

  // 静态资源
  if (req.destination === 'script' || req.destination === 'style') {
    e.respondWith(handleStaticAsset(req));
    return;
  }

  // 图片
  if (req.destination === 'image') {
    e.respondWith(handleImage(req));
    return;
  }

  // 其他资源（字体、音频等）：cache-first + 后台更新
  e.respondWith(handleStaticAsset(req));
});

// 监听 message 事件，支持通过 postMessage 触发 skipWaiting
// 更新提示（TODO）：页面侧 navigator.serviceWorker.register 后应监听
// controllerchange 弹出「新版本可用，点击刷新」提示，并由用户触发 postMessage({type:'SKIP_WAITING'})。
// 当前页面侧注册逻辑未在本 SW 文件内（SW 文件不应含 register 调用），需在入口 HTML/JS 补充更新检测 UI。
self.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
