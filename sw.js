// ============================================================
// Service Worker - Fund dashboard PWA
// HTML uses Network First so new Vercel deployments are visible after refresh.
// Static scripts and icons remain cache-first for offline resilience.
// ============================================================

const CACHE_NAME = 'fund-dashboard-v1.5';
const STATIC_ASSETS = [
  './',
  './index.html',
  './portfolio-rebalance-dashboard.html',
  './mobile-dashboard.html',
  './login.html',
  './manifest.json',
  './src/config.js',
  './src/supabase.js',
  './src/auth.js',
  './src/data-layer.js',
  './src/realtime.js',
  './src/ocr-client.js',
  './src/sync.js',
  './src/app-init.js',
  './src/mobile-dashboard.css',
  './src/mobile-dashboard.js',
  './icons/icon-192.svg',
  './icons/icon-512.svg'
];

const CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      try {
        await cache.addAll(STATIC_ASSETS);
        console.log('[SW] Core assets cached');
      } catch (err) {
        console.warn('[SW] Some core assets failed to cache:', err);
        for (const asset of STATIC_ASSETS) {
          try { await cache.add(asset); } catch (_) {}
        }
      }

      for (const url of CDN_ASSETS) {
        try {
          const resp = await fetch(url);
          await cache.put(url, resp);
          console.log('[SW] CDN asset cached:', url);
        } catch (_) {
          console.warn('[SW] CDN asset skipped:', url);
        }
      }
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Delete old cache:', key);
            return caches.delete(key);
          })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  if (isPageRequest(request, url)) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (url.hostname.includes('supabase.co')) {
    event.respondWith(networkFirst(request));
    return;
  }

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

  if (url.hostname.includes('jsdelivr') ||
      url.hostname.includes('unpkg') ||
      url.hostname.includes('cdnjs')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(cacheFirstWithFallback(request));
});

function isPageRequest(request, url) {
  return request.mode === 'navigate' ||
    request.destination === 'document' ||
    url.pathname === '/' ||
    url.pathname.endsWith('.html');
}

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
    if (request.mode === 'navigate') {
      const dashCache = await caches.match('./portfolio-rebalance-dashboard.html');
      if (dashCache) return dashCache;
    }
    return offlineFallback(request);
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request, { cache: 'no-store' });
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

function offlineFallback(request) {
  if (request.destination === 'document') {
    return new Response(`
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head><meta charset="utf-8"><title>离线中</title>
      <style>
      body{font-family:system-ui;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#0f172a;color:#e2e8f0;text-align:center;gap:16px}
      h1{font-size:48px;margin:0}p{color:#94a3b8;font-size:16px}
      a{background:#6366f1;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:8px}
      </style></head>
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

self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
  if (event.data === 'getCacheVersion') {
    event.ports[0].postMessage(CACHE_NAME);
  }
});
