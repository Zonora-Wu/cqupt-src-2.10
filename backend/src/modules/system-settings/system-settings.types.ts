export type UploadedSettingsFile = {
  buffer?: Buffer
  mimetype?: string
  originalname?: string
  size?: number
}

export type CertificateTemplateSummary = {
  active: boolean
  createdAt: Date
  id: string
  layoutJson: unknown
  name: string
  sealConfigured: boolean
  templateMimeType: string
  templateSizeBytes: number
  updatedAt: Date
  version: string
}

export type RegistrationMode = {
  open: boolean
}

export type PendingRegistrationItem = {
  id: string
  name: string
  email: string
  unifiedCode: string
  college: string | null
  identityText: string | null
  studentNo: string | null
  grade: string | null
  createdAt: Date
}

export type PlatformSettings = {
  authLogoUrl: string | null
  faviconUrl: string | null
  logoUrl: string | null
  navigationLogoUrl: string | null
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
  resetAt: Date
}

export type AiKnowledgeUsagePolicySettings = {
  knowledgeUsageStrength: number
  retrievalEnabled: boolean
  directAnswerEnabled: boolean
  agentInjectEnabled: boolean
  directThresholdOverride?: number
  injectThresholdOverride?: number
  directTopKOverride?: number
  injectTopKOverride?: number
  allowAttachmentKnowledgeInjection: boolean
  requireSourceBadge: boolean
  auditCandidateHits: boolean
}
