import { apiRequest } from './apiClient'

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

export type AiChatResponse = {
  content: string
  mode: AiChatMode
  cards?: AiCard[]
  actions?: AiPendingAction[]
  quota?: AiQuota
  toolCalls?: Array<{ name: string }>
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

export function sendAiChat(message: string, mode: AiChatMode = 'student', context?: Record<string, unknown>) {
  return apiRequest<AiChatResponse>('/ai/chat', {
    auth: true,
    body: {
      context,
      message,
      mode,
    },
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

export function getAiQuota() {
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
