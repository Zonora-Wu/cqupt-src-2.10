import { apiFormRequest, apiBlobRequest, apiBlobResponse, apiRequest } from './apiClient'

export type CertificateTemplateSummary = {
  active: boolean
  createdAt: string
  id: string
  layoutJson: unknown
  name: string
  sealConfigured: boolean
  templateMimeType: string
  templateSizeBytes: number
  updatedAt: string
  version: string
}

export type PlatformSettings = {
  authLogoUrl: string | null
  authLogoUrlDark: string | null
  faviconUrl: string | null
  fontDisplayName: string
  fontFamily: string
  fontSource: 'CUSTOM' | 'PRESET'
  fontUrl: string | null
  logoUrl: string | null
  navigationLogoUrl: string | null
  navigationLogoUrlDark: string | null
  platformName: string
  schoolName: string
  orgName: string
  platformDomain: string
  publicCertVerify: boolean
  themeColor: string
  themePalette: Record<string, string>
}

export type AiAssistantAppearance = {
  avatarUrl: string | null
}

export type AiQuotaSettings = {
  defaultDailyTokens: number
  defaultMonthlyTokens: number
  defaultWeeklyTokens: number
  quotaPeriod: 'DAY' | 'WEEK' | 'MONTH'
  resetAt: string
}

export type AiUserModelPolicy = 'USER_PLATFORM_ONLY' | 'USER_BYOK_ONLY' | 'USER_HYBRID'

export function getAiModelPolicy() {
  return request<{ userMode: AiUserModelPolicy; updatedAt: string | null }>('/system-settings/ai-model-policy', { method: 'GET' })
}

export function updateAiModelPolicy(userMode: AiUserModelPolicy) {
  return request<{ userMode: AiUserModelPolicy; updatedAt: string }>('/system-settings/ai-model-policy', {
    body: { userMode },
    method: 'PUT',
  })
}

export type PlatformAiRoute = {
  automaticFailover: boolean
  baseUrl: string
  circuitOpenUntil: string | null
  credentialLastFour: string
  credentialName: string
  id: string
  model: string
  priority: number
  providerId: string
  purpose: 'GLOBAL' | 'USER_INTERACTIVE' | 'ADMIN_INTERACTIVE' | 'AUDITOR_INTERACTIVE' | 'BACKGROUND_TASK' | 'STRUCTURED_ANALYSIS' | 'SKILL_GENERATION'
}

export function getPlatformAiConfig() {
  return request<{ routes: PlatformAiRoute[] }>('/system-settings/platform-ai', { method: 'GET' })
}

export function savePlatformAiRoute(data: {
  apiKey: string
  automaticFailover: boolean
  baseUrl?: string
  model: string
  name: string
  priority: number
  providerId: string
  purpose: PlatformAiRoute['purpose']
}) {
  return request('/system-settings/platform-ai', { body: data, method: 'PUT' })
}

export function deletePlatformAiRoute(id: string) {
  return request<{ success: true }>(`/system-settings/platform-ai/${id}`, { method: 'DELETE' })
}

export type RegistrationMode = {
  open: boolean
}

export type SmtpSecureMode = 'NONE' | 'SSL' | 'STARTTLS'

export type EmailServiceSettings = {
  enabled: boolean
  fromEmail: string
  fromName: string
  host: string
  passwordConfigured: boolean
  port: number
  replyTo: string
  secureMode: SmtpSecureMode
  username: string
}

export type UpdateEmailServiceSettingsPayload = Omit<EmailServiceSettings, 'passwordConfigured'> & {
  clearPassword?: boolean
  password?: string
}

export type PendingRegistrationItem = {
  id: string
  name: string
  email: string
  unifiedCode: string
  college: string
  identityText: string | null
  studentNo: string | null
  grade: string | null
  createdAt: string
}

export async function getActiveCertificateTemplate() {
  return request<CertificateTemplateSummary | null>('/system-settings/certificate-template/active', {
    method: 'GET',
  })
}

export async function uploadCertificateTemplateBackground(file: File) {
  const formData = new FormData()
  formData.append('file', file)

  return requestForm<CertificateTemplateSummary>('/system-settings/certificate-template/background', formData)
}

export async function uploadCertificateSeal(file: File) {
  const formData = new FormData()
  formData.append('file', file)

  return requestForm<CertificateTemplateSummary>('/system-settings/certificate-template/seal', formData)
}

export async function updateCertificateTemplateLayout(layoutJson: unknown) {
  return request<CertificateTemplateSummary>('/system-settings/certificate-template/layout', {
    method: 'PUT',
    body: { layoutJson },
  })
}

export async function previewCertificateTemplate() {
  const blob = await apiBlobRequest('/system-settings/certificate-template/preview', {
    auth: true,
    method: 'POST',
    unauthenticatedMessage: '请先登录后再预览证书模板',
  })
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener,noreferrer')
  window.setTimeout(() => URL.revokeObjectURL(url), 60 * 1000)
}

export async function previewCertificateTemplateLayout(layoutJson: unknown) {
  const blob = await apiBlobRequest('/system-settings/certificate-template/layout-preview', {
    auth: true,
    method: 'POST',
    unauthenticatedMessage: '请先登录后再预览证书模板',
    body: { layoutJson },
  })
  return URL.createObjectURL(blob)
}

export async function getCertificateTemplateBackgroundPreview() {
  const { blob, response } = await apiBlobResponse('/system-settings/certificate-template/background-preview', {
    auth: true,
    method: 'GET',
    unauthenticatedMessage: '请先登录后再配置证书模板',
  })
  return {
    height: readHeaderNumber(response, 'X-Certificate-Page-Height'),
    url: URL.createObjectURL(blob),
    width: readHeaderNumber(response, 'X-Certificate-Page-Width'),
  }
}

export async function getCertificateSealPreview() {
  const { blob, response } = await apiBlobResponse('/system-settings/certificate-template/seal-preview', {
    auth: true,
    method: 'GET',
    unauthenticatedMessage: '请先登录后再配置证书模板',
  })
  return {
    height: readHeaderNumber(response, 'X-Certificate-Seal-Height'),
    url: URL.createObjectURL(blob),
    width: readHeaderNumber(response, 'X-Certificate-Seal-Width'),
  }
}

export async function getPlatformSettings() {
  return request<PlatformSettings>('/system-settings/platform', { method: 'GET' })
}

export async function getPublicPlatformAppearance() {
  return apiRequest<PlatformSettings>('/public/platform/appearance', { method: 'GET' })
}

export async function updatePlatformSettings(data: Partial<PlatformSettings>) {
  return request<PlatformSettings>('/system-settings/platform', { method: 'POST', body: data as Record<string, unknown> })
}

export async function uploadSchoolLogo(file: File) {
  const formData = new FormData()
  formData.append('file', file)

  return requestForm<PlatformSettings>('/system-settings/platform/logo', formData)
}

export type PlatformLogoSlot = 'auth' | 'favicon' | 'navigation'
export type PlatformLogoMode = 'dark' | 'light'

export async function uploadPlatformLogo(slot: PlatformLogoSlot, file: File, mode: PlatformLogoMode = 'light') {
  const formData = new FormData()
  formData.append('file', file)

  return requestForm<PlatformSettings>(`/system-settings/platform/logo/${slot}?mode=${mode}`, formData)
}

export async function resetPlatformLogo(slot: PlatformLogoSlot, mode: PlatformLogoMode = 'light') {
  return request<PlatformSettings>(`/system-settings/platform/logo/${slot}?mode=${mode}`, { method: 'DELETE' })
}

export async function uploadPlatformFont(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  return requestForm<PlatformSettings>('/system-settings/platform/font', formData)
}

export async function resetPlatformFont() {
  return request<PlatformSettings>('/system-settings/platform/font', { method: 'DELETE' })
}

export async function getAiAssistantAppearance() {
  return request<AiAssistantAppearance>('/system-settings/ai-appearance', { method: 'GET' })
}

export async function uploadAiAssistantAvatar(file: File) {
  const formData = new FormData()
  formData.append('file', file)

  return requestForm<AiAssistantAppearance>('/system-settings/ai-appearance/avatar', formData)
}

export async function getAiQuotaSettings() {
  return request<AiQuotaSettings>('/system-settings/ai-quota', { method: 'GET' })
}

export async function updateAiQuotaSettings(data: {
  defaultDailyTokens: number
  defaultMonthlyTokens: number
  defaultWeeklyTokens: number
  quotaPeriod: 'DAY' | 'WEEK' | 'MONTH'
}) {
  return request<AiQuotaSettings>('/system-settings/ai-quota', {
    body: data,
    method: 'POST',
  })
}

export async function getRegistrationMode() {
  return apiRequest<RegistrationMode>('/system-settings/registration-mode', { auth: true, method: 'GET' })
}

export async function setRegistrationMode(open: boolean) {
  return request<RegistrationMode>('/system-settings/registration-mode', { method: 'POST', body: { open } })
}

export async function listPendingRegistrations() {
  return request<PendingRegistrationItem[]>('/system-settings/pending-registrations', { method: 'GET' })
}

export async function approveRegistration(id: string) {
  return request<{ success: true }>(`/system-settings/pending-registrations/${id}/approve`, { method: 'POST' })
}

export async function rejectRegistration(id: string) {
  return request<{ success: true }>(`/system-settings/pending-registrations/${id}/reject`, { method: 'POST' })
}

export async function getEmailServiceSettings() {
  return request<EmailServiceSettings>('/system-settings/email-service', { method: 'GET' })
}

export async function updateEmailServiceSettings(data: UpdateEmailServiceSettingsPayload) {
  return request<EmailServiceSettings>('/system-settings/email-service', { method: 'POST', body: data as Record<string, unknown> })
}

export async function testEmailService(to: string) {
  return request<{ message: string }>('/system-settings/email-service/test', { method: 'POST', body: { to } })
}

async function request<T>(path: string, options: { method: 'DELETE' | 'GET' | 'POST' | 'PUT'; body?: Record<string, unknown> }) {
  return apiRequest<T>(path, {
    ...options,
    auth: true,
    unauthenticatedMessage: '请先登录后再管理系统设置',
  })
}

async function requestForm<T>(path: string, formData: FormData) {
  return apiFormRequest<T>(path, {
    auth: true,
    formData,
    unauthenticatedMessage: '请先登录后再管理系统设置',
  })
}

function readHeaderNumber(response: Response, name: string) {
  const value = Number(response.headers.get(name))
  return Number.isFinite(value) && value > 0 ? value : null
}
