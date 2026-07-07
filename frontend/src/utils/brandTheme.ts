export type BrandShade = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950

export type BrandPalette = Record<BrandShade, string>

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
}

type HslColor = {
  hue: number
  lightness: number
  saturation: number
}

const defaultRoleColors = {
  appBgDark: '#0F1511',
  appBgLight: '#F7F9F7',
  appSurfaceDark: '#151B17',
  appSurfaceMutedDark: '#1D251F',
  appSurfaceMutedLight: '#EEF3EF',
}

const defaultBrandHsl = Object.fromEntries(
  Object.entries(defaultBrandPalette).map(([shade, color]) => [shade, hexToHsl(color)]),
) as Record<BrandShade, HslColor>

const defaultRoleHsl = Object.fromEntries(
  Object.entries(defaultRoleColors).map(([role, color]) => [role, hexToHsl(color)]),
) as Record<keyof typeof defaultRoleColors, HslColor>

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

export function generateBrandPalette(hexColor: string): BrandPalette {
  const normalized = normalizeHexColor(hexColor) ?? defaultBrandPalette[600]
  const base = hexToHsl(normalized)
  const hue = base.saturation < 4 ? 0 : base.hue

  return (Object.keys(defaultBrandPalette).map(Number) as BrandShade[]).reduce((palette, shade) => {
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
  }, {} as BrandPalette)
}

export function applyBrandTheme(hexColor: string) {
  const palette = generateBrandPalette(hexColor)
  const root = document.documentElement
  const base = hexToHsl(palette[600])
  const hue = base.saturation < 4 ? 0 : base.hue
  const lightBg = roleColor(hue, lowChroma(base, defaultRoleHsl.appBgLight.saturation), defaultRoleHsl.appBgLight.lightness)
  const lightSurfaceMuted = roleColor(hue, lowChroma(base, defaultRoleHsl.appSurfaceMutedLight.saturation), defaultRoleHsl.appSurfaceMutedLight.lightness)
  const darkBg = roleColor(hue, lowChroma(base, defaultRoleHsl.appBgDark.saturation), defaultRoleHsl.appBgDark.lightness)
  const darkSurface = roleColor(hue, lowChroma(base, defaultRoleHsl.appSurfaceDark.saturation), defaultRoleHsl.appSurfaceDark.lightness)
  const darkSurfaceMuted = roleColor(hue, lowChroma(base, defaultRoleHsl.appSurfaceMutedDark.saturation), defaultRoleHsl.appSurfaceMutedDark.lightness)
  const lightPanel = withAlpha('#FFFFFF', 0.75)
  const lightPanelMuted = withAlpha(lightSurfaceMuted, 0.78)
  const darkPanel = withAlpha(darkSurface, 0.84)
  const darkPanelMuted = withAlpha(darkSurfaceMuted, 0.68)

  Object.entries(palette).forEach(([shade, color]) => {
    root.style.setProperty(`--color-brand-${shade}`, color)
  })

  root.style.setProperty('--app-primary', palette[600])
  root.style.setProperty('--app-primary-rgb', hexToRgbString(palette[600]))
  root.style.setProperty('--app-bg-light', lightBg)
  root.style.setProperty('--app-bg-dark', darkBg)
  root.style.setProperty('--app-surface-muted-light', lightSurfaceMuted)
  root.style.setProperty('--app-surface-muted-dark', darkSurfaceMuted)
  root.style.setProperty('--app-header-bg-light', withAlpha(lightBg, 0.86))
  root.style.setProperty('--app-header-bg-dark', withAlpha(darkBg, 0.82))
  root.style.setProperty('--app-panel-bg-light', lightPanel)
  root.style.setProperty('--app-panel-bg-dark', darkPanel)
  root.style.setProperty('--app-panel-muted-bg-light', lightPanelMuted)
  root.style.setProperty('--app-panel-muted-bg-dark', darkPanelMuted)
  root.style.setProperty('--app-menu-bg-light', withAlpha(lightBg, 0.96))
  root.style.setProperty('--app-menu-bg-dark', withAlpha(darkBg, 0.96))
  root.style.setProperty('--app-primary-scrollbar', withAlpha(palette[600], 0.55))
  root.style.setProperty('--app-primary-scrollbar-thumb', withAlpha(palette[600], 0.45))
  root.style.setProperty('--app-primary-scrollbar-thumb-hover', withAlpha(palette[600], 0.7))
}

export function withAlpha(hexColor: string, alpha: number) {
  const normalized = normalizeHexColor(hexColor)
  if (!normalized) return `rgba(42, 100, 56, ${alpha})`
  const { blue, green, red } = hexToRgb(normalized)
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

function roleColor(hue: number, saturation: number, lightness: number) {
  return hslToHex({ hue, lightness, saturation })
}

function roleSaturation(base: HslColor, defaultSaturation: number, accentWeight: number) {
  if (base.saturation < 4) return 0
  const candidate = defaultSaturation * (1 - accentWeight) + base.saturation * accentWeight
  return clamp(candidate, Math.max(18, defaultSaturation * 0.68), 88)
}

function lowChroma(base: HslColor, defaultSaturation: number) {
  if (base.saturation < 4) return 0
  return clamp(defaultSaturation * 0.72 + base.saturation * 0.12, 8, 24)
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
