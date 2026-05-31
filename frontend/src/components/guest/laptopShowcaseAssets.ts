export const ENVIRONMENT_MAP_URL = '/hdr/sunset_2K_65d6cbb9-5c06-44f8-9be3-41df7a99f52a.exr'
export const LAPTOP_MODEL_URL = '/models/幻14笔记本电脑添加贴纸，去镭射孔版.glb?v=20260531-sticker-cover'

let preloaded = false

export function preloadLaptopShowcaseAssets() {
  if (preloaded || typeof document === 'undefined') return
  preloaded = true

  preloadAsset(LAPTOP_MODEL_URL, 'fetch')
  preloadAsset(ENVIRONMENT_MAP_URL, 'fetch')

  void import('./KaliLaptopShowcase').then((module) => {
    module.preloadKaliLaptopShowcaseResources()
  })
}

function preloadAsset(href: string, as: 'fetch') {
  const existing = document.querySelector(`link[rel="preload"][href="${href}"]`)
  if (existing) return

  const link = document.createElement('link')
  link.rel = 'preload'
  link.href = href
  link.as = as
  link.crossOrigin = 'anonymous'
  document.head.appendChild(link)
}
