import { apiRequest } from './apiClient'

export type AiChatMode = 'student' | 'auditor' | 'admin'

export type AiChatResponse = {
  content: string
  mode: AiChatMode
  quota?: AiQuota
  response: unknown
}

export type AiAppearance = {
  avatarUrl: string | null
}

export type AiQuota = {
  enabled: boolean
  monthlyLimit: number
  overridden: boolean
  remaining: number
  resetAt: string
  usedPercent: number
  usedThisMonth: number
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
