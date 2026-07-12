import type { MouseEvent } from 'react'

export type ColorTheme = 'dark' | 'light'

const THEME_STORAGE_KEY = 'cqupt-theme'
const FALLBACK_TRANSITION_CLASS = 'theme-color-transition'
const TRANSITION_DURATION = 1350

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => {
    ready: Promise<void>
    finished: Promise<void>
  }
}

export function getSavedColorTheme(defaultTheme: ColorTheme = 'dark'): ColorTheme {
  try {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY)
    return savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : defaultTheme
  } catch {
    return defaultTheme
  }
}

export function applyColorTheme(theme: ColorTheme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Storage may be unavailable in restricted browsing modes.
  }
}

export function transitionColorTheme(theme: ColorTheme, event?: MouseEvent<HTMLElement>) {
  const root = document.documentElement

  if (root.dataset.motion === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    applyColorTheme(theme)
    return
  }

  const x = event?.clientX ?? window.innerWidth - 40
  const y = event?.clientY ?? 40
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
  root.style.setProperty('--theme-transition-x', `${x}px`)
  root.style.setProperty('--theme-transition-y', `${y}px`)
  root.style.setProperty('--theme-transition-radius', `${Math.ceil(radius)}px`)

  const viewTransition = (document as ViewTransitionDocument).startViewTransition?.(() => {
    applyColorTheme(theme)
  })

  if (viewTransition) {
    root.classList.add(FALLBACK_TRANSITION_CLASS)
    viewTransition.finished.finally(() => {
      root.classList.remove(FALLBACK_TRANSITION_CLASS)
      root.style.removeProperty('--theme-transition-x')
      root.style.removeProperty('--theme-transition-y')
      root.style.removeProperty('--theme-transition-radius')
    })
    return
  }

  const overlay = document.createElement('div')
  overlay.className = 'theme-transition-overlay'
  overlay.style.background = getComputedStyle(root).getPropertyValue('--app-bg').trim() || '#f7f9f7'
  document.body.appendChild(overlay)

  root.classList.add(FALLBACK_TRANSITION_CLASS)
  window.requestAnimationFrame(() => {
    applyColorTheme(theme)
    overlay.classList.add('theme-transition-overlay-exit')
  })

  window.setTimeout(() => {
    overlay.remove()
    root.classList.remove(FALLBACK_TRANSITION_CLASS)
    root.style.removeProperty('--theme-transition-x')
    root.style.removeProperty('--theme-transition-y')
    root.style.removeProperty('--theme-transition-radius')
  }, TRANSITION_DURATION + 80)
}
