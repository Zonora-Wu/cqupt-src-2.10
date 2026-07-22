import { apiRequest } from './apiClient'

export type UserDashboardStats = {
  certCount: number
  confirmedCount: number
  currentPoints: number
  progress: {
    latestReport: {
      id: string
      reportNo: string
      status: string
      statusLabel: string
      title: string
      updatedAt: string
    } | null
    nextAction: {
      description: string
      label: string
      route: string
    }
    requiredActionCount: number
    supplementCount: number
  }
  submitCount: number
}

export type UserDashboardAiInsight = {
  findings: string[]
  generatedAt: string
  model: string
  source: 'hermes'
  summary: string
}

export type AuditorDashboardStats = {
  pendingArchive: number
  pendingCerts: number
  pendingInitReview: number
  pendingRetest: number
}

export type AdminDashboardStats = {
  activityTrend: Array<{
    aiCalls: number
    date: string
    learning: number
    logins: number
    vulnerabilities: number
  }>
  aiInsight: AdminDashboardAiInsight
  operations: Array<{
    count: number
    label: string
    route: string
    severity: 'high' | 'medium' | 'low'
    title: string
  }>
  overview: {
    aiCalls: number
    auditToday: number
    completedRedemptions: number
    highRiskAudit: number
    highRiskVulnerabilities: number
    issuedCerts: number
    newUsers: number
    pendingAccessUsers: number
    pendingCerts: number
    pendingRedemptions: number
    pendingRetest: number
    pendingVulnerabilities: number
    totalActiveUsers: number
    totalVulnerabilities: number
  }
  pendingAccessUsers: number
  pendingCerts: number
  pendingRedemptions: number
  pendingVulnerabilities: number
  period: {
    end: string
    key: '7d'
    label: string
    start: string
  }
  platform: {
    activeAnnouncements: number
    activeLearningResources: number
    activeMallProducts: number
    learningRanges: number
  }
  recentVulnerabilities: Array<{
    assetName: string
    id: string
    ownerUnit: string | null
    reportNo: string
    reviewerName: string | null
    severity: string
    status: string
    submittedAt: string | null
    submitterName: string
    title: string
    updatedAt: string
  }>
  recentAuditLogs: Array<{
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
    id: string
    module: string
    moduleLabel: string
    result: string
    resultLabel: string
    riskLabel: string
    riskLevel: 'HIGH' | 'MEDIUM' | 'LOW'
    summary: string
    targetLabel: string
    targetType: string
  }>
  severityDistribution: Array<{
    count: number
    label: string
    level: 'critical' | 'high' | 'medium' | 'low' | 'info'
  }>
  totalActiveUsers: number
  totalVulnerabilities: number
  vulnerabilityFlow: Array<{
    count: number
    label: string
    status: string
  }>
}

export type AdminDashboardAiInsight = {
  actions: Array<{
    label: string
    owner: string
    priority: 'high' | 'medium' | 'low'
  }>
  findings: string[]
  generatedAt: string
  model: string
  recommendations: string[]
  riskLevel: 'high' | 'medium' | 'low'
  source: 'hermes' | 'heuristic'
  status: 'fresh' | 'degraded'
  summary: string
}

export async function getUserDashboard() {
  return apiRequest<UserDashboardStats>('/dashboard/user', {
    auth: true,
    method: 'GET',
    unauthenticatedMessage: '请先登录',
  })
}

export async function runUserDashboardAiInsight() {
  return apiRequest<UserDashboardAiInsight>('/dashboard/user/ai-insight/run', {
    auth: true,
    method: 'POST',
    unauthenticatedMessage: '请先登录',
  })
}

export async function getAuditorDashboard() {
  return apiRequest<AuditorDashboardStats>('/dashboard/auditor', {
    auth: true,
    method: 'GET',
    unauthenticatedMessage: '请先登录',
  })
}

export async function getAdminDashboard() {
  return apiRequest<AdminDashboardStats>('/dashboard/admin', {
    auth: true,
    method: 'GET',
    unauthenticatedMessage: '请先登录',
  })
}

export async function runAdminDashboardAiInsight() {
  return apiRequest<AdminDashboardAiInsight>('/dashboard/admin/ai-insight/run', {
    auth: true,
    method: 'POST',
    unauthenticatedMessage: '请先登录',
  })
}
