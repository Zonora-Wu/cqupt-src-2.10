import type { PlatformSettings } from '../services/systemSettings'

export type PlatformLogoAssets = {
  authLogoUrl: string
  authLogoUrlDark: string
  faviconUrl: string
  navigationLogoUrl: string
  navigationLogoUrlDark: string
}

export const defaultPlatformLogos: PlatformLogoAssets = {
  authLogoUrl: '/assets/logos/CQUPT_02_logo.png',
  authLogoUrlDark: '/assets/logos/CQUPT_02_logo_dark.png',
  faviconUrl: '/assets/logos/CQUPT_01_logo_1024px.png',
  navigationLogoUrl: '/assets/logos/CQUPT_03_logo.png',
  navigationLogoUrlDark: '/assets/logos/CQUPT_03_logo_dark.png',
}

const platformBrandingEvent = 'cqupt-platform-branding-change'
let currentPlatformLogos = defaultPlatformLogos

export function getPlatformLogos() {
  return currentPlatformLogos
}

export function resolvePlatformLogos(settings?: Partial<PlatformSettings> | null): PlatformLogoAssets {
  const legacyLogo = settings?.logoUrl || undefined
  const navigationLogo = settings?.navigationLogoUrl || legacyLogo
  const authLogo = settings?.authLogoUrl || legacyLogo
  const faviconLogo = settings?.faviconUrl || legacyLogo

  return {
    authLogoUrl: authLogo ?? defaultPlatformLogos.authLogoUrl,
    authLogoUrlDark: authLogo ?? defaultPlatformLogos.authLogoUrlDark,
    faviconUrl: faviconLogo ?? defaultPlatformLogos.faviconUrl,
    navigationLogoUrl: navigationLogo ?? defaultPlatformLogos.navigationLogoUrl,
    navigationLogoUrlDark: navigationLogo ?? defaultPlatformLogos.navigationLogoUrlDark,
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
