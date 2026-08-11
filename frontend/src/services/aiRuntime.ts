import { apiRequest } from './apiClient'

export type AiRuntimeMetrics = {
  days: number
  failureRate: number
  generatedAt: string
  p50LatencyMs: number
  p95LatencyMs: number
  running: number
  totalRuns: number
  totalTokens: number
}

export function getAiRuntimeMetrics(days = 7) {
  return apiRequest<AiRuntimeMetrics>(`/system-settings/ai-runtime-metrics?days=${days}`, { auth: true, method: 'GET' })
}
