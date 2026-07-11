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

export type BrandPalette = Record<BrandShade, string> & Record<BrandColorSlot, string>
export type BrandPaletteOverrides = Partial<Record<BrandShade | BrandColorSlot, string>>

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

export function recreatePaletteFromShade(shade: BrandShade, color: string, originalPalette: BrandPalette): BrandPalette {
  const normalized = normalizeHexColor(color)
  if (!normalized) return originalPalette
  return { ...originalPalette, [shade]: normalized }
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
  darkBg: '#0F1F14',
  darkSurface: '#151B17',
  darkMuted: '#1F4229',
  darkBorder: '#2F4235',
  darkText: '#F4F7F2',
  primary: '#2A6438',
}

type HslColor = {
  hue: number
  lightness: number
  saturation: number
}

const defaultBrandHsl = Object.fromEntries(
  Object.entries(defaultBrandPalette).map(([shade, color]) => [shade, hexToHsl(color)]),
) as Record<BrandShade, HslColor>

const brandShadeRoles: Record<Exclude<BrandShade, 600>, {
  lightness: (base: HslColor) => number
  saturation: (base: HslColor) => number
}> = {
  50: { lightness: () => defaultBrandHsl[50].lightness, saturation: (base) => roleSaturation(base, defaultBrandHsl[50].saturation, 0.36) },
  100: { lightness: () => defaultBrandHsl[100].lightness, saturation: (base) => roleSaturation(base, defaultBrandHsl[100].saturation, 0.42) },
  200: { lightness: () => defaultBrandHsl[200].lightness, saturation: (base) => roleSaturation(base, defaultBrandHsl[200].saturation, 0.52) },
  300: { lightness: () => defaultBrandHsl[300].lightness, saturation: (base) => roleSaturation(base, defaultBrandHsl[300].saturation, 0.62) },
  400: { lightness: (base) => clamp(Math.max(defaultBrandHsl[400].lightness, base.lightness + 12), 44, 68), saturation: (base) => roleSaturation(base, defaultBrandHsl[400].saturation, 0.76) },
  500: { lightness: (base) => clamp(base.lightness + 8, 34, 62), saturation: (base) => roleSaturation(base, defaultBrandHsl[500].saturation, 0.88) },
  700: { lightness: (base) => clamp(base.lightness - 7, 18, 42), saturation: (base) => roleSaturation(base, defaultBrandHsl[700].saturation, 0.95) },
  800: { lightness: (base) => clamp(base.lightness - 14, 14, 34), saturation: (base) => roleSaturation(base, defaultBrandHsl[800].saturation, 0.82) },
  900: { lightness: (base) => clamp(base.lightness - 20, 10, 26), saturation: (base) => roleSaturation(base, defaultBrandHsl[900].saturation, 0.68) },
  950: { lightness: (base) => clamp(base.lightness - 31, 6, 16), saturation: (base) => roleSaturation(base, defaultBrandHsl[950].saturation, 0.55) },
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
  const normalized = normalizeHexColor(hexColor) ?? defaultBrandPalette[600]
  const base = hexToHsl(normalized)
  const hue = base.saturation < 4 ? 0 : base.hue

  const generatedShades = brandShades.reduce((palette, shade) => {
    if (shade === 600) {
      palette[shade] = normalized
      return palette
    }

    const role = brandShadeRoles[shade]
    palette[shade] = hslToHex({
      hue,
      lightness: role.lightness(base),
      saturation: base.saturation < 4 ? 0 : role.saturation(base),
    })
    return palette
  }, {} as Record<BrandShade, string>)

  const generatedRoles: Record<BrandColorSlot, string> = {
    lightBg: generatedShades[50],
    lightSurface: '#FFFFFF',
    lightMuted: generatedShades[100],
    lightBorder: mixHex(generatedShades[100], '#6B7280', 0.18),
    lightText: '#111827',
    darkBg: generatedShades[950],
    darkSurface: mixHex(generatedShades[950], '#111827', 0.42),
    darkMuted: generatedShades[800],
    darkBorder: mixHex(generatedShades[800], '#FFFFFF', 0.14),
    darkText: '#F4F7F2',
    primary: normalized,
  }

  return mergeBrandPalette({ ...generatedShades, ...generatedRoles } as BrandPalette, overrides)
}

export function applyBrandTheme(hexColor: string, overrides: BrandPaletteOverrides = {}) {
  const palette = generateBrandPalette(hexColor, overrides)
  const root = document.documentElement

  const lightBg = palette.lightBg
  const lightSurface = palette.lightSurface
  const lightSurfaceMuted = palette.lightMuted
  const lightBorder = palette.lightBorder
  const lightText = palette.lightText
  const darkBg = palette.darkBg
  const darkSurface = palette.darkSurface
  const darkSurfaceMuted = palette.darkMuted
  const darkBorder = palette.darkBorder
  const darkText = palette.darkText
  const primary = palette.primary

  Object.entries(palette).forEach(([shade, color]) => {
    if (/^\d+$/.test(shade)) root.style.setProperty(`--color-brand-${shade}`, color)
  })

  root.style.setProperty('--app-primary', primary)
  root.style.setProperty('--app-primary-rgb', hexToRgbString(primary))
  root.style.setProperty('--app-light-bg', lightBg)
  root.style.setProperty('--app-light-surface', lightSurface)
  root.style.setProperty('--app-light-muted', lightSurfaceMuted)
  root.style.setProperty('--app-light-border', lightBorder)
  root.style.setProperty('--app-light-text', lightText)
  root.style.setProperty('--app-dark-bg', darkBg)
  root.style.setProperty('--app-dark-surface', darkSurface)
  root.style.setProperty('--app-dark-muted', darkSurfaceMuted)
  root.style.setProperty('--app-dark-border', darkBorder)
  root.style.setProperty('--app-dark-text', darkText)
  root.style.setProperty('--app-bg-light', lightBg)
  root.style.setProperty('--app-bg-dark', darkBg)
  root.style.setProperty('--app-surface-light', lightSurface)
  root.style.setProperty('--app-surface-dark', darkSurface)
  root.style.setProperty('--app-surface-muted-light', lightSurfaceMuted)
  root.style.setProperty('--app-surface-muted-dark', darkSurfaceMuted)
  root.style.setProperty('--app-border-light', lightBorder)
  root.style.setProperty('--app-border-dark', darkBorder)
  root.style.setProperty('--app-text-light', lightText)
  root.style.setProperty('--app-text-dark', darkText)
  root.style.setProperty('--app-header-bg-light', withAlpha(lightBg, 0.86))
  root.style.setProperty('--app-header-bg-dark', withAlpha(darkBg, 0.82))
  root.style.setProperty('--app-panel-bg-light', withAlpha(lightBg, 0.72))
  root.style.setProperty('--app-panel-bg-dark', withAlpha(darkSurface, 0.84))
  root.style.setProperty('--app-panel-muted-bg-light', withAlpha(lightSurfaceMuted, 0.78))
  root.style.setProperty('--app-panel-muted-bg-dark', withAlpha(darkSurfaceMuted, 0.68))
  root.style.setProperty('--app-menu-bg-light', withAlpha(lightBg, 0.96))
  root.style.setProperty('--app-menu-bg-dark', withAlpha(darkBg, 0.96))
  root.style.setProperty('--app-primary-scrollbar', 'var(--app-border)')
  root.style.setProperty('--app-primary-scrollbar-thumb', 'var(--app-border)')
  root.style.setProperty('--app-primary-scrollbar-thumb-hover', 'var(--app-border)')
}

export function normalizeBrandPaletteOverrides(value: unknown): BrandPaletteOverrides {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  return [...brandShades, ...brandColorSlots].reduce((overrides, key) => {
    const raw = (value as Record<string, unknown>)[String(key)]
    if (typeof raw !== 'string') return overrides
    const normalized = normalizeHexColor(raw)
    if (normalized) overrides[key] = normalized
    return overrides
  }, {} as BrandPaletteOverrides)
}

export function mergeBrandPalette(base: BrandPalette, overrides: BrandPaletteOverrides): BrandPalette {
  const merged = { ...base }
  ;([...brandShades, ...brandColorSlots] as Array<BrandShade | BrandColorSlot>).forEach((key) => {
    merged[key] = normalizeHexColor(overrides[key] ?? '') ?? base[key]
  })

  merged[600] = merged.primary
  merged.primary = merged[600]
  merged[50] = merged.lightBg
  merged[100] = merged.lightMuted
  merged[200] = merged.lightBorder
  merged[500] = merged.primary
  merged[700] = mixHex(merged.primary, '#000000', 0.16)
  merged[800] = merged.darkMuted
  merged[900] = merged.darkSurface
  merged[950] = merged.darkBg
  return merged
}

function mixHex(left: string, right: string, rightWeight: number) {
  const normalizedLeft = normalizeHexColor(left) ?? defaultBrandPalette.primary
  const normalizedRight = normalizeHexColor(right) ?? defaultBrandPalette.primary
  const leftRgb = hexToRgb(normalizedLeft)
  const rightRgb = hexToRgb(normalizedRight)
  const weight = clamp(rightWeight, 0, 1)

  return rgbToHex({
    blue: Math.round(leftRgb.blue * (1 - weight) + rightRgb.blue * weight),
    green: Math.round(leftRgb.green * (1 - weight) + rightRgb.green * weight),
    red: Math.round(leftRgb.red * (1 - weight) + rightRgb.red * weight),
  })
}

export function withAlpha(hexColor: string, alpha: number) {
  const normalized = normalizeHexColor(hexColor)
  if (!normalized) return `rgba(42, 100, 56, ${alpha})`
  const { blue, green, red } = hexToRgb(normalized)
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

function roleSaturation(base: HslColor, defaultSaturation: number, accentWeight: number) {
  if (base.saturation < 4) return 0
  const candidate = defaultSaturation * (1 - accentWeight) + base.saturation * accentWeight
  return clamp(candidate, Math.max(18, defaultSaturation * 0.68), 88)
}

function hexToHsl(hexColor: string): HslColor {
  const { blue, green, red } = hexToRgb(hexColor)
  const r = red / 255
  const g = green / 255
  const b = blue / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  const lightness = (max + min) / 2
  let hue = 0
  let saturation = 0

  if (delta !== 0) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1))
    if (max === r) hue = 60 * (((g - b) / delta) % 6)
    if (max === g) hue = 60 * ((b - r) / delta + 2)
    if (max === b) hue = 60 * ((r - g) / delta + 4)
  }

  return {
    hue: hue < 0 ? hue + 360 : hue,
    lightness: lightness * 100,
    saturation: saturation * 100,
  }
}

function hslToHex(color: HslColor) {
  const saturation = clamp(color.saturation, 0, 100) / 100
  const lightness = clamp(color.lightness, 0, 100) / 100
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation
  const hue = ((color.hue % 360) + 360) % 360
  const x = chroma * (1 - Math.abs((hue / 60) % 2 - 1))
  const match = lightness - chroma / 2
  const [r1, g1, b1] =
    hue < 60 ? [chroma, x, 0]
      : hue < 120 ? [x, chroma, 0]
        : hue < 180 ? [0, chroma, x]
          : hue < 240 ? [0, x, chroma]
            : hue < 300 ? [x, 0, chroma]
              : [chroma, 0, x]

  return rgbToHex({
    blue: Math.round((b1 + match) * 255),
    green: Math.round((g1 + match) * 255),
    red: Math.round((r1 + match) * 255),
  })
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function hexToRgb(hexColor: string) {
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

function rgbToHex(color: { blue: number; green: number; red: number }) {
  return `#${toHexChannel(color.red)}${toHexChannel(color.green)}${toHexChannel(color.blue)}`
}

function toHexChannel(value: number) {
  return value.toString(16).padStart(2, '0').toUpperCase()
}
