import type { PlatformSettings } from '../services/systemSettings'

export type PlatformLogoAssets = {
  authLogoUrl: string
  authLogoUrlDark: string
  faviconUrl: string
  navigationLogoUrl: string
  navigationLogoUrlDark: string
}

function svgDataUrl(svg: string) {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

const placeholderNavigationLogo = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="360" height="96" viewBox="0 0 360 96" role="img" aria-label="Placeholder icon">
  <rect width="360" height="96" rx="20" fill="none"/>
  <g transform="translate(152 16)" fill="none" stroke="#2A6438" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M28 4 52 14v18c0 16-10.5 25.5-24 30C14.5 57.5 4 48 4 32V14L28 4Z"/>
    <path d="m17 31 8 8 15-18"/>
  </g>
</svg>`)

const placeholderNavigationLogoDark = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="360" height="96" viewBox="0 0 360 96" role="img" aria-label="Placeholder icon">
  <rect width="360" height="96" rx="20" fill="none"/>
  <g transform="translate(152 16)" fill="none" stroke="#86D39A" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M28 4 52 14v18c0 16-10.5 25.5-24 30C14.5 57.5 4 48 4 32V14L28 4Z"/>
    <path d="m17 31 8 8 15-18"/>
  </g>
</svg>`)

const placeholderAuthLogo = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192" role="img" aria-label="Placeholder icon">
  <rect width="192" height="192" rx="48" fill="#EEF7F1"/>
  <g transform="translate(48 40)" fill="none" stroke="#2A6438" stroke-width="8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M48 8 88 24v30c0 27-17.5 42.5-40 50C25.5 96.5 8 81 8 54V24L48 8Z"/>
    <path d="m31 53 13 13 25-31"/>
  </g>
</svg>`)

const placeholderAuthLogoDark = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192" role="img" aria-label="Placeholder icon">
  <rect width="192" height="192" rx="48" fill="#13231A"/>
  <g transform="translate(48 40)" fill="none" stroke="#86D39A" stroke-width="8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M48 8 88 24v30c0 27-17.5 42.5-40 50C25.5 96.5 8 81 8 54V24L48 8Z"/>
    <path d="m31 53 13 13 25-31"/>
  </g>
</svg>`)

const placeholderFavicon = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128" role="img" aria-label="Placeholder favicon icon">
  <rect width="128" height="128" rx="30" fill="#2A6438"/>
  <g transform="translate(28 22)" fill="none" stroke="#FFFFFF" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">
    <path d="M36 6 66 18v23c0 20-13 32-30 38C19 73 6 61 6 41V18L36 6Z"/>
    <path d="m23 40 10 10 19-24"/>
  </g>
</svg>`)

export const defaultPlatformLogos: PlatformLogoAssets = {
  authLogoUrl: placeholderAuthLogo,
  authLogoUrlDark: placeholderAuthLogoDark,
  faviconUrl: placeholderFavicon,
  navigationLogoUrl: placeholderNavigationLogo,
  navigationLogoUrlDark: placeholderNavigationLogoDark,
}

const platformBrandingEvent = 'cqupt-platform-branding-change'
let currentPlatformLogos = defaultPlatformLogos

export function getPlatformLogos() {
  return currentPlatformLogos
}

export function resolvePlatformLogos(settings?: Partial<PlatformSettings> | null): PlatformLogoAssets {
  const legacyLogo = settings?.logoUrl || undefined
  const navigationLogo = settings?.navigationLogoUrl || legacyLogo
  const navigationLogoDark = settings?.navigationLogoUrlDark || navigationLogo
  const authLogo = settings?.authLogoUrl || legacyLogo
  const authLogoDark = settings?.authLogoUrlDark || authLogo
  const faviconLogo = settings?.faviconUrl || legacyLogo

  return {
    authLogoUrl: authLogo ?? defaultPlatformLogos.authLogoUrl,
    authLogoUrlDark: authLogoDark ?? defaultPlatformLogos.authLogoUrlDark,
    faviconUrl: faviconLogo ?? defaultPlatformLogos.faviconUrl,
    navigationLogoUrl: navigationLogo ?? defaultPlatformLogos.navigationLogoUrl,
    navigationLogoUrlDark: navigationLogoDark ?? defaultPlatformLogos.navigationLogoUrlDark,
  }
}

export function applyPlatformBranding(settings?: Partial<PlatformSettings> | null) {
  currentPlatformLogos = resolvePlatformLogos(settings)
  applyFavicon(currentPlatformLogos.faviconUrl)

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(platformBrandingEvent, { detail: currentPlatformLogos }))
  }
}

export function subscribePlatformBranding(listener: (logos: PlatformLogoAssets) => void) {
  if (typeof window === 'undefined') return () => {}

  const handler = (event: Event) => {
    listener((event as CustomEvent<PlatformLogoAssets>).detail ?? currentPlatformLogos)
  }
  window.addEventListener(platformBrandingEvent, handler)
  return () => window.removeEventListener(platformBrandingEvent, handler)
}

function applyFavicon(url: string) {
  if (typeof document === 'undefined') return

  const head = document.head
  let icon = head.querySelector<HTMLLinkElement>('link[rel="icon"]')
  if (!icon) {
    icon = document.createElement('link')
    icon.rel = 'icon'
    head.appendChild(icon)
  }
  icon.href = url
  icon.type = inferIconMimeType(url)
}

function inferIconMimeType(url: string) {
  if (url.startsWith('data:')) return url.slice(5, url.indexOf(';')) || 'image/png'
  if (url.endsWith('.svg')) return 'image/svg+xml'
  if (url.endsWith('.ico')) return 'image/x-icon'
  if (url.endsWith('.webp')) return 'image/webp'
  return 'image/png'
}
