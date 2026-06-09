import { apiRequest } from './apiClient'
import type { AiRetestJobStatus, AiRetestMode, AiRetestRiskLevel, AiRetestReproducibility } from './aiRetests'

// ── Types ──

export type AiRetestOverviewStats = {
  totalJobs: number
  activeJobs: number
  succeededJobs: number
  failedJobs: number
  blockedJobs: number
  cancelledJobs: number
  advisoryOnlyJobs: number
  successRate: number
  blockRate: number
  avgDurationMs: number
  byMode: Array<{ mode: string; count: number }>
  byRiskLevel: Array<{ riskLevel: string; count: number }>
  byPolicyDecision: Array<{ decision: string; count: number }>
}

export type AdminJobListItem = {
  id: string
  status: AiRetestJobStatus
  mode: AiRetestMode
  riskLevel: AiRetestRiskLevel | null
  policyDecision: string | null
  reproducibility: AiRetestReproducibility | null
  planOverallRisk: string | null
  failureCode: string | null
  failureMessage: string | null
  createdAt: string
  finishedAt: string | null
  cancelledAt: string | null
  requestedBy: { id: string; name: string; unifiedCode: string } | null
}

export type AdminJobListResult = {
  items: AdminJobListItem[]
  page: number
  pageSize: number
  total: number
}

export type RetestPolicyConfig = {
  version: number
  enabled: boolean
  allowedVulnerabilityTypes: string[]
  blockedVulnerabilityTypes: string[]
  runnerBudget: {
    maxRequestsPerJob: number
    maxRequestsPerStep: number
    maxResponseBytes: number
    requestTimeoutMs: number
    totalTimeoutMs: number
  }
  maxJobsPerVulnerabilityPerDay: number
  maxJobsPerAuditorPerHour: number
  hermesDirectEnabled: boolean
  superCriticalBlockedActionCodes: string[]
}

export type AdminJobQuery = {
  page?: number
  pageSize?: number
  status?: string
  mode?: string
  riskLevel?: string
  keyword?: string
  dateFrom?: string
  dateTo?: string
}

// ── API Functions ──

export async function getAiRetestStats() {
  return apiRequest<AiRetestOverviewStats>('/ai-retests/admin/stats', { auth: true, method: 'GET' })
}

export async function listAdminAiRetestJobs(query: AdminJobQuery = {}) {
  const params = new URLSearchParams()
  if (query.page) params.set('page', String(query.page))
  if (query.pageSize) params.set('pageSize', String(query.pageSize))
  if (query.status) params.set('status', query.status)
  if (query.mode) params.set('mode', query.mode)
  if (query.riskLevel) params.set('riskLevel', query.riskLevel)
  if (query.keyword) params.set('keyword', query.keyword)
  if (query.dateFrom) params.set('dateFrom', query.dateFrom)
  if (query.dateTo) params.set('dateTo', query.dateTo)
  const qs = params.toString()
  return apiRequest<AdminJobListResult>(`/ai-retests/admin/jobs${qs ? `?${qs}` : ''}`, { auth: true, method: 'GET' })
}

export async function getAiRetestPolicy() {
  return apiRequest<RetestPolicyConfig>('/ai-retests/admin/policy', { auth: true, method: 'GET' })
}

export async function updateAiRetestPolicy(body: Record<string, unknown>) {
  return apiRequest<RetestPolicyConfig>('/ai-retests/admin/policy', {
    auth: true,
    body: JSON.stringify(body),
    method: 'PUT',
  })
}
