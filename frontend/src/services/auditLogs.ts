import { getSavedSession } from './auth'

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

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api').replace(/\/$/, '')

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
  const session = getSavedSession()
  if (!session?.accessToken) {
    throw new Error('请先登录后再访问审计日志')
  }

  let response: Response

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
      },
      method: options.method,
    })
  } catch {
    throw new Error('无法连接后端服务，请确认后端已启动')
  }

  const data = await parseResponse(response)
  if (!response.ok) {
    throw new Error(getApiErrorMessage(data))
  }

  return data as T
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

async function parseResponse(response: Response) {
  const text = await response.text()
  if (!text) return null

  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

function getApiErrorMessage(data: unknown) {
  if (typeof data === 'object' && data && 'message' in data) {
    const message = (data as { message?: unknown }).message
    if (Array.isArray(message)) return message.join('，')
    if (typeof message === 'string') return message
  }

  return '请求失败，请稍后重试'
}
