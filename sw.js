// ============================================================
// Service Worker — 基金组合仪表盘 PWA
// 策略：Cache First（核心资源）+ Network First（API请求）
// ============================================================

const CACHE_NAME = 'fund-dashboard-v1.4';
const STATIC_ASSETS = [
  './',
  './portfolio-rebalance-dashboard.html',
  './login.html',
  './manifest.json',
  './src/config.js',
  './src/supabase.js',
  './src/auth.js',
  './src/data-layer.js',
  './src/realtime.js',
  './src/app-init.js',
  './icons/icon-192.svg',
  './icons/icon-512.svg'
];

// CDN 资源（尝试缓存，失败不影响安装）
const CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js'
];

// ===== Install：预缓存核心资源 =====
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      // 核心静态资源（必须成功）
      try {
        await cache.addAll(STATIC_ASSETS);
        console.log('[SW] 核心资源缓存成功');
      } catch (err) {
        console.warn('[SW] 部分核心资源缓存失败（本地文件路径可能不同）:', err);
        // 逐个尝试，不整体失败
        for (const asset of STATIC_ASSETS) {
          try { await cache.add(asset); } catch (_) {}
        }
      }

      // CDN 资源（可选，失败则跳过）
      for (const url of CDN_ASSETS) {
        try {
          const resp = await fetch(url);
          await cache.put(url, resp);
          console.log('[SW] CDN 资源缓存:', url);
        } catch (_) {
          console.warn('[SW] CDN 资源跳过（离线状态）:', url);
        }
      }
    })
  );
  // 立即激活，不等待旧 SW 关闭
  self.skipWaiting();
});

// ===== Activate：清理旧缓存 =====
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] 清除旧缓存:', key);
            return caches.delete(key);
          })
      )
    )
  );
  // 立即控制所有客户端
  self.clients.claim();
});

// ===== Fetch：请求拦截策略 =====
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. 跳过非 GET 请求（POST/PUT/DELETE 直接走网络）
  if (request.method !== 'GET') return;

  // 2. Supabase API 请求 → Network First（保证数据实时）
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // 3. 天天基金 / 腾讯行情 API → Network Only（实时数据不缓存）
  if (url.hostname.includes('fundgz.1234567') ||
      url.hostname.includes('qt.gtimg.cn') ||
      url.hostname.includes('push2.eastmoney')) {
    event.respondWith(fetch(request).catch(() =>
      new Response(JSON.stringify({ error: 'offline' }), {
        headers: { 'Content-Type': 'application/json' }
      })
    ));
    return;
  }

  // 4. CDN JS 库 → Cache First（有缓存就不走网络，保证离线可用）
  if (url.hostname.includes('jsdelivr') ||
      url.hostname.includes('unpkg') ||
      url.hostname.includes('cdnjs')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // 5. 本地资源（HTML/JS/CSS/图片）→ Cache First with Network Fallback
  event.respondWith(cacheFirstWithFallback(request));
});

// ===== 策略函数 =====

// Cache First：有缓存直接返回，没有再走网络并缓存
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    return offlineFallback(request);
  }
}

// Cache First with Fallback：同上，但本地资源失败时返回离线页
async function cacheFirstWithFallback(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (_) {
    // 如果是导航请求（打开页面），返回仪表盘主页
    if (request.mode === 'navigate') {
      const dashCache = await caches.match('./portfolio-rebalance-dashboard.html');
      if (dashCache) return dashCache;
    }
    return offlineFallback(request);
  }
}

// Network First：先走网络，失败再用缓存
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (_) {
    const cached = await caches.match(request);
    if (cached) return cached;
    return offlineFallback(request);
  }
}

// 离线降级响应
function offlineFallback(request) {
  const url = new URL(request.url);
  if (request.destination === 'document') {
    return new Response(`
      <!DOCTYPE html>
      <html lang="zh">
      <head><meta charset="utf-8"><title>离线中</title>
      <style>body{font-family:system-ui;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#0f172a;color:#e2e8f0;text-align:center;gap:16px}
      h1{font-size:48px;margin:0}p{color:#94a3b8;font-size:16px}
      a{background:#6366f1;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:8px}</style>
      </head>
      <body>
        <h1>📡</h1>
        <h2>当前离线</h2>
        <p>无法连接网络。已缓存的数据仍可查看。</p>
        <a href="./portfolio-rebalance-dashboard.html">返回仪表盘</a>
      </body></html>
    `, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
  return new Response('', { status: 503, statusText: 'Service Unavailable' });
}

// ===== 消息处理（支持主页面通信）=====
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
  if (event.data === 'getCacheVersion') {
    event.ports[0].postMessage(CACHE_NAME);
  }
});
