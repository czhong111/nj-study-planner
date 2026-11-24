/**
 * PWA 注册入口。
 * - 仅在生产构建（npm run build / preview）中注册 Service Worker；
 *   开发模式（npm run dev）下 Vite HMR 与 SW 缓存会互相干扰，故不注册。
 * - /sw.js 位于 public/ 目录，构建后落在站点根目录，作用域覆盖整站。
 * - 更新策略：sw.js 内使用 skipWaiting + clients.claim，部署新版本后
 *   下一次打开自动接管并清理旧缓存，无需用户手动操作。
 */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return
  if (!import.meta.env.PROD) return

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('Service Worker 注册失败（不影响正常使用）：', err)
    })
  })
}
