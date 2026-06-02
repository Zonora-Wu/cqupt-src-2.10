import { apiFormRequest, apiRequest } from './apiClient'

export type AiChatMode = 'student' | 'auditor' | 'admin'

export type AiCard =
  | {
      type: 'LEARNING_RESOURCE'
      id: string
      title: string
      category: string
      description: string | null
      kind: string
      actionLabel: string
    }
  | {
      type: 'MALL_PRODUCT'
      id: string
      name: string
      description: string | null
      imageUrl: string | null
      perUserLimit?: number
      pointsCost: number
      stock: number
      userBalance: number
      canRedeem: boolean
      actionId?: string
    }
  | {
      type: 'VULNERABILITY'
      id: string
      reportNo: string
      title: string
      status: string
      severity: string
      needsSupplement: boolean
    }

export type AiPendingAction = {
  id: string
  type: 'MALL_REDEEM' | 'OPEN_LEARNING_RESOURCE' | 'VIEW_VULNERABILITY'
  label: string
  payload: Record<string, unknown>
  expiresIn: number
}

export type AiVulnerabilityDraft = {
  assetName: string
  assetUrl?: string
  detailMarkdown: string
  id: string
  impactAssessment: string
  missingFields: string[]
  networkPosition?: string
  ownerUnit?: string
  repairSuggestion: string
  reproductionSteps: string
  selfSeverity: string
  sourceEvidence?: {
    category?: string
    rawTitle?: string
  }
  testBoundary?: string
  title: string
  vulnerabilityType: string
}

export type AiVulnerabilityReportDraftResponse = {
  drafts: AiVulnerabilityDraft[]
  fileName: string
  message: string
  sourceTextLength: number
}

export type AiAttachmentTextResponse = {
  fileName: string
  kind: 'PDF_TEXT'
  mimeType: string | null
  size: number
  sourceTextLength: number
  textExcerpt: string
}

export type AiChatResponse = {
  content: string
  mode: AiChatMode
  cards?: AiCard[]
  actions?: AiPendingAction[]
  assistantTurnId?: string
  dataRoute?: {
    route: 'DIRECT_RESOURCE_RESPONSE' | 'KNOWLEDGE_DIRECT_ANSWER' | 'KNOWLEDGE_INJECTED_AGENT' | 'AGENT_DATA_REQUEST' | 'NORMAL_AGENT' | 'ACTION_PROPOSAL'
    reasonCode: string
    confidence: number
    dataSources: string[]
    requiresModelCall: boolean
    requiresKnowledgeHit: boolean
    requiresSourceBadge: boolean
    requiresUserConfirmation: boolean
    allowedContextDomains: string[]
    blockedRoutes: Array<{ route: string; reason: string }>
    selectedKnowledgeIds?: string[]
    candidateKnowledgeIds?: string[]
  }
  knowledgeHitIds?: string[]
  knowledgeSources?: Array<{
    id: string
    title: string
    sourceType: 'PLATFORM_KB'
    category: string
    confidence: number
  }>
  quota?: AiQuota
  sessionId?: string
  toolCalls?: Array<{ name: string }>
  usedKnowledge?: boolean
}

export type AiTurnFeedbackRating = 'CLEARED' | 'DOWN' | 'REPORT' | 'UP'

export type AiProblemSessionStatus = 'ACTIVE' | 'AWAITING_RESOLUTION' | 'RESOLVED' | 'READY_REVIEW' | 'APPROVED_TO_KB' | 'SKILL_CANDIDATE' | 'DISCARDED' | 'ARCHIVED'

export type AiProblemSessionTurn = {
  content: string
  createdAt: string
  duplicateRiskScore?: number
  id: string
  metadata?: {
    feedback?: {
      rating?: AiTurnFeedbackRating
      reason?: string
      reasonCode?: string | null
      reasonText?: string | null
    }
    knowledgeHitIds?: string[]
    knowledgeSources?: AiChatResponse['knowledgeSources']
    usedKnowledge?: boolean
  } | null
  role: 'assistant' | 'user' | string
}

export type AiProblemSession = {
  clusterId?: string | null
  closedAt: string | null
  createdAt: string
  id: string
  initialQuestion: string
  knowledgeEntryId?: string | null
  lastActiveAt: string
  leftAt: string | null
  mode: AiChatMode
  resolvedAt: string | null
  shouldAskResolution: boolean
  startedAt: string
  status: AiProblemSessionStatus
  title: string | null
  turnCount: number
  turns?: AiProblemSessionTurn[]
  updatedAt: string
}

export type AiAppearance = {
  avatarUrl: string | null
}

export type AiQuota = {
  activeLimit: number
  dailyLimit: number
  enabled: boolean
  monthlyLimit: number
  overridden: boolean
  quotaPeriod: 'DAY' | 'WEEK' | 'MONTH'
  remaining: number
  resetAt: string
  usedPercent: number
  usedThisMonth: number
  usedThisPeriod: number
  weeklyLimit: number
}

export type AiSkillLibraryItem = {
  aiSpace: 'STUDENT' | 'AUDITOR' | 'ADMIN'
  content: string
  id: string
  source: string | null
  title: string
}

export type AiSkillLibraryResponse = {
  isolation: string
  skills: AiSkillLibraryItem[]
}

export function sendAiChat(message: string, mode: AiChatMode = 'student', context?: Record<string, unknown>, sessionId?: string) {
  return apiRequest<AiChatResponse>('/ai/chat', {
    auth: true,
    body: {
      context,
      message,
      mode,
      sessionId,
    },
    method: 'POST',
  })
}

export function createAiProblemSession(mode: AiChatMode = 'student', initialQuestion?: string) {
  return apiRequest<AiProblemSession>('/ai/problem-sessions', {
    auth: true,
    body: { initialQuestion, mode },
    method: 'POST',
  })
}

export function getActiveAiProblemSession(mode: AiChatMode = 'student') {
  return apiRequest<AiProblemSession | null>(`/ai/problem-sessions/active?mode=${encodeURIComponent(mode)}`, {
    auth: true,
    method: 'GET',
  })
}

export function getAiProblemSession(id: string) {
  return apiRequest<AiProblemSession>(`/ai/problem-sessions/${id}`, {
    auth: true,
    method: 'GET',
  })
}

export function listAiProblemSessions(limit = 30) {
  return apiRequest<AiProblemSession[]>(`/ai/problem-sessions/history?limit=${encodeURIComponent(String(limit))}`, {
    auth: true,
    method: 'GET',
  })
}

export function heartbeatAiProblemSession(id: string) {
  return apiRequest<AiProblemSession>(`/ai/problem-sessions/${id}/heartbeat`, {
    auth: true,
    method: 'POST',
  })
}

export function leaveAiProblemSession(id: string) {
  return apiRequest<AiProblemSession>(`/ai/problem-sessions/${id}/leave`, {
    auth: true,
    method: 'POST',
  })
}

export function resolveAiProblemSession(id: string, note?: string) {
  return apiRequest<AiProblemSession>(`/ai/problem-sessions/${id}/resolve`, {
    auth: true,
    body: { note },
    method: 'POST',
  })
}

export function discardAiProblemSession(id: string) {
  return apiRequest<AiProblemSession>(`/ai/problem-sessions/${id}/discard`, {
    auth: true,
    method: 'POST',
  })
}

export function submitAiTurnFeedback(
  sessionId: string,
  turnId: string,
  data: { rating: AiTurnFeedbackRating; reasonCode?: string; reasonText?: string },
) {
  return apiRequest<{
    knowledgeFeedbackUpdated: boolean
    knowledgeHitIds: string[]
    rating: AiTurnFeedbackRating
    requiresReview: boolean
    turnId: string
  }>(`/ai/problem-sessions/${sessionId}/turns/${turnId}/feedback`, {
    auth: true,
    body: data,
    method: 'POST',
  })
}

export function getAiHealth() {
  return apiRequest<{ agent: unknown; latencyMs: number; ok: boolean }>('/ai/health', {
    auth: true,
    method: 'GET',
  })
}

export function getAiAppearance() {
  return apiRequest<AiAppearance>('/ai/appearance', {
    auth: true,
    method: 'GET',
  })
}

export async function uploadAiReportDraft(file: File) {
  const formData = new FormData()
  formData.append('file', file)

  return apiFormRequest<AiVulnerabilityReportDraftResponse>('/ai/report-drafts', {
    auth: true,
    formData,
    unauthenticatedMessage: '请先登录后再上传报告',
  })
}

export async function uploadAiAttachmentText(file: File) {
  const formData = new FormData()
  formData.append('file', file)

  return apiFormRequest<AiAttachmentTextResponse>('/ai/attachments/text', {
    auth: true,
    formData,
    unauthenticatedMessage: '请先登录后再上传附件',
  })
}

export async function getAiQuota() {
  return apiRequest<AiQuota>('/ai/quota', {
    auth: true,
    method: 'GET',
  })
}

export function getAiSkills() {
  return apiRequest<AiSkillLibraryResponse>('/ai/skills', {
    auth: true,
    method: 'GET',
  })
}

export type RedeemResult = {
  id: string
  pickupCode: string
  pointsCost: number
  note: string
  product: { name: string }
}

export function redeemProduct(productId: string) {
  return apiRequest<RedeemResult>('/mall/redemptions', {
    auth: true,
    body: { productId },
    method: 'POST',
  })
}
