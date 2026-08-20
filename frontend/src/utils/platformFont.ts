export type PlatformFontAppearance = {
  fontDisplayName: string
  fontFamily: string
  fontSource: 'CUSTOM' | 'PRESET'
  fontUrl: string | null
}

export const platformFontPresets = [
  { displayName: '平台默认', family: '"Smiley Sans", "Microsoft YaHei", "PingFang SC", system-ui, sans-serif' },
  { displayName: '系统中文无衬线', family: '"Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", system-ui, sans-serif' },
  { displayName: '系统中文衬线', family: '"Songti SC", SimSun, "Noto Serif CJK SC", serif' },
  { displayName: '系统等宽', family: '"JetBrains Mono", "SFMono-Regular", Consolas, monospace' },
] as const

const defaultFamily = platformFontPresets[0].family
const customFaceName = 'CQUPT Custom Font'
let activeCustomFace: FontFace | null = null
let applyRevision = 0

function mutableFontSet() {
  return document.fonts as FontFaceSet & { add: (font: FontFace) => FontFaceSet; delete: (font: FontFace) => boolean }
}

export async function applyPlatformFont(appearance?: Partial<PlatformFontAppearance>) {
  const revision = ++applyRevision
  let family = appearance?.fontFamily || defaultFamily
  if (appearance?.fontSource === 'CUSTOM' && appearance.fontUrl) {
    try {
      const fontUrl = appearance.fontUrl.startsWith('/public/') ? `${API_BASE_URL}${appearance.fontUrl}` : appearance.fontUrl
      const face = new FontFace(customFaceName, `url("${fontUrl}")`, { display: 'swap' })
      await Promise.race([
        face.load(),
        new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error('字体加载超时')), 8000)),
      ])
      if (revision !== applyRevision) return
      if (activeCustomFace) mutableFontSet().delete(activeCustomFace)
      mutableFontSet().add(face)
      activeCustomFace = face
      family = `"${customFaceName}", "Microsoft YaHei", "PingFang SC", system-ui, sans-serif`
    } catch {
      family = defaultFamily
    }
  } else if (activeCustomFace) {
    mutableFontSet().delete(activeCustomFace)
    activeCustomFace = null
  }
  if (revision !== applyRevision) return
  document.documentElement.style.setProperty('--platform-font-family', family)
  document.documentElement.style.setProperty('--font-sans', family)
}
import { API_BASE_URL } from '../services/apiClient'
