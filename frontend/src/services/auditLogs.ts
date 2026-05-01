import { apiRequest } from './apiClient'

export type AuditRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH'

export type AuditLogItem = {
  id: string
  action: string
  actionLabel: string
  actor: {
    email: string
    id: string
    name: string
    role: string
    roleLabel: string
    unifiedCode: string
  } | null
  createdAt: string
  ipAddress: string
  module: string
  moduleLabel: string
  requestPath: string
  result: string
  resultLabel: string
  riskLabel: string
  riskLevel: AuditRiskLevel
  summary: string
  targetId: string
  targetLabel: string
  targetType: string
  userAgent: string
}

export type AuditLogDetail = AuditLogItem & {
  metadata: unknown
}

export type AuditLogQuery = {
  keyword?: string
  module?: string
  page?: number
  pageSize?: number
  result?: string
  riskLevel?: string
}

export type AuditLogListResponse = {
  items: AuditLogItem[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

export type AuditLogStats = {
  actionGroups: Array<{ action: string; count: number }>
  highRisk: number
  recentHighRisk: AuditLogItem[]
  resultGroups: Array<{ result: string; count: number }>
  today: number
  total: number
}

export function listAuditLogs(query: AuditLogQuery = {}) {
  return request<AuditLogListResponse>(`/audit-logs${buildQueryString(query)}`, { method: 'GET' })
}

export function getAuditLogStats(query: Omit<AuditLogQuery, 'page' | 'pageSize'> = {}) {
  return request<AuditLogStats>(`/audit-logs/stats${buildQueryString(query)}`, { method: 'GET' })
}

export function getAuditLogDetail(id: string) {
  return request<AuditLogDetail>(`/audit-logs/${encodeURIComponent(id)}`, { method: 'GET' })
}

export function listTargetAuditLogs(targetType: string, targetId: string, query: AuditLogQuery = {}) {
  return request<AuditLogListResponse>(
    `/audit-logs/target/${encodeURIComponent(targetType)}/${encodeURIComponent(targetId)}${buildQueryString(query)}`,
    { method: 'GET' },
  )
}

async function request<T>(path: string, options: { method: 'GET' }) {
  return apiRequest<T>(path, {
    ...options,
    auth: true,
    unauthenticatedMessage: '请先登录后再访问审计日志',
  })
}

function buildQueryString(query: AuditLogQuery) {
  const params = new URLSearchParams()

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    if (key === 'module' && value === '全部模块') return
    if (key === 'result' && value === '全部结果') return
    if (key === 'riskLevel' && value === '全部等级') return
    params.set(key, String(value))
  })

  const text = params.toString()
  return text ? `?${text}` : ''
}
