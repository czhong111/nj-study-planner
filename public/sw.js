/**
 * ============================================================================
 * Service Worker（手工实现，不依赖第三方 PWA 插件）
 * ----------------------------------------------------------------------------
 * 目标：
 *   1. 添加到手机主屏后弱网 / 离线也能打开页面（应用壳缓存 + 静态资源缓存优先）
 *   2. 缓存静态资源与知识库 JSON（知识库 JSON 在构建时已内联进 JS 包，
 *      运行时若存在独立 .json 请求也一并按静态资源缓存）
 *   3. 用户数据（错题 / 打卡 / 掌握状态）存 localStorage，完全不经过 SW；
 *      /api/* 动态接口与跨域请求（云端同步、识别接口）一律直接放行，不做缓存
 *
 * 缓存策略：
 *   - 页面导航（navigate）：缓存优先（秒开），后台请求最新版更新缓存
 *   - 静态资源（js/css/json/图片/字体）：缓存优先，未命中时请求并写入缓存
 *   - 其他同源 GET：网络优先，失败回退缓存
 * 版本更新：改 VERSION 重新部署后，activate 阶段自动清理旧缓存并接管页面。
 * ============================================================================
 */
const VERSION = 'v1.0.1'
const CACHE_NAME = `njsp-${VERSION}`
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-192.png',
  '/icons/maskable-512.png',
  '/icons/apple-touch-icon.png',
]
const STATIC_RE = /\.(?:js|css|json|png|jpe?g|gif|svg|webp|ico|woff2?)(?:\?|$)/

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

async function handleNavigate(event) {
  const cached = await caches.match('/index.html')
  const fetchAndUpdate = fetch(event.request)
    .then((response) => {
      if (response && response.ok) {
        const copy = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy))
      }
      return response
    })
    .catch(() => null)

  if (cached) {
    // 有缓存：先秒开，后台静默更新
    event.waitUntil(fetchAndUpdate)
    return cached
  }
  const fresh = await fetchAndUpdate
  if (fresh) return fresh
  return new Response('当前离线，且还没有可用的页面缓存。请联网打开一次本应用。', {
    status: 503,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return // 云端同步 / 识别等跨域请求直接放行
  if (url.pathname.startsWith('/api/')) return // 动态接口不缓存

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigate(event))
    return
  }

  if (STATIC_RE.test(url.pathname)) {
    // 静态资源：缓存优先
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          if (response && response.ok) {
            const copy = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
          }
          return response
        })
      }),
    )
    return
  }

  // 其他同源 GET（如 Vite dev 的模块请求）：网络优先，失败回退缓存
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
        }
        return response
      })
      .catch(() => caches.match(request)),
  )
})
