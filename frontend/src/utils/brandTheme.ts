export type BrandShade = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950
export type BrandColorSlot =
  | 'lightBg'
  | 'lightSurface'
  | 'lightMuted'
  | 'lightBorder'
  | 'lightText'
  | 'darkBg'
  | 'darkSurface'
  | 'darkMuted'
  | 'darkBorder'
  | 'darkText'
  | 'primary'

export type BrandPaletteKey = BrandShade | BrandColorSlot
export type BrandPalette = Record<BrandShade, string> & Record<BrandColorSlot, string>
export type BrandPaletteOverrides = Partial<Record<BrandPaletteKey, string>>

export const brandShades: BrandShade[] = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
export const brandColorSlots: BrandColorSlot[] = [
  'lightBg',
  'lightSurface',
  'lightMuted',
  'lightBorder',
  'lightText',
  'darkBg',
  'darkSurface',
  'darkMuted',
  'darkBorder',
  'darkText',
  'primary',
]
export const brandPaletteKeys: BrandPaletteKey[] = [...brandColorSlots, ...brandShades]

export function recreatePaletteFromShade(shade: BrandShade, color: string, originalPalette: BrandPalette): BrandPalette {
  const normalized = normalizeHexColor(color)
  if (!normalized) return originalPalette
  return generateBrandPalette(shade === 600 ? normalized : originalPalette.primary, {
    ...originalPalette,
    [shade]: normalized,
    ...(shade === 600 ? { primary: normalized } : {}),
  })
}

export const defaultBrandPalette: BrandPalette = {
  50: '#EEF7F0',
  100: '#D8ECDD',
  200: '#B3D9BE',
  300: '#86BD98',
  400: '#5C9C72',
  500: '#3C7D51',
  600: '#2A6438',
  700: '#23532F',
  800: '#1F4229',
  900: '#1B3724',
  950: '#0F1F14',
  lightBg: '#EEF7F0',
  lightSurface: '#FFFFFF',
  lightMuted: '#D8ECDD',
  lightBorder: '#DDE5DE',
  lightText: '#111827',
  darkBg: '#111816',
  darkSurface: '#171F1C',
  darkMuted: '#202C27',
  darkBorder: '#33413B',
  darkText: '#EAF0EC',
  primary: '#2A6438',
}

type RgbColor = {
  blue: number
  green: number
  red: number
}

type OklchColor = {
  chroma: number
  hue: number
  lightness: number
}

const shadeLightness: Record<BrandShade, number> = {
  50: 0.965,
  100: 0.92,
  200: 0.84,
  300: 0.74,
  400: 0.64,
  500: 0.54,
  600: 0.46,
  700: 0.39,
  800: 0.32,
  900: 0.25,
  950: 0.16,
}

const shadeChromaFactor: Record<BrandShade, number> = {
  50: 0.18,
  100: 0.28,
  200: 0.42,
  300: 0.58,
  400: 0.76,
  500: 0.9,
  600: 0.92,
  700: 0.78,
  800: 0.62,
  900: 0.44,
  950: 0.28,
}

export function normalizeHexColor(value: string) {
  const trimmed = value.trim()
  return /^#[0-9A-Fa-f]{6}$/.test(trimmed) ? trimmed.toUpperCase() : null
}

export function formatHexInput(value: string) {
  const compact = value.trim().replace(/[^#0-9a-fA-F]/g, '')
  const withoutExtraHashes = compact.startsWith('#')
    ? `#${compact.slice(1).replace(/#/g, '')}`
    : compact
  return withoutExtraHashes.startsWith('#')
    ? withoutExtraHashes.slice(0, 7).toUpperCase()
    : `#${withoutExtraHashes.slice(0, 6)}`.toUpperCase()
}

export function generateBrandPalette(hexColor: string, overrides: BrandPaletteOverrides = {}): BrandPalette {
  const normalized = normalizeHexColor(hexColor) ?? defaultBrandPalette.primary
  const seed = hexToOklch(normalized)
  const hue = seed.chroma < 0.01 ? hexToOklch(defaultBrandPalette.primary).hue : seed.hue
  const chroma = seed.chroma < 0.01 ? 0 : Math.min(seed.chroma, 0.18)
  const darkChroma = chroma * 0.55

  const generatedShades = brandShades.reduce((palette, shade) => {
    palette[shade] = oklchToHex({
      chroma: chroma * shadeChromaFactor[shade],
      hue,
      lightness: shadeLightness[shade],
    })
    return palette
  }, {} as Record<BrandShade, string>)
  generatedShades[600] = normalized
  generatedShades[500] = ensureReadableOnWhite(generatedShades[500])
  generatedShades[700] = ensureReadableOnWhite(generatedShades[700])

  const neutralHue = hue
  const lightBg = oklchToHex({ chroma: chroma * 0.08, hue: neutralHue, lightness: 0.972 })
  const lightMuted = oklchToHex({ chroma: chroma * 0.12, hue: neutralHue, lightness: 0.925 })
  const lightBorder = oklchToHex({ chroma: chroma * 0.08, hue: neutralHue, lightness: 0.865 })
  const darkBg = oklchToHex({ chroma: darkChroma * 0.18, hue: neutralHue, lightness: 0.17 })
  const darkSurface = oklchToHex({ chroma: darkChroma * 0.18, hue: neutralHue, lightness: 0.215 })
  const darkMuted = oklchToHex({ chroma: darkChroma * 0.24, hue: neutralHue, lightness: 0.285 })
  const darkBorder = oklchToHex({ chroma: darkChroma * 0.2, hue: neutralHue, lightness: 0.38 })

  const generatedRoles: Record<BrandColorSlot, string> = {
    lightBg,
    lightSurface: '#FFFFFF',
    lightMuted,
    lightBorder,
    lightText: '#111827',
    darkBg,
    darkSurface,
    darkMuted,
    darkBorder,
    darkText: '#EAF0EC',
    primary: normalized,
  }

  return mergeBrandPalette({ ...generatedShades, ...generatedRoles } as BrandPalette, overrides)
}

export function applyBrandTheme(hexColor: string, overrides: BrandPaletteOverrides = {}) {
  const palette = generateBrandPalette(hexColor, overrides)
  const root = document.documentElement

  Object.entries(palette).forEach(([shade, color]) => {
    if (/^\d+$/.test(shade)) root.style.setProperty(`--color-brand-${shade}`, color)
  })

  root.style.setProperty('--app-primary', palette.primary)
  root.style.setProperty('--app-primary-rgb', hexToRgbString(palette.primary))
  root.style.setProperty('--app-light-bg', palette.lightBg)
  root.style.setProperty('--app-light-surface', palette.lightSurface)
  root.style.setProperty('--app-light-muted', palette.lightMuted)
  root.style.setProperty('--app-light-border', palette.lightBorder)
  root.style.setProperty('--app-light-text', palette.lightText)
  root.style.setProperty('--app-dark-bg', palette.darkBg)
  root.style.setProperty('--app-dark-surface', palette.darkSurface)
  root.style.setProperty('--app-dark-muted', palette.darkMuted)
  root.style.setProperty('--app-dark-border', palette.darkBorder)
  root.style.setProperty('--app-dark-text', palette.darkText)
  root.style.setProperty('--app-bg-light', palette.lightBg)
  root.style.setProperty('--app-bg-dark', palette.darkBg)
  root.style.setProperty('--app-surface-light', palette.lightSurface)
  root.style.setProperty('--app-surface-dark', palette.darkSurface)
  root.style.setProperty('--app-surface-muted-light', palette.lightMuted)
  root.style.setProperty('--app-surface-muted-dark', palette.darkMuted)
  root.style.setProperty('--app-border-light', palette.lightBorder)
  root.style.setProperty('--app-border-dark', palette.darkBorder)
  root.style.setProperty('--app-text-light', palette.lightText)
  root.style.setProperty('--app-text-dark', palette.darkText)
  root.style.setProperty('--app-header-bg-light', withAlpha(palette.lightBg, 0.86))
  root.style.setProperty('--app-header-bg-dark', withAlpha(palette.darkBg, 0.84))
  root.style.setProperty('--app-panel-bg-light', withAlpha(palette.lightBg, 0.72))
  root.style.setProperty('--app-panel-bg-dark', withAlpha(palette.darkSurface, 0.9))
  root.style.setProperty('--app-panel-muted-bg-light', withAlpha(palette.lightMuted, 0.78))
  root.style.setProperty('--app-panel-muted-bg-dark', withAlpha(palette.darkMuted, 0.66))
  root.style.setProperty('--app-menu-bg-light', withAlpha(palette.lightBg, 0.96))
  root.style.setProperty('--app-menu-bg-dark', withAlpha(palette.darkBg, 0.97))
  root.style.setProperty('--app-primary-scrollbar', 'var(--app-border)')
  root.style.setProperty('--app-primary-scrollbar-thumb', 'var(--app-border)')
  root.style.setProperty('--app-primary-scrollbar-thumb-hover', 'var(--app-border)')
}

export function normalizeBrandPaletteOverrides(value: unknown): BrandPaletteOverrides {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  return brandPaletteKeys.reduce((overrides, key) => {
    const raw = (value as Record<string, unknown>)[String(key)]
    if (typeof raw !== 'string') return overrides
    const normalized = normalizeHexColor(raw)
    if (normalized) overrides[key] = normalized
    return overrides
  }, {} as BrandPaletteOverrides)
}

export function mergeBrandPalette(base: BrandPalette, overrides: BrandPaletteOverrides): BrandPalette {
  const merged = { ...base }
  brandPaletteKeys.forEach((key) => {
    merged[key] = normalizeHexColor(overrides[key] ?? '') ?? base[key]
  })

  merged.primary = normalizeHexColor(overrides.primary ?? overrides[600] ?? merged.primary) ?? merged.primary
  merged[600] = merged.primary
  return merged
}

export function withAlpha(hexColor: string, alpha: number) {
  const normalized = normalizeHexColor(hexColor)
  if (!normalized) return `rgba(42, 100, 56, ${alpha})`
  const { blue, green, red } = hexToRgb(normalized)
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

function ensureReadableOnWhite(hexColor: string) {
  let color = normalizeHexColor(hexColor) ?? defaultBrandPalette.primary
  let attempts = 0
  while (contrastRatio(color, '#FFFFFF') < 4.5 && attempts < 12) {
    const oklch = hexToOklch(color)
    color = oklchToHex({ ...oklch, lightness: oklch.lightness - 0.025 })
    attempts += 1
  }
  return color
}

function contrastRatio(left: string, right: string) {
  const leftLum = relativeLuminance(hexToRgb(left))
  const rightLum = relativeLuminance(hexToRgb(right))
  const light = Math.max(leftLum, rightLum)
  const dark = Math.min(leftLum, rightLum)
  return (light + 0.05) / (dark + 0.05)
}

function relativeLuminance(color: RgbColor) {
  const channels = [color.red, color.green, color.blue].map((channel) => {
    const value = channel / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

function hexToOklch(hexColor: string): OklchColor {
  const { blue, green, red } = hexToRgb(hexColor)
  const r = srgbToLinear(red / 255)
  const g = srgbToLinear(green / 255)
  const b = srgbToLinear(blue / 255)

  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b

  const lRoot = Math.cbrt(l)
  const mRoot = Math.cbrt(m)
  const sRoot = Math.cbrt(s)

  const lightness = 0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot
  const a = 1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot
  const bAxis = 0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot
  const hue = ((Math.atan2(bAxis, a) * 180) / Math.PI + 360) % 360

  return {
    chroma: Math.sqrt(a * a + bAxis * bAxis),
    hue,
    lightness,
  }
}

function oklchToHex(color: OklchColor) {
  let candidate = color
  let attempts = 0
  while (attempts < 10) {
    const rgb = oklchToRgb(candidate)
    if (isRgbInGamut(rgb)) return rgbToHex(rgb)
    candidate = { ...candidate, chroma: candidate.chroma * 0.86 }
    attempts += 1
  }
  return rgbToHex(clampRgb(oklchToRgb(candidate)))
}

function oklchToRgb(color: OklchColor): RgbColor {
  const hueRadians = (color.hue * Math.PI) / 180
  const a = color.chroma * Math.cos(hueRadians)
  const bAxis = color.chroma * Math.sin(hueRadians)
  const lRoot = color.lightness + 0.3963377774 * a + 0.2158037573 * bAxis
  const mRoot = color.lightness - 0.1055613458 * a - 0.0638541728 * bAxis
  const sRoot = color.lightness - 0.0894841775 * a - 1.291485548 * bAxis

  const l = lRoot ** 3
  const m = mRoot ** 3
  const s = sRoot ** 3

  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
  const b = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s

  return {
    blue: Math.round(linearToSrgb(b) * 255),
    green: Math.round(linearToSrgb(g) * 255),
    red: Math.round(linearToSrgb(r) * 255),
  }
}

function srgbToLinear(value: number) {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

function linearToSrgb(value: number) {
  return value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function clampRgb(color: RgbColor): RgbColor {
  return {
    blue: Math.round(clamp(color.blue, 0, 255)),
    green: Math.round(clamp(color.green, 0, 255)),
    red: Math.round(clamp(color.red, 0, 255)),
  }
}

function isRgbInGamut(color: RgbColor) {
  return [color.red, color.green, color.blue].every((channel) => channel >= 0 && channel <= 255)
}

function hexToRgb(hexColor: string): RgbColor {
  return {
    blue: Number.parseInt(hexColor.slice(5, 7), 16),
    green: Number.parseInt(hexColor.slice(3, 5), 16),
    red: Number.parseInt(hexColor.slice(1, 3), 16),
  }
}

function hexToRgbString(hexColor: string) {
  const { blue, green, red } = hexToRgb(hexColor)
  return `${red}, ${green}, ${blue}`
}

function rgbToHex(color: RgbColor) {
  const clamped = clampRgb(color)
  return `#${toHexChannel(clamped.red)}${toHexChannel(clamped.green)}${toHexChannel(clamped.blue)}`
}

function toHexChannel(value: number) {
  return value.toString(16).padStart(2, '0').toUpperCase()
}
