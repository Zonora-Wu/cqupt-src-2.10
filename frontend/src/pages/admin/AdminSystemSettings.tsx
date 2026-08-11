import {
  AlertTriangle,
  Bot,
  Building2,
  CheckCircle,
  DatabaseBackup,
  Edit3,
  FileBadge2,
  FileText,
  KeyRound,
  Mail,
  Moon,
  Palette,
  Paintbrush,
  Save,
  ServerCog,
  ShieldCheck,
  ShieldQuestion,
  SlidersHorizontal,
  Sun,
  Upload,
  UserCheck,
  UserX,
  X,
} from 'lucide-react'
import { type ReactNode, type RefObject, useEffect, useRef, useState } from 'react'
import { FloatingNotice, type FloatingNoticeVariant } from '../../components/ui/FloatingNotice'
import { PageHeader } from '../../components/ui/PageHeader'
import { SelectInput } from '../../components/ui/SelectInput'
import { SurfacePanel } from '../../components/ui/SurfacePanel'
import {
  approveRegistration,
  getCertificateTemplateBackgroundPreview,
  getCertificateSealPreview,
  getActiveCertificateTemplate,
  getAiAssistantAppearance,
  getAiQuotaSettings,
  getEmailServiceSettings,
  getPlatformSettings,
  getRegistrationMode,
  listPendingRegistrations,
  previewCertificateTemplate,
  rejectRegistration,
  resetPlatformLogo,
  setRegistrationMode,
  testEmailService,
  updateCertificateTemplateLayout,
  updateEmailServiceSettings,
  updatePlatformSettings,
  uploadAiAssistantAvatar,
  uploadPlatformLogo,
  updateAiQuotaSettings,
  uploadCertificateSeal,
  uploadCertificateTemplateBackground,
} from '../../services/systemSettings'
import type { AiQuotaSettings, CertificateTemplateSummary, EmailServiceSettings, PendingRegistrationItem, PlatformLogoMode, PlatformLogoSlot, SmtpSecureMode } from '../../services/systemSettings'
import {
  createSecurityQuestions,
  deleteSecurityQuestion,
  generateSecurityQuestionsWithAi,
  generateSecurityQuestionsFromKnowledgeFile,
  getSecurityExamSettings,
  importSecurityQuestionsFile,
  listSecurityQuestions,
  replaceSecurityQuestion,
  updateSecurityQuestion,
  updateSecurityExamSettings,
  type SecurityExamSettings,
  type SecurityQuestionAdmin,
  type SecurityQuestionInput,
  type SecurityQuestionType,
} from '../../services/securityExam'
import {
  getCurrentResponsibilityAgreementForAdmin,
  publishResponsibilityAgreement,
  type AdminResponsibilityAgreement,
} from '../../services/responsibilityAgreementAdmin'
import {
  applyBrandTheme,
  brandColorSlots,
  brandShades,
  formatHexInput,
  generateBrandPalette,
  normalizeBrandPaletteOverrides,
  normalizeHexColor,
  type BrandPalette,
  type BrandColorSlot,
} from '../../utils/brandTheme'
import { applyPlatformBranding, defaultPlatformLogos, getPlatformLogos, subscribePlatformBranding } from '../../utils/platformBranding'
import { AdminAiPolicyPanel } from '../../components/ai/AdminAiPolicyPanel'
import { AdminAiModelConfigurationLauncher } from '../../components/ai/AiModelConfigurationLauncher'

type SettingsSection =
  | '基础设置'
  | '邮宝'
  | '登录与认证'
  | '邮箱与通知'
  | '漏洞流程'
  | '证书模板'
  | '安全与审计'
  | '系统维护'

type ConfirmState = {
  title: string
  description: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
} | null

type AiQuotaPeriod = AiQuotaSettings['quotaPeriod']
const smtpSecureModeOptions: SmtpSecureMode[] = ['SSL', 'STARTTLS', 'NONE']
const smtpSecureModeLabels: Record<SmtpSecureMode, string> = {
  NONE: '无',
  SSL: 'SSL',
  STARTTLS: 'STARTTLS',
}
const platformLogoModeLabels: Record<PlatformLogoMode, string> = {
  dark: '黑夜',
  light: '白天',
}

function getAppliedThemeColor() {
  if (typeof document === 'undefined') return '#2A6438'
  const currentThemeColor = getComputedStyle(document.documentElement).getPropertyValue('--app-primary').trim()
  return normalizeHexColor(currentThemeColor) ?? '#2A6438'
}

function getAppliedThemePalette(themeColor = getAppliedThemeColor()): BrandPalette {
  const generatedPalette = createEditableThemePalette(themeColor)
  if (typeof document === 'undefined') return generatedPalette

  const styles = getComputedStyle(document.documentElement)
  const palette = brandShades.reduce((nextPalette, shade) => {
    const color = normalizeHexColor(styles.getPropertyValue(`--color-brand-${shade}`).trim())
    nextPalette[shade] = color ?? generatedPalette[shade]
    return nextPalette
  }, {} as BrandPalette)

  brandColorSlots.forEach((slot) => {
    const cssVariable = `--app-${slot.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)}`
    const color = normalizeHexColor(styles.getPropertyValue(cssVariable).trim())
    palette[slot] = color ?? generatedPalette[slot]
  })

  return generateBrandPalette(palette.primary, palette)
}

function serializeThemePalette(themeColor: string, palette: BrandPalette) {
  const normalizedThemeColor = normalizeHexColor(themeColor) ?? palette.primary
  const completePalette = generateBrandPalette(normalizedThemeColor, palette)
  return [...brandColorSlots, ...brandShades].reduce<Record<string, string>>((payload, key) => {
    const color = normalizeHexColor(completePalette[key] ?? '')
    if (color) payload[String(key)] = color
    return payload
  }, {})
}

const appearanceDraftStorageKey = 'cqupt-src-admin-appearance-draft'

const brandColorSlotMeta: Record<BrandColorSlot, { group: '白天模式' | '黑夜模式' | '主颜色'; label: string; usage: string }> = {
  lightBg: { group: '白天模式', label: '页面背景', usage: '页面底色、顶部栏和菜单底色' },
  lightSurface: { group: '白天模式', label: '内容面板', usage: '卡片、输入框和弹窗主体' },
  lightMuted: { group: '白天模式', label: '弱化底色', usage: '次级卡片、信息块和轻悬停' },
  lightBorder: { group: '白天模式', label: '边框分割', usage: '边框、分割线和禁用边界' },
  lightText: { group: '白天模式', label: '正文文字', usage: '标题、正文和中性图标' },
  darkBg: { group: '黑夜模式', label: '页面背景', usage: '深色页面底色、顶部栏和菜单底色' },
  darkSurface: { group: '黑夜模式', label: '内容面板', usage: '深色卡片、输入框和弹窗主体' },
  darkMuted: { group: '黑夜模式', label: '弱化底色', usage: '深色次级卡片、信息块和轻悬停' },
  darkBorder: { group: '黑夜模式', label: '边框分割', usage: '深色边框、分割线和禁用边界' },
  darkText: { group: '黑夜模式', label: '正文文字', usage: '深色模式标题、正文和中性图标' },
  primary: { group: '主颜色', label: '主按钮/强调', usage: '主按钮、选中态、链接、重点图标和进度条' },
}

const visibleLightPaletteSlots: BrandColorSlot[] = ['lightBg', 'lightSurface', 'lightMuted', 'lightBorder', 'lightText']
const visibleDarkPaletteSlots: BrandColorSlot[] = ['darkBg', 'darkSurface', 'darkMuted', 'darkBorder', 'darkText']

function createEditableThemePalette(themeColor: string, value?: unknown): BrandPalette {
  return generateBrandPalette(themeColor, normalizeBrandPaletteOverrides(value))
}

function areThemePalettesEqual(left: BrandPalette, right: BrandPalette) {
  return [...brandColorSlots, ...brandShades].every((key) => left[key] === right[key])
}

function readAppearanceDraft() {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.sessionStorage.getItem(appearanceDraftStorageKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { themeColor?: unknown; themePalette?: unknown }
    if (typeof parsed.themeColor !== 'string') return null
    const themeColor = normalizeHexColor(parsed.themeColor)
    if (!themeColor) return null
    const themePalette = createEditableThemePalette(themeColor, parsed.themePalette)
    return { themeColor, themePalette }
  } catch {
    return null
  }
}

function writeAppearanceDraft(themeColor: string, themePalette: BrandPalette) {
  if (typeof window === 'undefined') return
  const normalizedThemeColor = normalizeHexColor(themeColor)
  if (!normalizedThemeColor) return

  try {
    window.sessionStorage.setItem(
      appearanceDraftStorageKey,
      JSON.stringify({
        themeColor: normalizedThemeColor,
        themePalette: serializeThemePalette(normalizedThemeColor, themePalette),
        updatedAt: Date.now(),
      }),
    )
  } catch {
    // Preview still works even if the browser blocks sessionStorage.
  }
}

function clearAppearanceDraft() {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(appearanceDraftStorageKey)
  } catch {
    // Ignore storage failures; backend state remains authoritative after save.
  }
}

function getPlatformLogoUrlState(value: {
  authLogoUrl?: string | null
  authLogoUrlDark?: string | null
  faviconUrl?: string | null
  logoUrl?: string | null
  navigationLogoUrl?: string | null
  navigationLogoUrlDark?: string | null
}): Record<PlatformLogoSlot, string | null> {
  return {
    auth: value.authLogoUrl ?? value.logoUrl ?? null,
    favicon: value.faviconUrl ?? value.logoUrl ?? null,
    navigation: value.navigationLogoUrl ?? value.logoUrl ?? null,
  }
}

function getDisplayedPlatformLogoState(value: {
  authLogoUrl?: string | null
  authLogoUrlDark?: string | null
  faviconUrl?: string | null
  logoUrl?: string | null
  navigationLogoUrl?: string | null
  navigationLogoUrlDark?: string | null
}): Record<PlatformLogoSlot, string | null> {
  const persisted = getPlatformLogoUrlState(value)
  const applied = getPlatformLogos()
  const appliedState: Record<PlatformLogoSlot, string | null> = {
    auth: applied.authLogoUrl === defaultPlatformLogos.authLogoUrl ? null : applied.authLogoUrl,
    favicon: applied.faviconUrl === defaultPlatformLogos.faviconUrl ? null : applied.faviconUrl,
    navigation: applied.navigationLogoUrl === defaultPlatformLogos.navigationLogoUrl ? null : applied.navigationLogoUrl,
  }

  return {
    auth: appliedState.auth ?? persisted.auth,
    favicon: appliedState.favicon ?? persisted.favicon,
    navigation: appliedState.navigation ?? persisted.navigation,
  }
}

function getPlatformLogoUrl(logos: ReturnType<typeof getPlatformLogos>, slot: PlatformLogoSlot, mode: PlatformLogoMode) {
  if (slot === 'favicon') return logos.faviconUrl
  if (slot === 'auth') return mode === 'dark' ? logos.authLogoUrlDark : logos.authLogoUrl
  return mode === 'dark' ? logos.navigationLogoUrlDark : logos.navigationLogoUrl
}

function getDefaultPlatformLogoUrl(slot: PlatformLogoSlot, mode: PlatformLogoMode) {
  if (slot === 'favicon') return defaultPlatformLogos.faviconUrl
  if (slot === 'auth') return mode === 'dark' ? defaultPlatformLogos.authLogoUrlDark : defaultPlatformLogos.authLogoUrl
  return mode === 'dark' ? defaultPlatformLogos.navigationLogoUrlDark : defaultPlatformLogos.navigationLogoUrl
}

type CertificateLayoutKey =
  | 'certificateNo'
  | 'recipientName'
  | 'reportNo'
  | 'severity'
  | 'issuedAt'
  | 'certificateType'
  | 'seal'

type CertificateLayoutPoint = {
  align?: 'center' | 'left' | 'right'
  fontSize?: number
  height?: number
  width?: number
  x: number
  y: number
}

type CertificateFontFamily = 'notoSansCjk' | 'simHei' | 'microsoftYaHei' | 'systemSans'

type CertificateLayoutConfig = Record<CertificateLayoutKey, CertificateLayoutPoint> & {
  fontFamily: CertificateFontFamily
}

type CertificateCanvasSize = {
  height: number
  width: number
}

const defaultCertificateCanvasSize: CertificateCanvasSize = { height: 595, width: 842 }

const certificateFontOptions: Array<{ label: string; value: CertificateFontFamily; css: string }> = [
  { label: '思源黑体', value: 'notoSansCjk', css: '"Noto Sans CJK SC", "Noto Sans SC", sans-serif' },
  { label: '黑体', value: 'simHei', css: 'SimHei, "Noto Sans CJK SC", sans-serif' },
  { label: '微软雅黑', value: 'microsoftYaHei', css: '"Microsoft YaHei", "Noto Sans CJK SC", sans-serif' },
  { label: '系统无衬线', value: 'systemSans', css: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
]

const certificateLayoutFields: Array<{ key: CertificateLayoutKey; label: string; sample: string; type: 'seal' | 'text' }> = [
  { key: 'certificateNo', label: '证书编号', sample: 'CQUPT-SRC-CERT-2026-A1B2C3', type: 'text' },
  { key: 'recipientName', label: '获得者姓名', sample: '张三', type: 'text' },
  { key: 'reportNo', label: '漏洞编号', sample: 'CQUPT-SRC-20260525-A1B2C3', type: 'text' },
  { key: 'severity', label: '漏洞等级', sample: '高危', type: 'text' },
  { key: 'issuedAt', label: '颁发日期', sample: '2026 年 05 月 25 日', type: 'text' },
  { key: 'certificateType', label: '证书类型', sample: '漏洞贡献证书', type: 'text' },
  { key: 'seal', label: '电子印章', sample: '印章', type: 'seal' },
]

const defaultCertificateLayout: CertificateLayoutConfig = {
  certificateNo: { fontSize: 28, x: 90, y: 74 },
  certificateType: { align: 'center', fontSize: 28, x: 421, y: 150 },
  fontFamily: 'notoSansCjk',
  issuedAt: { fontSize: 28, x: 420, y: 520 },
  recipientName: { align: 'center', fontSize: 28, x: 421, y: 220 },
  reportNo: { fontSize: 28, x: 118, y: 424 },
  seal: { width: 120, x: 450, y: 430 },
  severity: { fontSize: 28, x: 118, y: 456 },
}

const aiQuotaPeriodLabels: Record<AiQuotaPeriod, string> = {
  DAY: '每日重置',
  MONTH: '每月重置',
  WEEK: '每周重置',
}

const aiQuotaPeriodValues: Record<string, AiQuotaPeriod> = {
  每日重置: 'DAY',
  每周重置: 'WEEK',
  每月重置: 'MONTH',
}

const settingSections: Array<{ label: SettingsSection; icon: ReactNode; description: string }> = [
  { label: '基础设置', icon: <Building2 className="h-4 w-4" />, description: '品牌、组织、交付方式' },
  { label: '邮宝', icon: <Bot className="h-4 w-4" />, description: '助手形象、模型入口' },
  { label: '登录与认证', icon: <KeyRound className="h-4 w-4" />, description: '注册、认证、账号安全' },
  { label: '邮箱与通知', icon: <Mail className="h-4 w-4" />, description: 'SMTP、站内信、模板' },
  { label: '漏洞流程', icon: <ShieldQuestion className="h-4 w-4" />, description: '审核流、时限、规则' },
  { label: '证书模板', icon: <FileBadge2 className="h-4 w-4" />, description: 'PDF、签章、公开核验' },
  { label: '安全与审计', icon: <ShieldCheck className="h-4 w-4" />, description: '准入、脱敏、日志' },
  { label: '系统维护', icon: <ServerCog className="h-4 w-4" />, description: '部署、备份、配置迁移' },
]

const platformLogoSlots: Array<{
  description: string
  preview: 'favicon' | 'square' | 'wide'
  recommended: string
  slot: PlatformLogoSlot
  title: string
}> = [
  {
    description: '用于各端顶部导航区域的横版品牌图标。',
    preview: 'wide',
    recommended: '建议使用横版透明 PNG，默认使用公共图标库占位，旧资产在备选中。',
    slot: 'navigation',
    title: '菜单栏图标',
  },
  {
    description: '用于登录和注册弹窗顶部的大尺寸品牌图标。',
    preview: 'square',
    recommended: '建议使用居中构图透明 PNG，默认使用公共图标库占位，旧资产在备选中。',
    slot: 'auth',
    title: '登录注册弹窗图标',
  },
  {
    description: '用于浏览器标签页、收藏夹和窗口标题栏。',
    preview: 'favicon',
    recommended: '建议使用正方形 PNG / WebP，默认使用公共图标库占位，旧资产在备选中。',
    slot: 'favicon',
    title: '浏览器标签页图标',
  },
]

const legacyPlatformLogoAlternatives: Record<PlatformLogoSlot, Array<{ darkUrl?: string; label: string; lightUrl: string }>> = {
  auth: [
    { darkUrl: '/assets/logos/CQUPT_02_logo_dark.png', label: 'CQUPT 旧版', lightUrl: '/assets/logos/CQUPT_02_logo.png' },
  ],
  favicon: [
    { label: 'CQUPT 旧版高清', lightUrl: '/assets/logos/CQUPT_01_logo_1024px.png' },
  ],
  navigation: [
    { darkUrl: '/assets/logos/CQUPT_03_logo_dark.png', label: 'CQUPT 旧版', lightUrl: '/assets/logos/CQUPT_03_logo.png' },
  ],
}

export function AdminSystemSettings() {
  const templateInputRef = useRef<HTMLInputElement | null>(null)
  const sealInputRef = useRef<HTMLInputElement | null>(null)
  const aiAvatarInputRef = useRef<HTMLInputElement | null>(null)
  const platformLogoInputRefs = useRef<Record<PlatformLogoSlot, HTMLInputElement | null>>({
    auth: null,
    favicon: null,
    navigation: null,
  })
  const questionBankInputRef = useRef<HTMLInputElement | null>(null)
  const knowledgeBaseInputRef = useRef<HTMLInputElement | null>(null)
  const responsibilityAgreementInputRef = useRef<HTMLInputElement | null>(null)
  const [activeSection, setActiveSection] = useState<SettingsSection>('基础设置')
  const [confirmState, setConfirmState] = useState<ConfirmState>(null)
  const [platformName, setPlatformName] = useState('CQUPT-SRC 校园漏洞响应平台')
  const [schoolName, setSchoolName] = useState('重庆邮电大学')
  const [orgName, setOrgName] = useState('信息化办公室')
  const [themeColor, setThemeColor] = useState(() => getAppliedThemeColor())
  const [themePalette, setThemePalette] = useState<BrandPalette>(() => getAppliedThemePalette())
  const [savedThemeColor, setSavedThemeColor] = useState(() => getAppliedThemeColor())
  const [savedThemePalette, setSavedThemePalette] = useState<BrandPalette>(() => getAppliedThemePalette())
  const [editingPaletteKey, setEditingPaletteKey] = useState<BrandColorSlot | null>(null)
  const [paletteDraftColor, setPaletteDraftColor] = useState('')
  const [canApplyThemePreview, setCanApplyThemePreview] = useState(false)
  const [appliedPlatformLogos, setAppliedPlatformLogos] = useState(() => getPlatformLogos())
  const [platformLogoMode, setPlatformLogoMode] = useState<PlatformLogoMode>('light')
  const [isSavingPlatform, setIsSavingPlatform] = useState(false)
  const [isSavingAppearance, setIsSavingAppearance] = useState(false)
  const [uploadingPlatformLogoSlot, setUploadingPlatformLogoSlot] = useState<PlatformLogoSlot | null>(null)
  const [platformMessage, setPlatformMessage] = useState('')
  const [appearanceMessage, setAppearanceMessage] = useState('')
  const [notice, setNotice] = useState<{ message: string; title?: string; variant: FloatingNoticeVariant } | null>(null)
  const [openRegister, setOpenRegister] = useState(true)
  const [pendingRegistrations, setPendingRegistrations] = useState<PendingRegistrationItem[]>([])
  const [pendingRegLoading, setPendingRegLoading] = useState(false)
  const [emailVerify, setEmailVerify] = useState(true)
  const [publicCertVerify, setPublicCertVerify] = useState(true)
  const [certificateTemplate, setCertificateTemplate] = useState<CertificateTemplateSummary | null>(null)
  const [certificateTemplateMessage, setCertificateTemplateMessage] = useState('')
  const [isUploadingTemplate, setIsUploadingTemplate] = useState(false)
  const [isPreviewingPdf, setIsPreviewingPdf] = useState(false)
  const [coordinateEditorOpen, setCoordinateEditorOpen] = useState(false)
  const [coordinatePreviewUrl, setCoordinatePreviewUrl] = useState('')
  const [coordinateSealUrl, setCoordinateSealUrl] = useState('')
  const [coordinateCanvasSize, setCoordinateCanvasSize] = useState<CertificateCanvasSize>(defaultCertificateCanvasSize)
  const [coordinateSealSize, setCoordinateSealSize] = useState<CertificateCanvasSize | null>(null)
  const [coordinateLayout, setCoordinateLayout] = useState<CertificateLayoutConfig>(defaultCertificateLayout)
  const [isSavingCoordinateLayout, setIsSavingCoordinateLayout] = useState(false)
  const [aiAvatarUrl, setAiAvatarUrl] = useState<string | null>(null)
  const [aiAvatarMessage, setAiAvatarMessage] = useState('')
  const [isUploadingAiAvatar, setIsUploadingAiAvatar] = useState(false)
  const [defaultAiDailyTokens, setDefaultAiDailyTokens] = useState('20000')
  const [defaultAiWeeklyTokens, setDefaultAiWeeklyTokens] = useState('60000')
  const [defaultAiMonthlyTokens, setDefaultAiMonthlyTokens] = useState('100000')
  const [aiQuotaPeriod, setAiQuotaPeriod] = useState<AiQuotaPeriod>('MONTH')
  const [aiQuotaResetAt, setAiQuotaResetAt] = useState<string | null>(null)
  const [aiQuotaMessage, setAiQuotaMessage] = useState('')
  const [isSavingAiQuota, setIsSavingAiQuota] = useState(false)
  const [smtpEnabled, setSmtpEnabled] = useState(false)
  const [smtpHost, setSmtpHost] = useState('')
  const [smtpPort, setSmtpPort] = useState('465')
  const [smtpFromEmail, setSmtpFromEmail] = useState('')
  const [smtpFromName, setSmtpFromName] = useState('CQUPT-SRC')
  const [smtpUsername, setSmtpUsername] = useState('')
  const [smtpPassword, setSmtpPassword] = useState('')
  const [smtpPasswordConfigured, setSmtpPasswordConfigured] = useState(false)
  const [smtpReplyTo, setSmtpReplyTo] = useState('')
  const [smtpSecureMode, setSmtpSecureMode] = useState<SmtpSecureMode>('SSL')
  const [smtpTestRecipient, setSmtpTestRecipient] = useState('')
  const [smtpMessage, setSmtpMessage] = useState('')
  const [isSavingSmtp, setIsSavingSmtp] = useState(false)
  const [isTestingSmtp, setIsTestingSmtp] = useState(false)
  const [securityExamSettings, setSecurityExamSettings] = useState<SecurityExamSettings | null>(null)
  const [securityQuestions, setSecurityQuestions] = useState<SecurityQuestionAdmin[]>([])
  const [questionBankJson, setQuestionBankJson] = useState('')
  const [questionAiTopic, setQuestionAiTopic] = useState('面向大一学生的网络安全法律法规、授权测试边界与渗透测试禁忌')
  const [questionMessage, setQuestionMessage] = useState('')
  const [isQuestionBusy, setIsQuestionBusy] = useState(false)
  const [questionEditorOpen, setQuestionEditorOpen] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<SecurityQuestionAdmin | null>(null)
  const [replacingQuestion, setReplacingQuestion] = useState<SecurityQuestionAdmin | null>(null)
  const [responsibilityAgreement, setResponsibilityAgreement] = useState<AdminResponsibilityAgreement>(null)
  const [responsibilityAgreementEditorOpen, setResponsibilityAgreementEditorOpen] = useState(false)
  const [responsibilityAgreementTitle, setResponsibilityAgreementTitle] = useState('CQUPT-SRC 校园网络安全测试责任书')
  const [responsibilityAgreementContent, setResponsibilityAgreementContent] = useState('')
  const [isSavingResponsibilityAgreement, setIsSavingResponsibilityAgreement] = useState(false)

  const confirmChange = (nextState: Exclude<ConfirmState, null>) => {
    setConfirmState(nextState)
  }

  const showNotice = (message: string, variant: FloatingNoticeVariant = 'success', title?: string) => {
    setNotice({ message, title, variant })
  }

  const applyEmailServiceSettings = (settings: EmailServiceSettings) => {
    setSmtpEnabled(settings.enabled)
    setSmtpHost(settings.host)
    setSmtpPort(String(settings.port))
    setSmtpFromEmail(settings.fromEmail)
    setSmtpFromName(settings.fromName)
    setSmtpUsername(settings.username)
    setSmtpPassword('')
    setSmtpPasswordConfigured(settings.passwordConfigured)
    setSmtpReplyTo(settings.replyTo)
    setSmtpSecureMode(settings.secureMode)
    setSmtpTestRecipient((current) => current || settings.fromEmail)
  }

  useEffect(() => {
    setAppliedPlatformLogos(getPlatformLogos())
    return subscribePlatformBranding(setAppliedPlatformLogos)
  }, [])

  useEffect(() => {
    let active = true

    void getAiAssistantAppearance()
      .then((appearance) => {
        if (active) setAiAvatarUrl(appearance.avatarUrl)
      })
      .catch((error) => {
        if (active) setAiAvatarMessage(error instanceof Error ? error.message : '邮宝头像加载失败')
      })

    async function loadInitialData() {
      try {
        const [mode, template, platform, aiQuota, emailService] = await Promise.all([
          getRegistrationMode(),
          getActiveCertificateTemplate(),
          getPlatformSettings(),
          getAiQuotaSettings(),
          getEmailServiceSettings(),
        ])
        if (active) {
          setOpenRegister(mode.open)
          setCertificateTemplate(template)
          setPlatformName(platform.platformName)
          setSchoolName(platform.schoolName)
          setOrgName(platform.orgName)
          setPublicCertVerify(platform.publicCertVerify)
          const savedPalette = createEditableThemePalette(platform.themeColor, platform.themePalette)
          const draft = readAppearanceDraft()
          const appliedThemeColor = getAppliedThemeColor()
          const appliedThemePalette = getAppliedThemePalette(appliedThemeColor)
          const savedPaletteIsGenerated = areThemePalettesEqual(savedPalette, generateBrandPalette(platform.themeColor))
          const shouldRestoreDraft = Boolean(
            draft && (
              draft.themeColor !== platform.themeColor ||
              !areThemePalettesEqual(draft.themePalette, savedPalette)
            ),
          )
          const shouldRestoreAppliedPalette = !shouldRestoreDraft && savedPaletteIsGenerated && (
            appliedThemeColor !== platform.themeColor ||
            !areThemePalettesEqual(appliedThemePalette, savedPalette)
          )
          const nextThemeColor = shouldRestoreDraft && draft
            ? draft.themeColor
            : shouldRestoreAppliedPalette
              ? appliedThemeColor
              : platform.themeColor
          const nextThemePalette = shouldRestoreDraft && draft
            ? draft.themePalette
            : shouldRestoreAppliedPalette
              ? appliedThemePalette
              : savedPalette

          if (!shouldRestoreDraft) clearAppearanceDraft()
          if (shouldRestoreAppliedPalette) writeAppearanceDraft(nextThemeColor, nextThemePalette)

          setThemeColor(nextThemeColor)
          setSavedThemeColor(platform.themeColor)
          setSavedThemePalette(savedPalette)
          setThemePalette(nextThemePalette)
          setCanApplyThemePreview(true)
          if (shouldRestoreDraft) {
            setAppearanceMessage('已恢复未保存的外观草稿，确认无误后点击“保存外观设置”全局保存。')
            showNotice('已恢复你上次未保存的色卡草稿。', 'info', '外观草稿已恢复')
          } else if (shouldRestoreAppliedPalette) {
            setAppearanceMessage('已从当前页面生效主题恢复外观草稿，确认无误后点击“保存外观设置”全局保存。')
            showNotice('已从当前生效主题恢复色卡显示。', 'info', '外观草稿已恢复')
          }
          const displayedLogoState = getDisplayedPlatformLogoState(platform)
          applyPlatformBranding({
            ...platform,
            authLogoUrl: displayedLogoState.auth,
            faviconUrl: displayedLogoState.favicon,
            navigationLogoUrl: displayedLogoState.navigation,
          })
          setDefaultAiDailyTokens(String(aiQuota.defaultDailyTokens))
          setDefaultAiWeeklyTokens(String(aiQuota.defaultWeeklyTokens))
          setDefaultAiMonthlyTokens(String(aiQuota.defaultMonthlyTokens))
          setAiQuotaPeriod(aiQuota.quotaPeriod)
          setAiQuotaResetAt(aiQuota.resetAt)
          applyEmailServiceSettings(emailService)
        }
      } catch (error) {
        if (active) {
          setCertificateTemplateMessage(error instanceof Error ? error.message : '设置信息加载失败')
        }
      }
    }

    void loadInitialData()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!canApplyThemePreview) return
    const normalizedThemeColor = normalizeHexColor(themeColor)
    if (!normalizedThemeColor) return
    applyBrandTheme(normalizedThemeColor, themePalette)
  }, [canApplyThemePreview, themeColor, themePalette])

  // Load pending registrations when entering the auth section and registration is closed
  useEffect(() => {
    if (activeSection !== '登录与认证') return

    let active = true
    setPendingRegLoading(true)

    listPendingRegistrations()
      .then((items) => { if (active) setPendingRegistrations(items) })
      .catch(() => {})
      .finally(() => { if (active) setPendingRegLoading(false) })

    return () => { active = false }
  }, [activeSection])

  useEffect(() => {
    if (activeSection !== '证书模板') return

    let active = true
    getActiveCertificateTemplate()
      .then((template) => {
        if (active) setCertificateTemplate(template)
      })
      .catch((error) => {
        if (active) setCertificateTemplateMessage(error instanceof Error ? error.message : '证书模板信息加载失败')
      })

    return () => { active = false }
  }, [activeSection])

  useEffect(() => {
    if (coordinateEditorOpen) return
    if (coordinatePreviewUrl) URL.revokeObjectURL(coordinatePreviewUrl)
    if (coordinateSealUrl) URL.revokeObjectURL(coordinateSealUrl)
    setCoordinatePreviewUrl('')
    setCoordinateSealUrl('')
    setCoordinateSealSize(null)
  }, [coordinateEditorOpen, coordinatePreviewUrl, coordinateSealUrl])

  useEffect(() => {
    return () => {
      if (coordinatePreviewUrl) URL.revokeObjectURL(coordinatePreviewUrl)
      if (coordinateSealUrl) URL.revokeObjectURL(coordinateSealUrl)
    }
  }, [coordinatePreviewUrl, coordinateSealUrl])

  const handleApproveRegistration = async (id: string) => {
    await approveRegistration(id)
    setPendingRegistrations((prev) => prev.filter((item) => item.id !== id))
  }

  useEffect(() => {
    if (activeSection !== '安全与审计') return
    let active = true
    Promise.all([getSecurityExamSettings(), listSecurityQuestions(), getCurrentResponsibilityAgreementForAdmin()])
      .then(([settings, questions, agreement]) => {
        if (!active) return
        setSecurityExamSettings(settings)
        setSecurityQuestions(questions)
        setResponsibilityAgreement(agreement)
      })
      .catch((error) => {
        if (active) setQuestionMessage(error instanceof Error ? error.message : '安全题库加载失败')
      })
    return () => { active = false }
  }, [activeSection])

  const refreshQuestionBank = async () => {
    const [settings, questions] = await Promise.all([getSecurityExamSettings(), listSecurityQuestions()])
    setSecurityExamSettings(settings)
    setSecurityQuestions(questions)
  }

  const handleCreateQuestionsFromJson = async () => {
    setQuestionMessage('')
    try {
      setIsQuestionBusy(true)
      const parsed = JSON.parse(questionBankJson)
      const result = await createSecurityQuestions(Array.isArray(parsed) ? parsed : parsed.questions)
      await refreshQuestionBank()
      setQuestionBankJson('')
      setQuestionMessage(`已入库 ${result.count} 道题。`)
    } catch (error) {
      setQuestionMessage(error instanceof Error ? error.message : '题库 JSON 解析或入库失败')
    } finally {
      setIsQuestionBusy(false)
    }
  }

  const handleGenerateQuestions = async () => {
    setQuestionMessage('')
    try {
      setIsQuestionBusy(true)
      const result = await generateSecurityQuestionsWithAi({ difficulty: '入门', topic: questionAiTopic })
      await refreshQuestionBank()
      const message = `AI 已生成并入库 ${result.count} 道题。`
      setQuestionMessage(message)
      showNotice(message, 'success', '题库已更新')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI 出题失败'
      setQuestionMessage(message)
      showNotice(message, 'error', 'AI 出题失败')
    } finally {
      setIsQuestionBusy(false)
    }
  }

  const handleImportQuestionFile = async (file: File | undefined) => {
    if (!file) return
    setQuestionMessage('')
    try {
      setIsQuestionBusy(true)
      const result = await importSecurityQuestionsFile(file)
      await refreshQuestionBank()
      setQuestionMessage(`AI 已分析文件并入库 ${result.count} 道题。`)
    } catch (error) {
      setQuestionMessage(error instanceof Error ? error.message : '题库文件导入失败')
    } finally {
      setIsQuestionBusy(false)
      if (questionBankInputRef.current) questionBankInputRef.current.value = ''
    }
  }

  const handleGenerateQuestionsFromKnowledgeFile = async (file: File | undefined) => {
    if (!file) return
    setQuestionMessage('')
    try {
      setIsQuestionBusy(true)
      const result = await generateSecurityQuestionsFromKnowledgeFile(file)
      await refreshQuestionBank()
      setQuestionMessage(`已依据知识库生成并入库 ${result.count} 道题（10 单选、5 判断、5 多选）。`)
    } catch (error) {
      setQuestionMessage(error instanceof Error ? error.message : '知识库题目生成失败')
    } finally {
      setIsQuestionBusy(false)
      if (knowledgeBaseInputRef.current) knowledgeBaseInputRef.current.value = ''
    }
  }

  const openQuestionEditor = (question: SecurityQuestionAdmin | null = null, replace = false) => {
    setEditingQuestion(replace ? null : question)
    setReplacingQuestion(replace ? question : null)
    setQuestionEditorOpen(true)
  }

  const saveQuestionFromEditor = async (question: SecurityQuestionInput) => {
    try {
      setIsQuestionBusy(true)
      if (replacingQuestion) {
        await replaceSecurityQuestion(replacingQuestion.id, question)
        setQuestionMessage('题目已替换，原题已从当前题库移除。')
      } else if (editingQuestion) {
        await updateSecurityQuestion(editingQuestion.id, question)
        setQuestionMessage('题目已更新。')
      } else {
        await createSecurityQuestions([question])
        setQuestionMessage('题目已添加。')
      }
      await refreshQuestionBank()
      setQuestionEditorOpen(false)
      setEditingQuestion(null)
      setReplacingQuestion(null)
    } catch (error) {
      setQuestionMessage(error instanceof Error ? error.message : '题目保存失败')
    } finally {
      setIsQuestionBusy(false)
    }
  }

  const deleteQuestionFromEditor = (question: SecurityQuestionAdmin) => {
    confirmChange({
      danger: true,
      description: '删除后题目不会再进入新试卷，历史答题记录仍会保留。请确认该题不再需要。',
      title: '确认删除此题？',
      onConfirm: () => {
        void (async () => {
          try {
            setIsQuestionBusy(true)
            await deleteSecurityQuestion(question.id)
            await refreshQuestionBank()
            setQuestionMessage('题目已删除。')
            setQuestionEditorOpen(false)
            setEditingQuestion(null)
            setReplacingQuestion(null)
          } catch (error) {
            setQuestionMessage(error instanceof Error ? error.message : '题目删除失败')
          } finally {
            setIsQuestionBusy(false)
          }
        })()
      },
    })
  }

  const handleToggleSecurityExam = async () => {
    const next = !(securityExamSettings?.enabled ?? true)
    const threshold = securityExamSettings?.threshold ?? 80
    const updated = await updateSecurityExamSettings({ enabled: next, threshold })
    setSecurityExamSettings(updated)
  }

  const openResponsibilityAgreementEditor = () => {
    setResponsibilityAgreementTitle(responsibilityAgreement?.title ?? 'CQUPT-SRC 校园网络安全测试责任书')
    setResponsibilityAgreementContent(responsibilityAgreement?.content ?? '')
    setResponsibilityAgreementEditorOpen(true)
  }

  const handleResponsibilityAgreementFile = async (file: File | undefined) => {
    if (!file) return

    try {
      if (!file.name.toLowerCase().endsWith('.md')) {
        showNotice('仅支持导入 .md 格式的责任书文件。', 'error')
        return
      }
      if (file.size > 512 * 1024) {
        showNotice('责任书文件不能超过 512KB。', 'error')
        return
      }
      setResponsibilityAgreementContent(await file.text())
      showNotice('已导入 Markdown 正文，请检查后发布新版本。', 'success')
    } catch {
      showNotice('责任书文件读取失败，请重新选择。', 'error')
    } finally {
      if (responsibilityAgreementInputRef.current) responsibilityAgreementInputRef.current.value = ''
    }
  }

  const saveResponsibilityAgreement = async () => {
    try {
      setIsSavingResponsibilityAgreement(true)
      const agreement = await publishResponsibilityAgreement({
        content: responsibilityAgreementContent,
        title: responsibilityAgreementTitle,
      })
      setResponsibilityAgreement(agreement)
      setResponsibilityAgreementEditorOpen(false)
      showNotice(`责任书 ${agreement.version} 已发布，用户需签署新版本后才能继续提交漏洞。`, 'success')
    } catch (error) {
      showNotice(error instanceof Error ? error.message : '责任书发布失败，请稍后重试。', 'error')
    } finally {
      setIsSavingResponsibilityAgreement(false)
    }
  }

  const handleRejectRegistration = async (id: string) => {
    await rejectRegistration(id)
    setPendingRegistrations((prev) => prev.filter((item) => item.id !== id))
  }

  const handleOpenCoordinateEditor = async () => {
    if (!certificateTemplate) return
    setCertificateTemplateMessage('')
    setCoordinateLayout(normalizeCertificateLayout(certificateTemplate.layoutJson))
    setCoordinateEditorOpen(true)
    try {
      const preview = await getCertificateTemplateBackgroundPreview()
      setCoordinatePreviewUrl(preview.url)
      setCoordinateCanvasSize({
        height: preview.height ?? defaultCertificateCanvasSize.height,
        width: preview.width ?? defaultCertificateCanvasSize.width,
      })
      if (certificateTemplate.sealConfigured) {
        const seal = await getCertificateSealPreview()
        setCoordinateSealUrl(seal.url)
        setCoordinateSealSize(
          seal.height && seal.width
            ? { height: seal.height, width: seal.width }
            : null,
        )
      } else {
        setCoordinateSealUrl('')
        setCoordinateSealSize(null)
      }
    } catch (error) {
      setCertificateTemplateMessage(error instanceof Error ? error.message : '证书模板预览加载失败')
    }
  }

  const saveCoordinateLayout = async () => {
    setIsSavingCoordinateLayout(true)
    try {
      const next = await updateCertificateTemplateLayout(coordinateLayout)
      setCertificateTemplate(next)
      setCertificateTemplateMessage('证书坐标配置已保存，后续签发将使用新位置。')
      setCoordinateEditorOpen(false)
    } catch (error) {
      setCertificateTemplateMessage(error instanceof Error ? error.message : '证书坐标配置保存失败')
    } finally {
      setIsSavingCoordinateLayout(false)
    }
  }

  const handleTemplateUpload = async (file: File | undefined) => {
    if (!file) return

    setCertificateTemplateMessage('')
    setIsUploadingTemplate(true)

    try {
      const template = await uploadCertificateTemplateBackground(file)
      setCertificateTemplate(template)
      setCertificateTemplateMessage('证书背景模板已上传并启用。')
    } catch (error) {
      setCertificateTemplateMessage(error instanceof Error ? error.message : '证书背景模板上传失败')
    } finally {
      setIsUploadingTemplate(false)
      if (templateInputRef.current) templateInputRef.current.value = ''
    }
  }

  const handleSealUpload = async (file: File | undefined) => {
    if (!file) return

    setCertificateTemplateMessage('')
    setIsUploadingTemplate(true)

    try {
      const template = await uploadCertificateSeal(file)
      setCertificateTemplate(template)
      setCertificateTemplateMessage('电子印章已上传并绑定到当前模板。')
    } catch (error) {
      setCertificateTemplateMessage(error instanceof Error ? error.message : '电子印章上传失败')
    } finally {
      setIsUploadingTemplate(false)
      if (sealInputRef.current) sealInputRef.current.value = ''
    }
  }

  const handlePreviewPdf = async () => {
    setCertificateTemplateMessage('')
    setIsPreviewingPdf(true)
    try {
      await previewCertificateTemplate()
    } catch (error) {
      setCertificateTemplateMessage(error instanceof Error ? error.message : '预览 PDF 生成失败')
    } finally {
      setIsPreviewingPdf(false)
    }
  }

  const handleAiAvatarUpload = async (file: File | undefined) => {
    if (!file) return

    setAiAvatarMessage('')
    setIsUploadingAiAvatar(true)

    try {
      const appearance = await uploadAiAssistantAvatar(file)
      setAiAvatarUrl(appearance.avatarUrl)
      setAiAvatarMessage('邮宝头像已保存。')
    } catch (error) {
      setAiAvatarMessage(error instanceof Error ? error.message : '邮宝头像上传失败')
    } finally {
      setIsUploadingAiAvatar(false)
      if (aiAvatarInputRef.current) aiAvatarInputRef.current.value = ''
    }
  }

  const handlePlatformLogoUpload = async (slot: PlatformLogoSlot, file: File | undefined) => {
    if (!file) return

    const validationMessage = validateBrandImageFile(file, 2 * 1024 * 1024)
    if (validationMessage) {
      setAppearanceMessage(validationMessage)
      if (platformLogoInputRefs.current[slot]) platformLogoInputRefs.current[slot]!.value = ''
      return
    }

    setAppearanceMessage('')
    setUploadingPlatformLogoSlot(slot)

    try {
      const mode = slot === 'favicon' ? 'light' : platformLogoMode
      const result = await uploadPlatformLogo(slot, file, mode)
      applyPlatformBranding(result)
      if (appearanceDirty) writeAppearanceDraft(themeColor, themePalette)
      const title = platformLogoSlots.find((item) => item.slot === slot)?.title ?? '图标'
      const modeLabel = slot === 'favicon' ? '' : `${platformLogoModeLabels[mode]}模式`
      setAppearanceMessage(`${title}${modeLabel}已上传并保存`)
      showNotice(`${title}${modeLabel}已同步到对应展示位置。`, 'success', '外观设置已更新')
    } catch (error) {
      const message = error instanceof Error ? error.message : '图标上传失败'
      setAppearanceMessage(message)
      showNotice(message, 'error', '图标上传失败')
    } finally {
      setUploadingPlatformLogoSlot(null)
      if (platformLogoInputRefs.current[slot]) platformLogoInputRefs.current[slot]!.value = ''
    }
  }

  const handleResetPlatformLogo = async (slot: PlatformLogoSlot) => {
    setAppearanceMessage('')
    setUploadingPlatformLogoSlot(slot)

    try {
      const mode = slot === 'favicon' ? 'light' : platformLogoMode
      const result = await resetPlatformLogo(slot, mode)
      applyPlatformBranding(result)
      if (appearanceDirty) writeAppearanceDraft(themeColor, themePalette)
      const title = platformLogoSlots.find((item) => item.slot === slot)?.title ?? '图标'
      const modeLabel = slot === 'favicon' ? '' : `${platformLogoModeLabels[mode]}模式`
      setAppearanceMessage(`${title}${modeLabel}已恢复默认`)
      showNotice(`${title}${modeLabel}已恢复默认占位。`, 'success', '外观设置已更新')
    } catch (error) {
      const message = error instanceof Error ? error.message : '恢复默认失败'
      setAppearanceMessage(message)
      showNotice(message, 'error', '恢复默认失败')
    } finally {
      setUploadingPlatformLogoSlot(null)
    }
  }

  const handleApplyPlatformLogoAlternative = async (slot: PlatformLogoSlot, alternative: { darkUrl?: string; label: string; lightUrl: string }) => {
    setAppearanceMessage('')
    setUploadingPlatformLogoSlot(slot)

    try {
      const mode = slot === 'favicon' ? 'light' : platformLogoMode
      const alternativeUrl = mode === 'dark' && alternative.darkUrl ? alternative.darkUrl : alternative.lightUrl
      const response = await fetch(alternativeUrl)
      if (!response.ok) throw new Error('备选图标读取失败')
      const blob = await response.blob()
      const extension = alternativeUrl.split('.').pop() || 'png'
      const file = new File([blob], `${slot}-${alternative.label}.${extension}`, { type: blob.type || 'image/png' })
      const result = await uploadPlatformLogo(slot, file, mode)
      applyPlatformBranding(result)
      if (appearanceDirty) writeAppearanceDraft(themeColor, themePalette)
      const title = platformLogoSlots.find((item) => item.slot === slot)?.title ?? '图标'
      const modeLabel = slot === 'favicon' ? '' : `${platformLogoModeLabels[mode]}模式`
      setAppearanceMessage(`${title}${modeLabel}已应用备选：${alternative.label}`)
      showNotice(`${title}${modeLabel}已应用“${alternative.label}”。`, 'success', '外观设置已更新')
    } catch (error) {
      const message = error instanceof Error ? error.message : '备选图标应用失败'
      setAppearanceMessage(message)
      showNotice(message, 'error', '备选图标应用失败')
    } finally {
      setUploadingPlatformLogoSlot(null)
    }
  }

  const handleSavePlatform = async () => {
    setPlatformMessage('')
    setIsSavingPlatform(true)
    try {
      const result = await updatePlatformSettings({
        orgName,
        platformName,
        schoolName,
      })
      setPlatformName(result.platformName)
      setSchoolName(result.schoolName)
      setOrgName(result.orgName)
      setPublicCertVerify(result.publicCertVerify)
      setPlatformMessage('基础设置已保存')
    } catch (error) {
      setPlatformMessage(error instanceof Error ? error.message : '保存失败，请重试')
    } finally {
      setIsSavingPlatform(false)
    }
  }

  const handleSaveAppearance = async () => {
    const normalizedThemeColor = normalizeHexColor(themeColor)
    if (!normalizedThemeColor) {
      setAppearanceMessage('主题色必须是 #RRGGBB 格式，例如 #2A6438')
      return
    }

    setAppearanceMessage('')
    setIsSavingAppearance(true)
    try {
      const result = await updatePlatformSettings({ themeColor: normalizedThemeColor, themePalette: serializeThemePalette(normalizedThemeColor, themePalette) })
      clearAppearanceDraft()
      setCanApplyThemePreview(true)
      setThemeColor(result.themeColor)
      setSavedThemeColor(result.themeColor)
      setSavedThemePalette(createEditableThemePalette(result.themeColor, result.themePalette))
      setThemePalette(createEditableThemePalette(result.themeColor, result.themePalette))
      setAppearanceMessage('外观设置已保存')
      showNotice('主题色、色卡和品牌资产已保存，已同步到全平台。', 'success', '外观设置已保存')
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存失败，请重试'
      setAppearanceMessage(message)
      showNotice(message, 'error', '外观设置保存失败')
    } finally {
      setIsSavingAppearance(false)
    }
  }

  const openPaletteEditor = (key: BrandColorSlot) => {
    setEditingPaletteKey(key)
    setPaletteDraftColor(generatedBrandPalette[key])
  }

  const savePaletteShade = () => {
    if (editingPaletteKey === null) return
    const normalizedColor = normalizeHexColor(paletteDraftColor)
    if (!normalizedColor) {
      showNotice('色卡颜色必须是 #RRGGBB 格式，例如 #2A6438。', 'error', '颜色格式错误')
      return
    }

    const nextPalette = generateBrandPalette(themePalette.primary, {
      ...themePalette,
      [editingPaletteKey]: normalizedColor,
    })
    const nextThemeColor = nextPalette.primary
    const meta = brandColorSlotMeta[editingPaletteKey]

    writeAppearanceDraft(nextThemeColor, nextPalette)
    setCanApplyThemePreview(true)
    setThemeColor(nextThemeColor)
    setThemePalette(nextPalette)
    setEditingPaletteKey(null)
    setPaletteDraftColor('')
    setAppearanceMessage(`${meta.label}已暂存为 ${normalizedColor}，请点击下方“保存外观设置”全局保存。`)
    showNotice(`${meta.label}已应用到当前色卡预览，保存外观设置后会全局生效。`, 'info', '色卡修改已暂存')
  }

  const handleSaveAiQuota = async () => {
    const dailyTokens = Number(defaultAiDailyTokens)
    const weeklyTokens = Number(defaultAiWeeklyTokens)
    const monthlyTokens = Number(defaultAiMonthlyTokens)
    if (![dailyTokens, weeklyTokens, monthlyTokens].every((value) => Number.isInteger(value) && value >= 0)) {
      setAiQuotaMessage('请输入有效的非负整数额度')
      return
    }

    setAiQuotaMessage('')
    setIsSavingAiQuota(true)
    try {
      const result = await updateAiQuotaSettings({
        defaultDailyTokens: dailyTokens,
        defaultMonthlyTokens: monthlyTokens,
        defaultWeeklyTokens: weeklyTokens,
        quotaPeriod: aiQuotaPeriod,
      })
      setDefaultAiDailyTokens(String(result.defaultDailyTokens))
      setDefaultAiWeeklyTokens(String(result.defaultWeeklyTokens))
      setDefaultAiMonthlyTokens(String(result.defaultMonthlyTokens))
      setAiQuotaPeriod(result.quotaPeriod)
      setAiQuotaResetAt(result.resetAt)
      setAiQuotaMessage('AI token 额度与重置周期已保存')
    } catch (error) {
      setAiQuotaMessage(error instanceof Error ? error.message : '保存失败，请重试')
    } finally {
      setIsSavingAiQuota(false)
    }
  }

  const handleSaveSmtp = async () => {
    const port = Number(smtpPort)
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      setSmtpMessage('SMTP 端口必须是 1-65535 的整数')
      return
    }
    if (smtpEnabled && (!smtpHost.trim() || !smtpFromEmail.trim() || !smtpUsername.trim())) {
      setSmtpMessage('启用邮件服务前，请填写 SMTP 地址、发件邮箱和 SMTP 用户名')
      return
    }

    setSmtpMessage('')
    setIsSavingSmtp(true)
    try {
      const result = await updateEmailServiceSettings({
        enabled: smtpEnabled,
        fromEmail: smtpFromEmail,
        fromName: smtpFromName,
        host: smtpHost,
        password: smtpPassword || undefined,
        port,
        replyTo: smtpReplyTo,
        secureMode: smtpSecureMode,
        username: smtpUsername,
      })
      applyEmailServiceSettings(result)
      setSmtpMessage(result.enabled ? 'SMTP 邮件服务配置已保存，验证码邮件将使用该服务发送。' : 'SMTP 配置已保存，邮件服务当前未启用。')
      showNotice('邮箱与通知配置已保存。', 'success', 'SMTP 配置已更新')
    } catch (error) {
      setSmtpMessage(error instanceof Error ? error.message : 'SMTP 配置保存失败')
    } finally {
      setIsSavingSmtp(false)
    }
  }

  const handleTestSmtp = async () => {
    if (!smtpTestRecipient.trim()) {
      setSmtpMessage('请输入测试收件邮箱')
      return
    }

    setSmtpMessage('')
    setIsTestingSmtp(true)
    try {
      const result = await testEmailService(smtpTestRecipient)
      setSmtpMessage(result.message)
      showNotice(result.message, 'success', '测试邮件已发送')
    } catch (error) {
      setSmtpMessage(error instanceof Error ? error.message : '测试邮件发送失败')
    } finally {
      setIsTestingSmtp(false)
    }
  }

  const effectiveThemeColor = normalizeHexColor(themeColor) ?? '#2A6438'
  const generatedBrandPalette = themePalette
  const baseGeneratedBrandPalette = generateBrandPalette(effectiveThemeColor)
  const appearanceDirty = savedThemeColor !== themeColor || !areThemePalettesEqual(savedThemePalette, themePalette)
  const effectivePlatformLogos = appliedPlatformLogos

  return (
    <>
      {notice && (
        <FloatingNotice
          message={notice.message}
          onClose={() => setNotice(null)}
          title={notice.title}
          variant={notice.variant}
        />
      )}
      <section className="relative z-10 mx-auto max-w-[1360px] px-5 pb-8 pt-24 md:px-8">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <PageHeader
            eyebrowIcon={<SlidersHorizontal className="h-3.5 w-3.5" />}
            title="系统设置"
            description="集中管理平台交付、认证、AI、证书、安全审计和维护能力。配置项实时生效；涉及注册、认证、AI、PDF、后台访问等关键配置时，会先弹出确认框。"
          />
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="xl:sticky xl:top-24 xl:self-start">
            <SurfacePanel className="overflow-hidden p-0">
              <div className="border-b border-black/10 px-4 py-3 dark:border-white/10">
                <p className="text-sm font-semibold">设置</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">按模块管理平台配置</p>
              </div>
              <div className="p-2">
                {settingSections.map((section) => (
                  <button
                    className={`flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition ${
                      activeSection === section.label
                        ? 'bg-brand-600 text-white'
                        : 'text-slate-700 hover:bg-black/5 dark:text-slate-300 dark:hover:bg-white/10'
                    }`}
                    key={section.label}
                    onClick={() => setActiveSection(section.label)}
                    type="button"
                  >
                    <span className="mt-0.5">{section.icon} 
                    </span>
                    <span>
                      <span className="block text-sm font-semibold">{section.label}</span>
                      <span className={`mt-1 block text-xs leading-5 ${activeSection === section.label ? 'text-white/75' : 'text-slate-500 dark:text-slate-400'}`}>
                        {section.description}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </SurfacePanel>
          </aside>

          <div className="space-y-6">
            {activeSection === '基础设置' && (
              <>
                <SettingsCard
                  description="这些信息会影响首页、浏览器标题、邮件通知和多学校私有化交付时的默认展示。"
                  icon={<Building2 className="h-5 w-5" />}
                  title="平台与组织"
                >
                  <SettingRow
                    control={<TextField onChange={setPlatformName} value={platformName} />}
                    description="显示在登录页、管理端标题和系统通知中，建议使用学校或组织认可的正式名称。"
                    title="平台名称"
                  />
                  <SettingRow
                    control={<TextField onChange={setSchoolName} value={schoolName} />}
                    description="用于证书、责任书、通知模板和公开核验页面。多学校部署时应配置为当前租户名称。"
                    title="学校名称"
                  />
                  <SettingRow
                    control={<TextField onChange={setOrgName} value={orgName} />}
                    description="平台主管部门名称，会出现在漏洞响应流程、证书签发单位和公告落款中。"
                    title="主管单位"
                  />
                  <div className="flex items-center justify-between gap-4 border-t border-black/10 px-6 py-4 dark:border-white/10">
                    {platformMessage ? (
                      <p className={`text-sm ${platformMessage.includes('失败') || platformMessage.includes('错误') ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {platformMessage}
                      </p>
                    ) : (
                      <span />
                    )}
                    <ActionButton
                      disabled={isSavingPlatform}
                      icon={<Save className="h-4 w-4" />}
                      label={isSavingPlatform ? '保存中...' : '保存基础设置'}
                      onClick={() => void handleSavePlatform()}
                    />
                  </div>
                </SettingsCard>

                <SettingsCard
                  description="维护登录页、管理端和公开页面使用的品牌图标。建议使用透明背景 PNG 或清晰的 SVG 转 PNG 文件。"
                  icon={<Paintbrush className="h-5 w-5" />}
                  title="外观"
                >
                  <div className="border-b border-black/10 px-6 py-5 dark:border-white/10">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-950 dark:text-white">品牌图标</p>
                        <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                          点击预览图上传对应图标，支持 JPG / PNG / WebP / GIF，单个文件最大 2MB。
                        </p>
                      </div>
                      <div className="inline-flex w-fit rounded-lg border border-black/10 bg-[var(--app-panel-muted-bg)] p-1 dark:border-white/10">
                        {(['light', 'dark'] as PlatformLogoMode[]).map((mode) => {
                          const Icon = mode === 'light' ? Sun : Moon
                          return (
                            <button
                              aria-pressed={platformLogoMode === mode}
                              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                                platformLogoMode === mode
                                  ? 'bg-brand-600 text-white shadow-sm'
                                  : 'text-slate-600 hover:bg-black/5 dark:text-slate-300 dark:hover:bg-white/10'
                              }`}
                              key={mode}
                              onClick={() => setPlatformLogoMode(mode)}
                              type="button"
                            >
                              <Icon className="h-4 w-4" />
                              {platformLogoModeLabels[mode]}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
                      菜单栏和登录注册弹窗区分白天/黑夜图标；浏览器标签页图标不区分模式。
                    </p>
                    <div className="mt-4 grid gap-3 lg:grid-cols-3">
                      {platformLogoSlots.map((item) => {
                        const mode = item.slot === 'favicon' ? 'light' : platformLogoMode
                        const previewUrl = getPlatformLogoUrl(effectivePlatformLogos, item.slot, mode)
                        const defaultUrl = getDefaultPlatformLogoUrl(item.slot, mode)
                        const custom = previewUrl !== defaultUrl
                        const uploading = uploadingPlatformLogoSlot === item.slot

                        return (
                          <div className="rounded-lg border border-black/10 p-3 dark:border-white/10" key={item.slot}>
                            <button
                              aria-label={`上传${item.title}`}
                              className="group flex h-32 w-full flex-col items-center justify-center rounded-lg border border-black/10 bg-white p-3 text-center transition hover:border-brand-500 hover:bg-brand-50/50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-slate-950/45 dark:hover:border-brand-400 dark:hover:bg-brand-950/50 dark:focus:ring-offset-slate-950"
                              disabled={uploadingPlatformLogoSlot !== null}
                              onClick={() => platformLogoInputRefs.current[item.slot]?.click()}
                              type="button"
                            >
                              <img
                                alt={item.title}
                                className={`object-contain ${item.preview === 'wide' ? 'max-h-12 max-w-full' : item.preview === 'favicon' ? 'h-12 w-12 rounded-md' : 'max-h-24 max-w-full'}`}
                                src={previewUrl}
                              />
                              <span className="mt-3 text-xs font-medium text-slate-500 transition group-hover:text-brand-700 dark:text-slate-400 dark:group-hover:text-brand-200">
                                {uploading ? '上传中...' : `点击上传${item.slot === 'favicon' ? '' : platformLogoModeLabels[mode]}`}
                              </span>
                            </button>
                            <div className="mt-3 flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-900 dark:text-white">{item.title}</p>
                                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{item.description}</p>
                                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{item.recommended}</p>
                              </div>
                              <button
                                className="shrink-0 rounded-lg border border-black/10 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
                                disabled={!custom || uploadingPlatformLogoSlot !== null}
                                onClick={() => void handleResetPlatformLogo(item.slot)}
                                type="button"
                              >
                                恢复默认
                              </button>
                              <input
                                accept="image/jpeg,image/png,image/webp,image/gif"
                                className="hidden"
                                onChange={(event) => void handlePlatformLogoUpload(item.slot, event.target.files?.[0])}
                                ref={(node) => { platformLogoInputRefs.current[item.slot] = node }}
                                type="file"
                              />
                            </div>
                            <div className="mt-4 border-t border-black/10 pt-3 dark:border-white/10">
                              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">备选图标</p>
                              <div className="mt-2 grid gap-2">
                                {legacyPlatformLogoAlternatives[item.slot].map((alternative) => {
                                  const alternativeUrl = mode === 'dark' && alternative.darkUrl ? alternative.darkUrl : alternative.lightUrl
                                  return (
                                    <button
                                      className="flex min-h-12 items-center gap-3 rounded-lg border border-black/10 bg-[var(--app-panel-muted-bg)] px-3 py-2 text-left transition hover:border-brand-500 hover:bg-brand-50/60 disabled:cursor-not-allowed disabled:opacity-55 dark:border-white/10 dark:hover:border-brand-400 dark:hover:bg-brand-950/45"
                                      disabled={uploadingPlatformLogoSlot !== null}
                                      key={alternative.label}
                                      onClick={() => void handleApplyPlatformLogoAlternative(item.slot, alternative)}
                                      type="button"
                                    >
                                      <span className="flex h-9 w-14 shrink-0 items-center justify-center rounded-md bg-white p-1 dark:bg-slate-950/55">
                                        <img alt="" className="max-h-full max-w-full object-contain" src={alternativeUrl} />
                                      </span>
                                      <span className="min-w-0">
                                        <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-100">{alternative.label}</span>
                                        <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">应用到{item.slot === 'favicon' ? item.title : `${platformLogoModeLabels[mode]}${item.title}`}</span>
                                      </span>
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  <SettingRow
                    control={
                      <ThemeColorPicker
                        onChange={(nextColor) => {
                          const nextPalette = generateBrandPalette(nextColor)
                          writeAppearanceDraft(nextColor, nextPalette)
                          setCanApplyThemePreview(true)
                          setThemeColor(nextColor)
                          setThemePalette(nextPalette)
                        }}
                        value={themeColor}
                      />
                    }
                    description="系统主色将用于按钮、当前菜单、重点状态和部分图标。修改后应检查深色和浅色模式可读性。"
                    title="主题色"
                  />
                  <div className="px-6 py-5">
                    <div className="rounded-lg border border-black/10 bg-[var(--app-panel-muted-bg)] p-4 dark:border-white/10 ">
                      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                        <div>
                          <p className="text-sm font-semibold text-slate-950 dark:text-white">生成色卡</p>
                          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                            主题色自动生成完整色卡；此处只展示白天模式和黑夜模式角色色。点击任意色块可单独微调。品牌色阶内部生成，不在这里展示。
                          </p>
                        </div>
                        <span className="rounded-lg border border-black/10 px-3 py-1.5 font-mono text-xs text-slate-600 dark:border-white/10 dark:text-slate-300">
                          primary = {generatedBrandPalette.primary}
                        </span>
                      </div>
                      <div className="mt-4 space-y-4">
                        <PaletteSlotRow
                          basePalette={baseGeneratedBrandPalette}
                          onEdit={openPaletteEditor}
                          palette={generatedBrandPalette}
                          slots={visibleLightPaletteSlots}
                          themePalette={themePalette}
                          title="白天模式"
                        />
                        <PaletteSlotRow
                          basePalette={baseGeneratedBrandPalette}
                          onEdit={openPaletteEditor}
                          palette={generatedBrandPalette}
                          slots={visibleDarkPaletteSlots}
                          themePalette={themePalette}
                          title="黑夜模式"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-t border-black/10 px-6 py-4 dark:border-white/10">
                    {appearanceMessage ? (
                      <p className={`text-sm ${isErrorMessage(appearanceMessage) ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {appearanceMessage}
                      </p>
                    ) : (
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        当前主题色：{normalizeHexColor(themeColor) ?? themeColor}
                        {appearanceDirty ? <span className="ml-2 font-medium text-amber-700 dark:text-amber-300">有未保存的外观修改</span> : null}
                      </p>
                    )}
                    <button
                      className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={isSavingAppearance}
                      onClick={() => void handleSaveAppearance()}
                      type="button"
                    >
                      <Save className="h-4 w-4" />
                      {isSavingAppearance ? '保存中...' : '保存外观设置'}
                    </button>
                  </div>
                </SettingsCard>
              </>
            )}

            {activeSection === '登录与认证' && (
              <>
                <SettingsCard
                  description="控制平台准入策略。关闭开放注册后，可在下方审核待注册用户。"
                  icon={<KeyRound className="h-5 w-5" />}
                  title="准入控制"
                >
                  <SettingRow
                    control={
                      <SettingToggle
                        enabled={openRegister}
                        onChange={() =>
                          confirmChange({
                            title: openRegister ? '确认关闭开放注册？' : '确认开启开放注册？',
                            description: openRegister
                              ? '关闭后，新用户将无法自行注册，只能通过管理员导入、邀请或统一认证同步进入平台。'
                              : '开启后，新用户可以进入注册流程。建议同时保留邮箱验证、滑块验证和答题准入。若当前处于正式上线阶段，请确认学校已有明确开放策略。',
                            onConfirm: () => {
                              const next = !openRegister
                              setOpenRegister(next)
                              void setRegistrationMode(next).catch(() => setOpenRegister(openRegister))
                            },
                          })
                        }
                      />
                    }
                    description="控制访客是否可以进入注册流程。该项会影响平台准入边界，变更前建议确认运营策略。"
                    title="开放注册"
                  />
                </SettingsCard>

                {!openRegister && (
                  <SettingsCard
                    description="以下是关闭开放注册后提交注册申请的用户，审核通过后账号激活，拒绝后账号禁用。"
                    icon={<UserCheck className="h-5 w-5" />}
                    title={`待审核注册申请${pendingRegistrations.length > 0 ? `（${pendingRegistrations.length}）` : ''}`}
                  >
                    {pendingRegLoading ? (
                      <p className="py-4 text-center text-sm text-slate-500">加载中...</p>
                    ) : pendingRegistrations.length === 0 ? (
                      <p className="py-4 text-center text-sm text-slate-500 dark:text-slate-400">
                        暂无待审核注册申请
                      </p>
                    ) : (
                      <div className="divide-y divide-black/5 dark:divide-white/5">
                        {pendingRegistrations.map((item) => (
                          <div className="flex items-center justify-between gap-4 py-3" key={item.id}>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{item.name}</p>
                              <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                                {item.unifiedCode} · {item.college} · {item.identityText ?? ''}{item.studentNo ? ` · ${item.studentNo}` : ''}
                              </p>
                              <p className="mt-0.5 truncate text-xs text-slate-400 dark:text-slate-500">{item.email}</p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <button
                                className="flex items-center gap-1.5 rounded-lg border border-brand-600/30 bg-brand-600/10 px-3 py-1.5 text-xs font-medium text-brand-700 transition hover:bg-brand-600/20 dark:border-brand-300/20 dark:text-brand-300"
                                onClick={() => void handleApproveRegistration(item.id)}
                                type="button"
                              >
                                <CheckCircle className="h-3.5 w-3.5" />
                                通过
                              </button>
                              <button
                                className="flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-500/20 dark:border-red-400/20 dark:text-red-400"
                                onClick={() => void handleRejectRegistration(item.id)}
                                type="button"
                              >
                                <UserX className="h-3.5 w-3.5" />
                                拒绝
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </SettingsCard>
                )}

                <SettingsCard
                  description="管理本地账号、统一认证码、邮箱验证码和学校统一身份认证。认证策略会直接影响平台安全边界。"
                  icon={<KeyRound className="h-5 w-5" />}
                  title="登录验证策略"
                >
                  <SettingRow
                    control={
                      <SettingToggle
                        enabled={emailVerify}
                        onChange={() =>
                          confirmChange({
                            title: emailVerify ? '确认关闭邮箱验证？' : '确认开启邮箱验证？',
                            description: emailVerify
                              ? '关闭邮箱验证会降低注册身份确认能力。除非已经接入学校统一认证，否则不建议关闭。'
                              : '开启后，新用户注册、修改邮箱和找回密码时需要完成邮件验证码校验。请先确认 SMTP 服务可用。',
                            danger: emailVerify,
                            onConfirm: () => setEmailVerify((value) => !value),
                          })
                        }
                      />
                    }
                    description="用于注册验证、修改邮箱、找回密码和重要安全通知。"
                    title="邮箱验证"
                  />
                  <SettingRow
                    control={<SettingToggle enabled />}
                    description="降低自动化注册、批量撞库和脚本登录风险。建议在开放注册时保持开启。"
                    title="滑块验证"
                  />
                  <SettingRow
                    control={<SelectInput label="" options={['5 次失败锁定 15 分钟', '10 次失败锁定 30 分钟', '关闭锁定']} value="5 次失败锁定 15 分钟" />}
                    description="连续登录失败后的账号保护策略。管理员账号建议额外叠加后台访问 IP 限制。"
                    title="账号锁定策略"
                  />
                </SettingsCard>

              </>
            )}

            {activeSection === '邮宝' && (
              <>
                <SettingsCard
                  description="配置用户端邮宝的展示形象。头像会在邮宝对话页以圆形展示，建议使用清晰的正方形 PNG、JPG、WebP 或 GIF。"
                  icon={<Bot className="h-5 w-5" />}
                  title="邮宝形象"
                >
                  <SettingRow
                    control={
                      <div className="flex items-center justify-end gap-3">
                        <div className={`flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-black/10 dark:border-white/10 ${aiAvatarUrl ? 'bg-transparent' : 'bg-brand-600 text-white'}`}>
                          {aiAvatarUrl ? (
                            <img alt="邮宝头像" className="h-full w-full object-cover" src={aiAvatarUrl} />
                          ) : (
                            <Bot className="h-6 w-6" />
                          )}
                        </div>
                        <ActionButton
                          disabled={isUploadingAiAvatar}
                          icon={<Upload className="h-4 w-4" />}
                          label={isUploadingAiAvatar ? '上传中...' : '上传头像'}
                          onClick={() => aiAvatarInputRef.current?.click()}
                        />
                        <input
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          className="hidden"
                          onChange={(event) => void handleAiAvatarUpload(event.target.files?.[0])}
                          ref={aiAvatarInputRef}
                          type="file"
                        />
                      </div>
                    }
                    description="用于学生端邮宝消息头像和思考状态头像，上传后立即对新打开的邮宝页面生效。"
                    title="助手头像"
                  />
                  {aiAvatarMessage && (
                    <p className={`px-6 pb-4 pt-2 text-sm ${aiAvatarMessage.includes('失败') ? 'text-red-600 dark:text-red-400' : 'text-brand-700 dark:text-brand-300'}`}>
                      {aiAvatarMessage}
                    </p>
                  )}
                </SettingsCard>

                <SettingsCard
                  description="设置 AI token 的重置周期，以及新用户默认日、周、月额度。单个用户可以在用户管理详情页单独覆盖该额度。"
                  icon={<SlidersHorizontal className="h-5 w-5" />}
                  title="AI token 额度"
                >
                  <SettingRow
                    control={
                      <SelectInput
                        label=""
                        onChange={(value) => setAiQuotaPeriod(aiQuotaPeriodValues[value] ?? 'MONTH')}
                        options={['每日重置', '每周重置', '每月重置']}
                        value={aiQuotaPeriodLabels[aiQuotaPeriod]}
                      />
                    }
                    description="系统会按所选周期统计用量并在下一个周期开始时恢复额度。每周重置按周一 00:00 计算。"
                    title="额度重置周期"
                  />
                  <SettingRow
                    control={<TextField onChange={setDefaultAiDailyTokens} type="number" value={defaultAiDailyTokens} />}
                    description="当重置周期选择“每日重置”时，新注册或未单独设置的用户会使用该额度。"
                    title="新用户默认日额度"
                  />
                  <SettingRow
                    control={<TextField onChange={setDefaultAiWeeklyTokens} type="number" value={defaultAiWeeklyTokens} />}
                    description="当重置周期选择“每周重置”时，新注册或未单独设置的用户会使用该额度。"
                    title="新用户默认周额度"
                  />
                  <SettingRow
                    control={<TextField onChange={setDefaultAiMonthlyTokens} type="number" value={defaultAiMonthlyTokens} />}
                    description="当重置周期选择“每月重置”时，新注册或未单独设置的用户会使用该额度。填 0 表示默认不允许调用 AI。"
                    title="新用户默认月额度"
                  />
                  <div className="flex items-center justify-between gap-4 border-t border-black/10 px-6 py-4 dark:border-white/10">
                    {aiQuotaMessage ? (
                      <p className={`text-sm ${aiQuotaMessage.includes('失败') || aiQuotaMessage.includes('有效') ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {aiQuotaMessage}
                      </p>
                    ) : (
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        当前周期：{aiQuotaPeriodLabels[aiQuotaPeriod]}；下次重置：{formatDateTime(aiQuotaResetAt)}
                      </p>
                    )}
                    <ActionButton
                      disabled={isSavingAiQuota}
                      icon={<Save className="h-4 w-4" />}
                      label={isSavingAiQuota ? '保存中...' : '保存默认额度'}
                      onClick={() => void handleSaveAiQuota()}
                    />
                  </div>
                </SettingsCard>
                <SettingsCard
                  description="控制普通用户使用平台模型或自有模型。管理员和审核员始终使用平台模型。"
                  icon={<Bot className="h-5 w-5" />}
                  title="用户 AI 模式"
                >
                  <AdminAiPolicyPanel />
                </SettingsCard>
                <SettingsCard
                  description="配置全平台共用的主模型和最多两个备用模型。平台 Key 加密保存，不会在保存后回显。"
                  icon={<ServerCog className="h-5 w-5" />}
                  title="平台 AI"
                >
                  <AdminAiModelConfigurationLauncher />
                </SettingsCard>
              </>
            )}

            {activeSection === '邮箱与通知' && (
              <>
                <SettingsCard
                  description="邮件服务用于注册验证码、漏洞状态变更、审核待办、证书签发和积分兑换提醒。"
                  icon={<Mail className="h-5 w-5" />}
                  title="SMTP 邮件服务"
                >
                  <SettingRow
                    control={<SettingToggle enabled={smtpEnabled} onChange={() => setSmtpEnabled((value) => !value)} />}
                    description="启用后，登录、注册、修改邮箱和修改密码的邮箱验证码会通过当前 SMTP 服务真实发送。"
                    title="启用邮件服务"
                  />
                  <SettingRow control={<TextField onChange={setSmtpHost} value={smtpHost} />} description="学校或组织提供的 SMTP 服务地址。生产环境建议使用专用发件账号。" title="SMTP 地址" />
                  <SettingRow control={<TextField onChange={setSmtpPort} value={smtpPort} />} description="SSL 常用 465，STARTTLS 常用 587，具体取决于学校邮件服务配置。" title="SMTP 端口" />
                  <SettingRow control={<TextField onChange={setSmtpFromName} value={smtpFromName} />} description="显示在邮件客户端中的发件人名称，建议使用平台正式名称或学校安全团队名称。" title="发件人名称" />
                  <SettingRow control={<TextField onChange={setSmtpFromEmail} value={smtpFromEmail} />} description="平台验证码和通知邮件的发件邮箱。" title="发件邮箱" />
                  <SettingRow control={<TextField onChange={setSmtpUsername} value={smtpUsername} />} description="SMTP 认证用户名，通常与发件邮箱相同，也可能是学校邮件系统分配的独立账号。" title="SMTP 用户名" />
                  <SettingRow
                    control={
                      <div className="space-y-2">
                        <TextField onChange={setSmtpPassword} type="password" value={smtpPassword} />
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                          {smtpPasswordConfigured ? '已保存 SMTP 密码或授权码；留空保存时会继续沿用。' : '尚未保存 SMTP 密码或授权码。'}
                        </p>
                      </div>
                    }
                    description="SMTP 认证密码或授权码只提交到后端保存，接口不会回显明文。"
                    title="SMTP 密码"
                  />
                  <SettingRow
                    control={
                      <SelectInput
                        label=""
                        onChange={(value) => setSmtpSecureMode(value as SmtpSecureMode)}
                        options={smtpSecureModeOptions.map((value) => ({ label: smtpSecureModeLabels[value], value }))}
                        value={smtpSecureMode}
                      />
                    }
                    description="建议使用 SSL 或 STARTTLS，不建议明文发送认证信息。"
                    title="加密方式"
                  />
                  <SettingRow control={<TextField onChange={setSmtpReplyTo} value={smtpReplyTo} />} description="可选。用户回复邮件时进入该邮箱；留空则使用发件邮箱。" title="回复邮箱" />
                  <SettingRow control={<TextField onChange={setSmtpTestRecipient} value={smtpTestRecipient} />} description="保存配置后，可发送一封测试邮件确认 SMTP 服务、认证信息和发件人设置均可用。" title="测试收件邮箱" />
                  <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
                    <div className="min-w-0 text-sm">
                      <p className={smtpMessage && isErrorMessage(smtpMessage) ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}>
                        {smtpMessage || (smtpEnabled ? '邮件服务已启用，请保存并发送测试邮件确认配置可用。' : '邮件服务当前未启用，验证码邮件不会发送。')}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <ActionButton disabled={isSavingSmtp} icon={<Save className="h-4 w-4" />} label={isSavingSmtp ? '保存中...' : '保存 SMTP 配置'} onClick={() => void handleSaveSmtp()} />
                      <ActionButton disabled={isTestingSmtp || isSavingSmtp} icon={<Mail className="h-4 w-4" />} label={isTestingSmtp ? '发送中...' : '发送测试邮件'} onClick={() => void handleTestSmtp()} />
                    </div>
                  </div>
                </SettingsCard>

                <SettingsCard
                  description="通知模板支持后续对邮件标题、站内信内容和变量占位符进行编辑。"
                  icon={<FileText className="h-5 w-5" />}
                  title="通知模板"
                >
                  {['注册验证码模板', '漏洞状态变更模板', '审核员待办模板', '证书签发模板', '积分兑换模板', '系统维护模板'].map((title) => (
                    <SettingRow
                      control={<ActionButton icon={<FileText className="h-4 w-4" />} label="编辑" />}
                      description="已配置默认模板。后续可支持变量如用户姓名、漏洞编号、审核状态和证书核验码。"
                      key={title}
                      title={title}
                    />
                  ))}
                </SettingsCard>
              </>
            )}

            {activeSection === '漏洞流程' && (
              <SettingsCard
                description="配置漏洞从提交、初审、补充、确认、修复、复测到归档的全流程规则。"
                icon={<ShieldQuestion className="h-5 w-5" />}
                title="漏洞响应流程"
              >
                <SettingRow control={<TextField value="SRC" />} description="用于生成漏洞编号，例如 SRC-2026-0008。多学校部署时可配置学校简称。" title="漏洞编号前缀" />
                <SettingRow control={<TextField value="24 小时" />} description="超过时间未初审时提醒审核员和管理员。" title="初审超时提醒" />
                <SettingRow control={<TextField value="7 天" />} description="责任单位超过修复时限后自动提醒，并在管理端待办中标记。" title="修复超时提醒" />
                <SettingRow control={<SettingToggle enabled />} description="高危及以上漏洞进入队列后自动通知管理员和对应审核员。" title="高危自动通知" />
              </SettingsCard>
            )}

            {activeSection === '证书模板' && (
              <SettingsCard
                description="证书模板在系统设置中统一管理，证书管理页只处理签发、预览、撤销和核验业务。"
                icon={<FileBadge2 className="h-5 w-5" />}
                title="证书功能与 PDF 模板"
              >
                <SettingRow control={<SettingToggle enabled />} description="关闭后，证书管理页仍可查看历史证书，但不会进入新的签发流程。" title="启用证书功能" />
                <SettingRow control={<SelectInput label="" options={['CERT-年份-流水号', '学校简称-年份-流水号', '自定义规则']} value="CERT-年份-流水号" />} description="影响新签发证书编号，不会修改历史证书编号。" title="证书编号规则" />
                <SettingRow
                  control={
                    <SettingToggle
                      enabled={publicCertVerify}
                      onChange={() =>
                        confirmChange({
                          title: publicCertVerify ? '确认关闭公开证书查询？' : '确认开启公开证书查询？',
                          description: publicCertVerify
                            ? '关闭后，访客将无法通过证书编号或核验码公开查询证书有效性。已签发证书仍会保留在系统内。'
                            : '开启后，访客可通过证书编号或核验码验证电子证书。请确认核验页面不会展示过多个人信息。敏感字段应保持脱敏。',
                          onConfirm: () => {
                            const next = !publicCertVerify
                            setPublicCertVerify(next)
                            void updatePlatformSettings({ publicCertVerify: next }).catch(() => setPublicCertVerify(publicCertVerify))
                          },
                        })
                      }
                    />
                  }
                  description="控制访客是否可以公开核验证书。建议只展示证书状态、贡献类型和脱敏后的获得者信息。"
                  title="公开证书查询"
                />
                <SettingRow
                  control={
                    <div className="rounded-lg border border-black/10 bg-[var(--app-panel-muted-bg)] p-3 text-sm dark:border-white/10 ">
                      {certificateTemplate ? (
                        <div className="space-y-1">
                          <p className="font-semibold">{certificateTemplate.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">版本：{certificateTemplate.version}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">格式：{certificateTemplate.templateMimeType}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">印章：{certificateTemplate.sealConfigured ? '已配置' : '未配置'}</p>
                        </div>
                      ) : (
                        <p className="text-slate-500 dark:text-slate-400">当前未启用证书模板</p>
                      )}
                    </div>
                  }
                  description="签发证书时会读取当前启用模板。历史证书后续会保留签发时的模板版本与快照。"
                  title="当前启用模板"
                />
                <div className="mt-4 flex flex-wrap gap-2">
                  <ActionButton
                    disabled={isUploadingTemplate}
                    icon={<Upload className="h-4 w-4" />}
                    label={isUploadingTemplate ? '上传中...' : '上传证书背景'}
                    onClick={() => templateInputRef.current?.click()}
                  />
                  <ActionButton
                    disabled={isUploadingTemplate}
                    icon={<Upload className="h-4 w-4" />}
                    label="上传电子签章"
                    onClick={() => sealInputRef.current?.click()}
                  />
                  <ActionButton
                    disabled={!certificateTemplate}
                    icon={<SlidersHorizontal className="h-4 w-4" />}
                    label="配置坐标"
                    onClick={() => void handleOpenCoordinateEditor()}
                  />
                  <ActionButton
                    disabled={isPreviewingPdf || !certificateTemplate}
                    icon={<FileBadge2 className="h-4 w-4" />}
                    label={isPreviewingPdf ? '生成中...' : '测试生成 PDF'}
                    onClick={() => void handlePreviewPdf()}
                  />
                  <input
                    accept="application/pdf,image/png"
                    className="hidden"
                    onChange={(event) => void handleTemplateUpload(event.target.files?.[0])}
                    ref={templateInputRef}
                    type="file"
                  />
                  <input
                    accept="image/png"
                    className="hidden"
                    onChange={(event) => void handleSealUpload(event.target.files?.[0])}
                    ref={sealInputRef}
                    type="file"
                  />
                </div>
                {certificateTemplateMessage && (
                  <p className="px-6 pb-4 pt-2 text-sm text-brand-700 dark:text-brand-300">{certificateTemplateMessage}</p>
                )}
              </SettingsCard>
            )}

            {activeSection === '安全与审计' && (
              <>
                <SettingsCard
                  description="这些设置决定新用户是否可以提交漏洞，以及平台如何约束授权测试边界。"
                  icon={<ShieldCheck className="h-5 w-5" />}
                  title="准入与责任边界"
                >
                  <SettingRow control={<SettingToggle enabled={securityExamSettings?.enabled ?? true} onChange={() => void handleToggleSecurityExam()} />} description="新注册用户必须完成安全规范答题，达到分数要求后才能提交漏洞。" title="新用户答题准入" />
                  <SettingRow
                    control={<div className="flex justify-end"><ActionButton icon={<FileText className="h-4 w-4" />} label="编辑责任书" onClick={openResponsibilityAgreementEditor} /></div>}
                    description={responsibilityAgreement
                      ? `当前版本 ${responsibilityAgreement.version}，发布于 ${responsibilityAgreement.publishedAt ? new Date(responsibilityAgreement.publishedAt).toLocaleString('zh-CN') : '未发布'}。发布新版本后，用户需重新签署。`
                      : '用户必须签署责任书，承诺不进行未授权扫描、爆破、数据下载、权限维持和后门植入。'}
                    title="责任书签署后提交漏洞"
                  />
                  <SettingRow control={<SettingToggle enabled />} description="管理员、审核员和用户的关键操作都会写入审计日志。" title="管理员操作留痕" />
                  <SettingRow control={<SettingToggle enabled />} description="导出漏洞、证书、用户信息时默认隐藏手机号、邮箱、Token、Cookie 等敏感字段。" title="导出数据默认脱敏" />
                  <SettingRow control={<SettingToggle enabled />} description="附件查看、下载和预览都会记录操作人、时间、IP 和关联业务编号。" title="附件下载审计" />
                </SettingsCard>

                <SettingsCard
                  description="题库会持续保存。系统每次随机抽取 10 道单选、5 道判断、5 道多选，满分 100 分，默认 80 分通过。"
                  icon={<ShieldQuestion className="h-5 w-5" />}
                  title="网络安全知识题库"
                >
                  <SettingRow
                    control={<TextField onChange={setQuestionAiTopic} value={questionAiTopic} />}
                    description="AI 会生成适合大一学生的 20 道入门题，重点为网络安全法律法规意识、授权边界，以及渗透测试中应避免的行为。"
                    title="AI 出题主题"
                  />
                  <div className="flex flex-wrap gap-2 px-6 py-4">
                    <ActionButton disabled={isQuestionBusy} icon={<Bot className="h-4 w-4" />} label={isQuestionBusy ? '处理中...' : '让 AI 生成 20 道题并入库'} onClick={() => void handleGenerateQuestions()} />
                    <ActionButton disabled={isQuestionBusy} icon={<Upload className="h-4 w-4" />} label="上传知识库由 AI 生成 20 道题" onClick={() => knowledgeBaseInputRef.current?.click()} />
                    <ActionButton disabled={isQuestionBusy} icon={<Upload className="h-4 w-4" />} label="导入已有题库" onClick={() => questionBankInputRef.current?.click()} />
                    <ActionButton disabled={isQuestionBusy} icon={<Edit3 className="h-4 w-4" />} label={`可视化编辑题库（${securityQuestions.length}）`} onClick={() => openQuestionEditor()} />
                    <input accept="application/json,text/plain,text/markdown,text/csv,application/pdf" className="hidden" onChange={(event) => void handleImportQuestionFile(event.target.files?.[0])} ref={questionBankInputRef} type="file" />
                    <input accept="text/plain,text/markdown,application/pdf" className="hidden" onChange={(event) => void handleGenerateQuestionsFromKnowledgeFile(event.target.files?.[0])} ref={knowledgeBaseInputRef} type="file" />
                  </div>
                  <div className="border-t border-black/10 px-6 py-4 dark:border-white/10">
                    <p className="text-sm font-semibold">直接导入题库 JSON</p>
                    <textarea
                      className="mt-3 min-h-40 w-full rounded-lg border border-black/10 bg-[var(--app-panel-bg)] p-3 font-mono text-xs outline-none focus:border-brand-600/60 dark:border-white/10 "
                      maxLength={100000}
                      onChange={(event) => setQuestionBankJson(event.target.value)}
                      placeholder='{"questions":[{"type":"SINGLE_CHOICE","stem":"提交漏洞前应先确认什么？","options":[{"key":"A","text":"是否在授权范围内"},{"key":"B","text":"是否能造成最大影响"}],"answerKeys":["A"],"explanation":"测试必须在授权范围内进行。"}]}'
                      value={questionBankJson}
                    />
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <p className="text-xs text-slate-500 dark:text-slate-400">当前启用：单选 {securityExamSettings?.activeCounts.SINGLE_CHOICE ?? 0} / 判断 {securityExamSettings?.activeCounts.TRUE_FALSE ?? 0} / 多选 {securityExamSettings?.activeCounts.MULTIPLE_CHOICE ?? 0}</p>
                      <ActionButton disabled={isQuestionBusy || !questionBankJson.trim()} icon={<Save className="h-4 w-4" />} label="直接入库" onClick={() => void handleCreateQuestionsFromJson()} />
                    </div>
                    {questionMessage && <p className="mt-3 text-sm text-brand-700 dark:text-brand-300">{questionMessage}</p>}
                  </div>
                </SettingsCard>
              </>
            )}

            {activeSection === '系统维护' && (
              <>
                <SettingsCard
                  description="用于检查学校服务器、Docker 私有化或本地部署环境的关键服务状态。"
                  icon={<ServerCog className="h-5 w-5" />}
                  title="服务状态"
                >
                  {[
                    ['部署模式', 'Docker / 学校服务器', '用于区分本地演示、Docker 私有化和学校服务器正式部署。'],
                    ['数据库', '连接正常', '用于存储用户、漏洞报告、证书、积分、学习资源和审计日志。'],
                    ['附件存储', '可写入', '用于漏洞报告、PDF、图片和知识库文件。'],
                    ['AI 服务', '可用', '模型服务和知识库索引处于可调用状态。'],
                    ['邮件服务', '待配置', 'SMTP 尚未完成正式配置，验证码和通知可能不可用。'],
                    ['当前版本', 'v0.2.10', '用于部署升级、问题定位和交付记录。'],
                  ].map(([title, value, description]) => (
                    <SettingRow control={<StatusPill label={value} />} description={description} key={title} title={title} />
                  ))}
                </SettingsCard>

                <SettingsCard
                  description="用于不同学校交付、测试环境和生产环境之间迁移平台配置。"
                  icon={<DatabaseBackup className="h-5 w-5" />}
                  title="备份与配置迁移"
                >
                  <div className="flex flex-wrap gap-2">
                    <ActionButton icon={<DatabaseBackup className="h-4 w-4" />} label="手动备份" />
                    <ActionButton icon={<Upload className="h-4 w-4" />} label="导入系统配置" />
                    <ActionButton icon={<FileText className="h-4 w-4" />} label="导出系统配置" />
                    <ActionButton icon={<ServerCog className="h-4 w-4" />} label="清理临时文件" danger />
                  </div>
                </SettingsCard>
              </>
            )}
          </div>
        </div>
      </section>

      {editingPaletteKey !== null && (
        <PaletteShadeDialog
          baseColor={baseGeneratedBrandPalette[editingPaletteKey]}
          color={paletteDraftColor}
          currentColor={generatedBrandPalette[editingPaletteKey]}
          isSaving={isSavingAppearance}
          onChange={(value) => setPaletteDraftColor(formatHexInput(value))}
          onClose={() => {
            setEditingPaletteKey(null)
            setPaletteDraftColor('')
          }}
          onReset={() => setPaletteDraftColor(baseGeneratedBrandPalette[editingPaletteKey])}
          onSave={savePaletteShade}
          paletteKey={editingPaletteKey}
        />
      )}

      {responsibilityAgreementEditorOpen && (
        <ResponsibilityAgreementEditorDialog
          content={responsibilityAgreementContent}
          fileInputRef={responsibilityAgreementInputRef}
          onCancel={() => setResponsibilityAgreementEditorOpen(false)}
          onChangeContent={setResponsibilityAgreementContent}
          onChangeTitle={setResponsibilityAgreementTitle}
          onImport={(file) => void handleResponsibilityAgreementFile(file)}
          onPublish={() => confirmChange({
            confirmLabel: '发布新版本',
            description: '发布后会立即停用当前责任书。所有需要提交漏洞的用户都必须重新阅读并签署新版本。',
            title: '确认发布责任书新版本？',
            onConfirm: () => void saveResponsibilityAgreement(),
          })}
          publishing={isSavingResponsibilityAgreement}
          title={responsibilityAgreementTitle}
        />
      )}

      {questionEditorOpen && (
        <SecurityQuestionEditorDialog
          busy={isQuestionBusy}
          onAdd={() => openQuestionEditor()}
          onCancel={() => {
            setQuestionEditorOpen(false)
            setEditingQuestion(null)
            setReplacingQuestion(null)
          }}
          onDelete={deleteQuestionFromEditor}
          onReplace={(question) => openQuestionEditor(question, true)}
          onSave={(question) => void saveQuestionFromEditor(question)}
          onSelect={(question) => openQuestionEditor(question)}
          questions={securityQuestions}
          replacingQuestion={replacingQuestion}
          selectedQuestion={editingQuestion}
        />
      )}

      <ConfirmDialog
        state={confirmState}
        onCancel={() => setConfirmState(null)}
        onConfirm={() => {
          confirmState?.onConfirm()
          setConfirmState(null)
        }}
      />
      <CertificateCoordinateDialog
        canvasSize={coordinateCanvasSize}
        layout={coordinateLayout}
        open={coordinateEditorOpen}
        previewUrl={coordinatePreviewUrl}
        sealSize={coordinateSealSize}
        sealUrl={coordinateSealUrl}
        saving={isSavingCoordinateLayout}
        templateMimeType={certificateTemplate?.templateMimeType}
        onCancel={() => setCoordinateEditorOpen(false)}
        onChange={setCoordinateLayout}
        onSave={() =>
          confirmChange({
            title: '确认保存证书坐标？',
            description: '保存后，后续新签发的漏洞证书会使用当前坐标配置。历史已生成证书不会自动重绘。',
            onConfirm: () => void saveCoordinateLayout(),
          })
        }
      />
    </>
  )
}

function SettingsCard({
  children,
  description,
  icon,
  title,
}: {
  children: ReactNode
  description: string
  icon: ReactNode
  title: string
}) {
  return (
    <SurfacePanel className="overflow-visible p-0">
      <div className="border-b border-black/10 px-6 py-5 dark:border-white/10">
        <div className="flex items-center gap-2 text-brand-700 dark:text-brand-300">
          {icon}
          <h2 className="text-xl font-semibold text-slate-950 dark:text-white">{title}</h2>
        </div>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      <div className="divide-y divide-black/10 dark:divide-white/10">{children}</div>
    </SurfacePanel>
  )
}

const securityQuestionTypeLabels: Record<SecurityQuestionType, string> = {
  MULTIPLE_CHOICE: '多选题',
  SINGLE_CHOICE: '单选题',
  TRUE_FALSE: '判断题',
}

type SecurityQuestionDraft = SecurityQuestionInput

function createSecurityQuestionDraft(question?: SecurityQuestionAdmin | null, replacement?: SecurityQuestionAdmin | null): SecurityQuestionDraft {
  const source = question ?? replacement
  const type = source?.type ?? 'SINGLE_CHOICE'
  if (!question) {
    return {
      answerKeys: [],
      explanation: '',
      options: type === 'TRUE_FALSE'
        ? [{ key: 'A', text: '正确' }, { key: 'B', text: '错误' }]
        : [{ key: 'A', text: '' }, { key: 'B', text: '' }, { key: 'C', text: '' }, { key: 'D', text: '' }],
      stem: '',
      type,
    }
  }
  return {
    answerKeys: [...question.answerKeys],
    explanation: question.explanation ?? '',
    options: question.options.map((option) => ({ ...option })),
    stem: question.stem,
    type: question.type,
  }
}

function SecurityQuestionEditorDialog({
  busy,
  onAdd,
  onCancel,
  onDelete,
  onReplace,
  onSave,
  onSelect,
  questions,
  replacingQuestion,
  selectedQuestion,
}: {
  busy: boolean
  onAdd: () => void
  onCancel: () => void
  onDelete: (question: SecurityQuestionAdmin) => void
  onReplace: (question: SecurityQuestionAdmin) => void
  onSave: (question: SecurityQuestionInput) => void
  onSelect: (question: SecurityQuestionAdmin) => void
  questions: SecurityQuestionAdmin[]
  replacingQuestion: SecurityQuestionAdmin | null
  selectedQuestion: SecurityQuestionAdmin | null
}) {
  const [draft, setDraft] = useState<SecurityQuestionDraft>(() => createSecurityQuestionDraft(selectedQuestion, replacingQuestion))

  useEffect(() => {
    setDraft(createSecurityQuestionDraft(selectedQuestion, replacingQuestion))
  }, [replacingQuestion, selectedQuestion])

  const setType = (type: SecurityQuestionType) => {
    setDraft((current) => ({
      ...current,
      answerKeys: [],
      options: type === 'TRUE_FALSE'
        ? [{ key: 'A', text: '正确' }, { key: 'B', text: '错误' }]
        : current.options.length >= 2 && current.type !== 'TRUE_FALSE'
          ? current.options
          : [{ key: 'A', text: '' }, { key: 'B', text: '' }, { key: 'C', text: '' }, { key: 'D', text: '' }],
      type,
    }))
  }

  const setAnswer = (key: string) => {
    setDraft((current) => ({
      ...current,
      answerKeys: current.type === 'MULTIPLE_CHOICE'
        ? current.answerKeys.includes(key)
          ? current.answerKeys.filter((item) => item !== key)
          : [...current.answerKeys, key]
        : [key],
    }))
  }

  const updateOption = (key: string, text: string) => {
    setDraft((current) => ({ ...current, options: current.options.map((option) => option.key === key ? { ...option, text } : option) }))
  }

  const addOption = () => {
    setDraft((current) => current.options.length >= 8 ? current : {
      ...current,
      options: [...current.options, { key: String.fromCharCode(65 + current.options.length), text: '' }],
    })
  }

  const removeOption = (key: string) => {
    setDraft((current) => current.options.length <= 2 ? current : {
      ...current,
      answerKeys: current.answerKeys.filter((item) => item !== key),
      options: current.options.filter((option) => option.key !== key),
    })
  }

  const valid = draft.stem.trim().length >= 6
    && draft.options.every((option) => option.text.trim())
    && draft.answerKeys.length > 0
    && (draft.type !== 'MULTIPLE_CHOICE' || draft.answerKeys.length >= 2)

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/35 px-4 py-6 backdrop-blur-sm">
      <div className="flex h-[min(88vh,760px)] w-full max-w-6xl overflow-hidden rounded-lg border border-black/10 bg-[var(--app-menu-bg)] shadow-2xl dark:border-white/10">
        <aside className="flex w-80 shrink-0 flex-col border-r border-black/10 dark:border-white/10">
          <div className="flex items-center justify-between gap-3 border-b border-black/10 px-4 py-4 dark:border-white/10">
            <div>
              <h2 className="text-base font-semibold">题库编辑</h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">共 {questions.length} 道题</p>
            </div>
            <button className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-brand-700" disabled={busy} onClick={onAdd} type="button">新增题目</button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {questions.map((question) => (
              <button
                className={`mb-1 w-full rounded-lg px-3 py-2.5 text-left transition ${selectedQuestion?.id === question.id && !replacingQuestion ? 'bg-brand-600/10 text-brand-800 dark:bg-brand-300/10 dark:text-brand-200' : 'hover:bg-black/[0.05] dark:hover:bg-white/[0.06]'}`}
                key={question.id}
                onClick={() => onSelect(question)}
                type="button"
              >
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${question.active ? 'bg-brand-600' : 'bg-slate-300 dark:bg-white/30'}`} />
                  <span className="text-xs text-slate-500 dark:text-slate-400">{securityQuestionTypeLabels[question.type]}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm font-medium">{question.stem}</p>
              </button>
            ))}
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-black/10 px-6 py-4 dark:border-white/10">
            <div>
              <h2 className="text-lg font-semibold">{replacingQuestion ? `替换题目：${replacingQuestion.stem.slice(0, 24)}` : selectedQuestion ? '编辑题目' : '新增题目'}</h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">保存后题目会进入题库；替换会保留旧题的历史答题记录。</p>
            </div>
            <button aria-label="关闭题库编辑" className="rounded-lg p-2 text-slate-500 transition hover:bg-black/5 dark:hover:bg-white/10" onClick={onCancel} type="button"><X className="h-5 w-5" /></button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <label className="block">
              <span className="text-sm font-semibold">题型</span>
              <select className="mt-2 rounded-lg border border-black/10 bg-[var(--app-panel-bg)] px-3 py-2 text-sm outline-none focus:border-brand-600/60 dark:border-white/10" onChange={(event) => setType(event.target.value as SecurityQuestionType)} value={draft.type}>
                {(Object.keys(securityQuestionTypeLabels) as SecurityQuestionType[]).map((type) => <option key={type} value={type}>{securityQuestionTypeLabels[type]}</option>)}
              </select>
            </label>
            <label className="mt-5 block">
              <span className="text-sm font-semibold">题干</span>
              <textarea className="mt-2 min-h-24 w-full resize-y rounded-lg border border-black/10 bg-[var(--app-panel-bg)] p-3 text-sm leading-6 outline-none focus:border-brand-600/60 dark:border-white/10" maxLength={500} onChange={(event) => setDraft((current) => ({ ...current, stem: event.target.value }))} value={draft.stem} />
            </label>
            <div className="mt-5">
              <div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold">选项与正确答案</span>{draft.type !== 'TRUE_FALSE' && <button className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-300" disabled={draft.options.length >= 8} onClick={addOption} type="button">添加选项</button>}</div>
              <div className="mt-2 space-y-2">
                {draft.options.map((option) => (
                  <div className="flex items-center gap-2" key={option.key}>
                    <button aria-label={`设为 ${option.key} 正确答案`} className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition ${draft.answerKeys.includes(option.key) ? 'border-brand-600 bg-brand-600 text-white' : 'border-black/10 text-slate-500 hover:border-brand-600/50 dark:border-white/10 dark:text-slate-400'}`} onClick={() => setAnswer(option.key)} type="button">{option.key}</button>
                    <input autoComplete="off" className="min-w-0 flex-1 rounded-lg border border-black/10 bg-[var(--app-panel-bg)] px-3 py-2 text-sm outline-none focus:border-brand-600/60 dark:border-white/10" disabled={draft.type === 'TRUE_FALSE'} maxLength={500} onChange={(event) => updateOption(option.key, event.target.value)} value={option.text} />
                    {draft.type !== 'TRUE_FALSE' && <button aria-label={`删除选项 ${option.key}`} className="rounded-lg p-2 text-slate-400 transition hover:bg-red-500/10 hover:text-red-600 disabled:opacity-40" disabled={draft.options.length <= 2} onClick={() => removeOption(option.key)} type="button"><X className="h-4 w-4" /></button>}
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{draft.type === 'MULTIPLE_CHOICE' ? '多选题至少选择两个正确答案。' : '单选题和判断题只能选择一个正确答案。'}</p>
            </div>
            <label className="mt-5 block">
              <span className="text-sm font-semibold">答案解析</span>
              <textarea className="mt-2 min-h-20 w-full resize-y rounded-lg border border-black/10 bg-[var(--app-panel-bg)] p-3 text-sm leading-6 outline-none focus:border-brand-600/60 dark:border-white/10" maxLength={1000} onChange={(event) => setDraft((current) => ({ ...current, explanation: event.target.value }))} value={draft.explanation ?? ''} />
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/10 px-6 py-4 dark:border-white/10">
            <div>
              {selectedQuestion && !replacingQuestion && <button className="rounded-lg px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-500/10 dark:text-red-300" disabled={busy} onClick={() => onDelete(selectedQuestion)} type="button">删除题目</button>}
              {selectedQuestion && !replacingQuestion && <button className="ml-2 rounded-lg border border-black/10 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10" disabled={busy} onClick={() => onReplace(selectedQuestion)} type="button">替换题目</button>}
            </div>
            <button
              className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={busy || !valid}
              onClick={() => onSave({
                ...draft,
                answerKeys: [...draft.answerKeys].sort(),
                explanation: draft.explanation?.trim() || undefined,
                options: draft.options.map((option) => ({ ...option, text: option.text.trim() })),
                stem: draft.stem.trim(),
              })}
              type="button"
            >
              {busy ? '保存中...' : replacingQuestion ? '确认替换' : selectedQuestion ? '保存修改' : '添加题目'}
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}

function ResponsibilityAgreementEditorDialog({
  content,
  fileInputRef,
  onCancel,
  onChangeContent,
  onChangeTitle,
  onImport,
  onPublish,
  publishing,
  title,
}: {
  content: string
  fileInputRef: RefObject<HTMLInputElement | null>
  onCancel: () => void
  onChangeContent: (value: string) => void
  onChangeTitle: (value: string) => void
  onImport: (file: File | undefined) => void
  onPublish: () => void
  publishing: boolean
  title: string
}) {
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/35 px-4 py-6 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-black/10 bg-[var(--app-menu-bg)] shadow-2xl dark:border-white/10">
        <div className="flex items-start justify-between gap-4 border-b border-black/10 px-6 py-5 dark:border-white/10">
          <div>
            <div className="flex items-center gap-2 text-brand-700 dark:text-brand-300">
              <FileText className="h-5 w-5" />
              <h2 className="text-xl font-semibold text-slate-950 dark:text-white">编辑网络安全测试责任书</h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">可直接编辑正文，或导入 `.md` 文件。发布会生成新版本并保留既有签署记录。</p>
          </div>
          <button
            aria-label="关闭责任书编辑器"
            className="rounded-lg p-2 text-slate-500 transition hover:bg-black/5 hover:text-slate-950 dark:hover:bg-white/10 dark:hover:text-white"
            disabled={publishing}
            onClick={onCancel}
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <label className="block">
            <span className="text-sm font-semibold text-slate-900 dark:text-white">责任书标题</span>
            <input
              autoComplete="off"
              className="mt-2 w-full rounded-lg border border-black/10 bg-[var(--app-panel-bg)] px-3 py-2.5 text-sm outline-none transition focus:border-brand-600/60 dark:border-white/10"
              maxLength={120}
              onChange={(event) => onChangeTitle(event.target.value)}
              value={title}
            />
          </label>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">责任书正文</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">支持 Markdown 标题、列表和普通段落，最多 100,000 个字符。</p>
            </div>
            <ActionButton icon={<Upload className="h-4 w-4" />} label="导入 .md 文件" onClick={() => fileInputRef.current?.click()} />
            <input
              accept="text/markdown,.md"
              className="hidden"
              onChange={(event) => onImport(event.target.files?.[0])}
              ref={fileInputRef}
              type="file"
            />
          </div>
          <textarea
            className="mt-3 min-h-[420px] w-full resize-y rounded-lg border border-black/10 bg-[var(--app-panel-bg)] p-4 font-mono text-sm leading-7 outline-none transition focus:border-brand-600/60 dark:border-white/10"
            maxLength={100_000}
            onChange={(event) => onChangeContent(event.target.value)}
            placeholder="请输入责任书正文，或导入 .md 文件。"
            value={content}
          />
          <p className="mt-2 text-right text-xs text-slate-500 dark:text-slate-400">{content.length.toLocaleString()} / 100,000</p>
        </div>

        <div className="flex flex-col gap-3 border-t border-black/10 px-6 py-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-amber-700 dark:text-amber-300">发布新版本后，当前责任书会停用，用户需要重新签署后才能继续提交漏洞。</p>
          <div className="flex shrink-0 justify-end gap-3">
            <button
              className="rounded-lg border border-black/10 px-4 py-2.5 text-sm font-medium transition hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
              disabled={publishing}
              onClick={onCancel}
              type="button"
            >
              取消
            </button>
            <button
              className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={publishing || !title.trim() || !content.trim()}
              onClick={onPublish}
              type="button"
            >
              {publishing ? '发布中...' : '发布新版本'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function SettingRow({
  control,
  description,
  title,
}: {
  control: ReactNode
  description: string
  title: string
}) {
  return (
    <div className="grid gap-4 px-6 py-4 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-center">
      <div>
        <p className="text-sm font-semibold text-slate-950 dark:text-white">{title}</p>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      <div className="min-w-0">{control}</div>
    </div>
  )
}

const themeColorPresets = [
  '#2A6438',
  '#25615B',
  '#315F86',
  '#5B547D',
  '#7A5C32',
  '#8A3E4F',
  '#374151',
  '#426A62',
]

function ThemeColorPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const normalizedValue = normalizeHexColor(value)
  const pickerValue = normalizedValue ?? '#2A6438'

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <label
          className="relative flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-black/10 shadow-sm transition hover:scale-[1.02] dark:border-white/10"
          style={{ background: pickerValue }}
          title="打开调色盘"
        >
          <Palette className="h-5 w-5 text-white drop-shadow" />
          <input
            aria-label="打开主题色调色盘"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            onChange={(event) => onChange(event.target.value.toUpperCase())}
            type="color"
            value={pickerValue}
          />
        </label>
        <TextField onChange={(nextValue) => onChange(formatHexInput(nextValue))} value={value} />
      </div>
      <div className="grid grid-cols-8 gap-2">
        {themeColorPresets.map((color) => {
          const active = pickerValue === color
          return (
            <button
              aria-label={`使用主题色 ${color}`}
              className={`h-8 rounded-lg border transition hover:scale-105 ${
                active ? 'border-slate-950 ring-2 ring-slate-950/15 dark:border-white dark:ring-white/20' : 'border-black/10 dark:border-white/10'
              }`}
              key={color}
              onClick={() => onChange(color)}
              style={{ background: color }}
              title={color}
              type="button"
            />
          )
        })}
      </div>
      {!normalizedValue && (
        <p className="text-xs text-red-600 dark:text-red-400">请输入 #RRGGBB 格式，或直接使用左侧调色盘。</p>
      )}
    </div>
  )
}

function PaletteSlotRow({
  basePalette,
  onEdit,
  palette,
  slots,
  themePalette,
  title,
}: {
  basePalette: BrandPalette
  onEdit: (slot: BrandColorSlot) => void
  palette: BrandPalette
  slots: BrandColorSlot[]
  themePalette: BrandPalette
  title: string
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{title}</p>
        <p className="text-[11px] text-slate-400 dark:text-slate-500">点击色块微调</p>
      </div>
      <div className="grid gap-3 md:grid-cols-5">
        {slots.map((slot) => {
          const meta = brandColorSlotMeta[slot]
          const customized = themePalette[slot] !== basePalette[slot]
          return (
            <button
              aria-label={`编辑${meta.group}${meta.label} ${palette[slot]}`}
              className="group overflow-hidden rounded-lg border border-black/10 bg-white text-left text-xs transition hover:-translate-y-0.5 hover:border-brand-600/40 hover:shadow-lg hover:shadow-brand-600/10 focus:outline-none focus:ring-2 focus:ring-brand-600/30 dark:border-white/10 dark:bg-white/[0.03]"
              key={slot}
              onClick={() => onEdit(slot)}
              type="button"
            >
              <div className="relative h-11" style={{ background: palette[slot] }}>
                {customized && <span className="absolute right-1.5 top-1.5 rounded bg-black/35 px-1.5 py-0.5 text-[10px] font-medium text-white">自定义</span>}
              </div>
              <div className="px-2 py-2">
                <p className="font-semibold text-slate-800 dark:text-slate-200">{meta.label}</p>
                <p className="mt-1 font-mono text-[10px] text-slate-500 dark:text-slate-400">{palette[slot]}</p>
                <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-slate-400 dark:text-slate-500">{meta.usage}</p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function PaletteShadeDialog({
  baseColor,
  color,
  currentColor,
  isSaving,
  onChange,
  onClose,
  onReset,
  onSave,
  paletteKey,
}: {
  baseColor: string
  color: string
  currentColor: string
  isSaving: boolean
  onChange: (value: string) => void
  onClose: () => void
  onReset: () => void
  onSave: () => void
  paletteKey: BrandColorSlot
}) {
  const normalizedColor = normalizeHexColor(color)
  const previewColor = normalizedColor ?? currentColor
  const changed = normalizedColor !== null && normalizedColor !== currentColor
  const resetDisabled = baseColor === currentColor && baseColor === previewColor
  const meta = brandColorSlotMeta[paletteKey]

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 px-5 py-8 backdrop-blur-sm">
      <button aria-label="关闭色卡编辑弹窗" className="absolute inset-0" disabled={isSaving} onClick={onClose} type="button" />
      <div className="relative w-full max-w-[520px] overflow-hidden rounded-lg border border-black/10 bg-[var(--app-menu-bg)] text-slate-950 shadow-2xl dark:border-white/10 dark:text-white">
        <div className="flex items-start justify-between gap-4 border-b border-black/10 px-6 py-5 dark:border-white/10">
          <div>
            <h2 className="mt-0 text-xl font-semibold">编辑{meta.label}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
              {meta.group}，{meta.usage}。应用后进入当前色卡预览，最终点击下方“保存外观设置”统一保存到全平台。
            </p>
          </div>
          <button
            aria-label="关闭"
            className="rounded-md p-2 text-slate-500 transition hover:bg-black/5 hover:text-slate-950 disabled:opacity-50 dark:text-white/45 dark:hover:bg-white/10 dark:hover:text-white"
            disabled={isSaving}
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-4">
            <div className="overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
              <div className="h-28" style={{ background: previewColor }} />
              <div className="px-3 py-2">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">实时预览</p>
                <p className="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400">{previewColor}</p>
              </div>
            </div>
            <div>
              <ThemeColorPicker onChange={onChange} value={color} />
              <div className="mt-3 grid gap-2 text-xs text-slate-500 dark:text-slate-400 sm:grid-cols-2">
                <div className="rounded-lg border border-black/10 bg-[var(--app-panel-muted-bg)] px-3 py-2 dark:border-white/10">
                  <span className="block">生成默认值</span>
                  <span className="mt-1 block font-mono text-slate-700 dark:text-slate-200">{baseColor}</span>
                </div>
                <div className="rounded-lg border border-black/10 bg-[var(--app-panel-muted-bg)] px-3 py-2 dark:border-white/10">
                  <span className="block">当前生效值</span>
                  <span className="mt-1 block font-mono text-slate-700 dark:text-slate-200">{currentColor}</span>
                </div>
              </div>
              {!normalizedColor && <p className="mt-3 text-xs text-red-600 dark:text-red-400">请输入有效的 #RRGGBB 十六进制颜色。</p>}
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-black/10 px-6 py-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
          <button
            className="rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-55 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
            disabled={isSaving || resetDisabled}
            onClick={onReset}
            type="button"
          >
            恢复生成默认值
          </button>
          <div className="flex justify-end gap-2">
            <button
              className="rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-black/5 disabled:opacity-55 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
              disabled={isSaving}
              onClick={onClose}
              type="button"
            >
              取消
            </button>
            <button
              className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSaving || !changed}
              onClick={onSave}
              type="button"
            >
              {isSaving ? '应用中...' : '应用到色卡'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function TextField({ value, onChange, type = 'text' }: { value: string; onChange?: (v: string) => void; type?: string }) {
  const controlled = onChange !== undefined
  return (
    <input
      autoComplete={type === 'password' ? 'new-password' : 'off'}
      className="w-full rounded-lg border border-black/10 bg-[var(--app-panel-bg)] px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10  dark:text-white"
      defaultValue={controlled ? undefined : value}
      maxLength={type === 'password' ? 128 : 500}
      onChange={controlled ? (e) => onChange(e.target.value) : undefined}
      type={type}
      value={controlled ? value : undefined}
    />
  )
}

function validateBrandImageFile(file: File, maxBytes: number) {
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!validTypes.includes(file.type)) return '图标仅支持 JPG、PNG、WebP、GIF 格式'
  if (file.size > maxBytes) return '图标文件不能超过 2MB'
  return ''
}

function isErrorMessage(message: string) {
  return ['失败', '错误', '必须', '不能', '仅支持', '无效'].some((keyword) => message.includes(keyword))
}

function SettingToggle({
  enabled,
  onChange,
}: {
  enabled: boolean
  onChange?: () => void
}) {
  return (
    <button
      aria-pressed={enabled}
      className="flex w-full items-center justify-end rounded-lg px-1 py-1 text-left transition hover:bg-black/5 dark:hover:bg-white/10"
      onClick={onChange}
      type="button"
    >
      <span className={`flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition ${enabled ? 'bg-brand-600' : 'bg-slate-300 dark:bg-white/20'}`}>
        <span className={`h-5 w-5 rounded-full bg-white shadow-sm transition ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
      </span>
    </button>
  )
}

function ActionButton({
  danger = false,
  disabled = false,
  icon,
  label,
  onClick,
}: {
  danger?: boolean
  disabled?: boolean
  icon: ReactNode
  label: string
  onClick?: () => void
}) {
  return (
    <button
      className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition ${
        danger
          ? 'border-red-500/20 text-red-700 hover:bg-red-500/10 dark:text-red-300'
          : 'border-black/10 text-slate-700 hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10'
      } disabled:cursor-not-allowed disabled:opacity-55`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {icon}
      {label}
    </button>
  )
}

function StatusPill({ label }: { label: string }) {
  const pending = label.includes('待')
  return (
    <span
      className={`inline-flex rounded-lg border px-3 py-2 text-sm font-medium ${
        pending
          ? 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300'
          : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
      }`}
    >
      {label}
    </span>
  )
}

function formatDateTime(value: string | null) {
  if (!value) return '暂无记录'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '暂无记录'
  return new Intl.DateTimeFormat('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function normalizeCertificateLayout(value: unknown): CertificateLayoutConfig {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const layout = certificateLayoutFields.reduce((nextLayout, field) => {
    const current = source[field.key]
    const point = current && typeof current === 'object' && !Array.isArray(current) ? current as Record<string, unknown> : {}
    const fallback = defaultCertificateLayout[field.key]
    nextLayout[field.key] = {
      align: point.align === 'center' || point.align === 'right' || point.align === 'left' ? point.align : fallback.align,
      fontSize: normalizeOptionalCoordinateNumber(point.fontSize, fallback.fontSize),
      height: normalizeOptionalCoordinateNumber(point.height, fallback.height),
      width: normalizeOptionalCoordinateNumber(point.width, fallback.width),
      x: normalizeCoordinateNumber(point.x, fallback.x),
      y: normalizeCoordinateNumber(point.y, fallback.y),
    }
    return nextLayout
  }, {} as CertificateLayoutConfig)

  layout.fontFamily = normalizeCertificateFontFamily(source.fontFamily)
  return layout
}

function normalizeCoordinateNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function normalizeOptionalCoordinateNumber(value: unknown, fallback: number | undefined) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  return fallback
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function normalizeCertificateFontFamily(value: unknown): CertificateFontFamily {
  return value === 'notoSansCjk' || value === 'simHei' || value === 'microsoftYaHei' || value === 'systemSans'
    ? value
    : defaultCertificateLayout.fontFamily
}

function CertificateCoordinateDialog({
  canvasSize,
  layout,
  onCancel,
  onChange,
  onSave,
  open,
  previewUrl,
  sealSize,
  sealUrl,
  saving,
  templateMimeType,
}: {
  canvasSize: CertificateCanvasSize
  layout: CertificateLayoutConfig
  onCancel: () => void
  onChange: (layout: CertificateLayoutConfig) => void
  onSave: () => void
  open: boolean
  previewUrl: string
  sealSize: CertificateCanvasSize | null
  sealUrl: string
  saving: boolean
  templateMimeType?: string
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const planeRef = useRef<HTMLDivElement | null>(null)
  const draggableRefs = useRef<Partial<Record<CertificateLayoutKey, HTMLButtonElement | null>>>({})
  const dragOffsetRef = useRef<{ key: CertificateLayoutKey; x: number; y: number } | null>(null)
  const [viewportWidth, setViewportWidth] = useState(canvasSize.width)
  const [snapGuideX, setSnapGuideX] = useState<number | null>(null)

  useEffect(() => {
    if (!open || !viewportRef.current) return

    const updateWidth = () => {
      setViewportWidth(viewportRef.current?.clientWidth || canvasSize.width)
    }
    updateWidth()

    const observer = new ResizeObserver(updateWidth)
    observer.observe(viewportRef.current)
    return () => observer.disconnect()
  }, [canvasSize.width, open])

  const scale = Math.min(1, viewportWidth / canvasSize.width)
  const scaledHeight = canvasSize.height * scale
  const selectedFont = certificateFontOptions.find((item) => item.value === layout.fontFamily) ?? certificateFontOptions[0]

  if (!open) return null

  function getPointerCoordinate(clientX: number, clientY: number) {
    const rect = planeRef.current?.getBoundingClientRect()
    if (!rect) return
    return {
      x: ((clientX - rect.left) / rect.width) * canvasSize.width,
      y: ((clientY - rect.top) / rect.height) * canvasSize.height,
    }
  }

  function startDrag(key: CertificateLayoutKey, clientX: number, clientY: number) {
    const pointer = getPointerCoordinate(clientX, clientY)
    if (!pointer) return
    dragOffsetRef.current = {
      key,
      x: pointer.x - layout[key].x,
      y: pointer.y - layout[key].y,
    }
  }

  function moveField(key: CertificateLayoutKey, clientX: number, clientY: number) {
    const pointer = getPointerCoordinate(clientX, clientY)
    if (!pointer) return
    const offset = dragOffsetRef.current?.key === key ? dragOffsetRef.current : { x: 0, y: 0 }
    const rawX = pointer.x - offset.x
    const snapped = getSnappedX(key, rawX)
    const y = Math.round(pointer.y - offset.y)
    onChange({
      ...layout,
      [key]: {
        ...layout[key],
        x: clampNumber(Math.round(snapped.x), 0, canvasSize.width),
        y: clampNumber(y, 0, canvasSize.height),
      },
    })
    setSnapGuideX(snapped.guideX)
  }

  function getElementMetrics(key: CertificateLayoutKey) {
    const element = draggableRefs.current[key]
    const plane = planeRef.current
    if (!element || !plane) return null

    const elementRect = element.getBoundingClientRect()
    const planeRect = plane.getBoundingClientRect()
    const left = ((elementRect.left - planeRect.left) / planeRect.width) * canvasSize.width
    const right = ((elementRect.right - planeRect.left) / planeRect.width) * canvasSize.width
    return {
      center: (left + right) / 2,
      left,
      right,
    }
  }

  function getSnappedX(key: CertificateLayoutKey, rawX: number) {
    const current = getElementMetrics(key)
    const currentPoint = layout[key]
    if (!current) return { guideX: null, x: rawX }

    const movingAnchors = [
      { offset: current.left - currentPoint.x },
      { offset: current.center - currentPoint.x },
      { offset: current.right - currentPoint.x },
    ]
    const snapDistance = 8 / Math.max(scale, 0.2)
    let best: { distance: number; guideX: number; x: number } | null = null

    certificateLayoutFields.forEach((field) => {
      if (field.key === key) return
      const target = getElementMetrics(field.key)
      if (!target) return

      ;[target.left, target.center, target.right].forEach((targetX) => {
        movingAnchors.forEach((anchor) => {
          const candidateX = rawX + anchor.offset
          const distance = Math.abs(candidateX - targetX)
          if (distance > snapDistance) return
          if (best && distance >= best.distance) return
          best = {
            distance,
            guideX: targetX,
            x: targetX - anchor.offset,
          }
        })
      })
    })

    return best ? { guideX: best.guideX, x: best.x } : { guideX: null, x: rawX }
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/45 px-5 py-8 backdrop-blur-sm">
      <div className="flex max-h-full w-full max-w-6xl flex-col rounded-lg border border-black/10 bg-[var(--app-menu-bg)] shadow-2xl backdrop-blur-xl dark:border-white/10 ">
        <div className="flex items-start justify-between gap-4 border-b border-black/10 px-6 py-5 dark:border-white/10">
          <div>
            <h2 className="text-xl font-semibold">配置证书坐标</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
              左侧按模板真实尺寸显示，拖动时会自动用当前项的左侧、中线、右侧吸附其他项的左侧、中线、右侧。
            </p>
          </div>
          <button
            aria-label="关闭坐标配置"
            className="rounded-lg p-2 text-slate-500 transition hover:bg-black/5 hover:text-slate-950 dark:hover:bg-white/10 dark:hover:text-white"
            onClick={onCancel}
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid min-h-0 gap-5 overflow-auto p-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0">
            <div
              className="relative mx-auto w-full max-w-[960px] overflow-auto rounded-lg border border-black/10 bg-slate-200 p-3 shadow-inner dark:border-white/10 dark:bg-black/20"
              ref={viewportRef}
              style={{ height: scaledHeight + 24 }}
            >
              <div
                className="relative origin-top-left overflow-hidden bg-white"
                ref={planeRef}
                style={{
                  height: canvasSize.height,
                  transform: `scale(${scale})`,
                  width: canvasSize.width,
                }}
              >
                {previewUrl ? (
                  templateMimeType === 'application/pdf' ? (
                    <object
                      className="pointer-events-none absolute inset-0 h-full w-full"
                      data={`${previewUrl}#toolbar=0&navpanes=0&scrollbar=0&page=1&view=Fit`}
                      type="application/pdf"
                    />
                  ) : (
                    <img alt="证书模板背景" className="pointer-events-none absolute inset-0 h-full w-full" src={previewUrl} />
                  )
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500">正在加载证书模板...</div>
                )}

                {certificateLayoutFields.map((field) => {
                  const point = layout[field.key]
                  const isSeal = field.type === 'seal'
                  const sealWidth = point.width ?? defaultCertificateLayout.seal.width ?? 120
                  const sealHeight = point.height ?? (coordinateSealRatio(sealSize) ? sealWidth * coordinateSealRatio(sealSize) : sealWidth)
                  return (
                    <button
                      aria-label={`拖动${field.label}`}
                      className={`absolute cursor-grab select-none p-0 ring-1 ring-brand-600/40 active:cursor-grabbing ${
                        isSeal ? 'bg-brand-600/10' : 'bg-transparent text-slate-900'
                      }`}
                      key={field.key}
                      onPointerCancel={() => {
                        dragOffsetRef.current = null
                        setSnapGuideX(null)
                      }}
                      onPointerDown={(event) => {
                        event.currentTarget.setPointerCapture(event.pointerId)
                        startDrag(field.key, event.clientX, event.clientY)
                      }}
                      onPointerMove={(event) => {
                        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
                        moveField(field.key, event.clientX, event.clientY)
                      }}
                      onPointerUp={(event) => {
                        dragOffsetRef.current = null
                        setSnapGuideX(null)
                        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                          event.currentTarget.releasePointerCapture(event.pointerId)
                        }
                      }}
                      ref={(node) => {
                        draggableRefs.current[field.key] = node
                      }}
                      style={{
                        fontSize: point.fontSize ?? 12,
                        fontFamily: selectedFont.css,
                        height: isSeal ? sealHeight : undefined,
                        left: point.x,
                        lineHeight: 1,
                        top: point.y,
                        transform: !isSeal && point.align === 'center' ? 'translateX(-50%)' : !isSeal && point.align === 'right' ? 'translateX(-100%)' : undefined,
                        width: isSeal ? sealWidth : undefined,
                      }}
                      title={field.label}
                      type="button"
                    >
                      {isSeal ? (
                        sealUrl ? (
                          <img alt="电子印章" className="pointer-events-none h-full w-full" src={sealUrl} />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-xs text-brand-700">印章</span>
                        )
                      ) : (
                        <span className="whitespace-nowrap font-medium">{field.sample}</span>
                      )}
                    </button>
                  )
                })}
                {snapGuideX !== null && (
                  <div
                    className="pointer-events-none absolute bottom-0 top-0 w-px bg-brand-600/80"
                    style={{ left: snapGuideX }}
                  />
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-lg border border-black/10 bg-[var(--app-panel-bg)] p-3 text-xs dark:border-white/10 ">
              <label className="block">
                <span className="font-medium">全局字体</span>
                <select
                  className="mt-2 w-full rounded border border-black/10 bg-white px-2 py-2 text-xs outline-none dark:border-white/10 dark:bg-black/20"
                  onChange={(event) => onChange({ ...layout, fontFamily: event.target.value as CertificateFontFamily })}
                  value={layout.fontFamily}
                >
                  {certificateFontOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="text-sm font-semibold">当前坐标</p>
            <div className="space-y-2">
              {certificateLayoutFields.map((field) => {
                const point = layout[field.key]
                return (
                  <div className="rounded-lg border border-black/10 bg-[var(--app-panel-bg)] p-3 text-xs dark:border-white/10 " key={field.key}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{field.label}</span>
                      <span className="font-mono text-slate-500">
                        {point.x}, {point.y}
                      </span>
                    </div>
                    <div className={`mt-2 grid gap-2 ${field.type === 'seal' ? 'grid-cols-3' : 'grid-cols-3'}`}>
                      <SmallNumberInput label="X" value={point.x} onChange={(x) => onChange({ ...layout, [field.key]: { ...point, x } })} />
                      <SmallNumberInput label="Y" value={point.y} onChange={(y) => onChange({ ...layout, [field.key]: { ...point, y } })} />
                      {field.type === 'seal' ? (
                        <SmallNumberInput label="大小" value={point.width ?? 120} onChange={(width) => onChange({ ...layout, [field.key]: { ...point, width } })} />
                      ) : (
                        <SmallNumberInput label="字号" value={point.fontSize ?? 12} onChange={(fontSize) => onChange({ ...layout, [field.key]: { ...point, fontSize } })} />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-black/10 px-6 py-4 dark:border-white/10">
          <button
            className="rounded-lg border border-black/10 px-4 py-2.5 text-sm font-medium transition hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
            onClick={onCancel}
            type="button"
          >
            取消
          </button>
          <button
            className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={saving}
            onClick={onSave}
            type="button"
          >
            {saving ? '保存中...' : '保存坐标'}
          </button>
        </div>
      </div>
    </div>
  )
}

function coordinateSealRatio(sealSize: CertificateCanvasSize | null) {
  if (!sealSize || !sealSize.width) return null
  return sealSize.height / sealSize.width
}

function SmallNumberInput({ label, onChange, value }: { label: string; onChange: (value: number) => void; value: number }) {
  return (
    <label className="block">
      <span className="text-[10px] text-slate-500">{label}</span>
      <input
        className="mt-1 w-full rounded border border-black/10 bg-[var(--app-panel-bg)] px-2 py-1 font-mono text-xs outline-none dark:border-white/10 dark:bg-black/20"
        max={10000}
        min={-10000}
        onChange={(event) => onChange(Number(event.target.value) || 0)}
        type="number"
        value={value}
      />
    </label>
  )
}

function ConfirmDialog({
  onCancel,
  onConfirm,
  state,
}: {
  onCancel: () => void
  onConfirm: () => void
  state: ConfirmState
}) {
  if (!state) return null

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/35 px-5 backdrop-blur-sm">
      <div className="w-full max-w-[520px] rounded-lg border border-black/10 bg-[var(--app-menu-bg)] p-6 shadow-2xl backdrop-blur-xl dark:border-white/10 ">
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3">
            <span className={`mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${state.danger ? 'bg-red-500/10 text-red-700 dark:text-red-300' : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'}`}>
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-xl font-semibold">{state.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{state.description}</p>
            </div>
          </div>
          <button
            aria-label="关闭确认弹窗"
            className="rounded-lg p-2 text-slate-500 transition hover:bg-black/5 hover:text-slate-950 dark:hover:bg-white/10 dark:hover:text-white"
            onClick={onCancel}
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            className="rounded-lg border border-black/10 px-4 py-2.5 text-sm font-medium transition hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
            onClick={onCancel}
            type="button"
          >
            取消
          </button>
          <button
            className={`rounded-lg px-4 py-2.5 text-sm font-medium text-white transition ${state.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-600 hover:bg-brand-700'}`}
            onClick={onConfirm}
            type="button"
          >
            {state.confirmLabel ?? '确认修改'}
          </button>
        </div>
      </div>
    </div>
  )
}
