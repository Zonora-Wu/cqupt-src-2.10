import { apiFormRequest, apiRequest } from './apiClient'
import { type HumanVerificationPayload } from './humanVerification'

export type AccountProfile = {
  account: {
    authorizationLevel: 'BASIC' | 'TRUSTED' | 'STAFF'
    aiAssistantTutorialCompletedAt: string | null
    avatarUrl: string | null
    college: string
    createdAt: string
    email: string
    emailVerified: boolean
    grade: string
    identityText: string
    lastLoginAt: string | null
    name: string
    profileCompleted: boolean
    role: 'STUDENT' | 'AUDITOR' | 'ADMIN'
    roleLabel: string
    status: string
    studentNo: string
    unifiedCode: string
  }
  security: {
    responsibilityAgreement: {
      signedAt: string
      version: string
    } | null
    securityExam: {
      passed: boolean
      score: number | null
      submittedAt: string
    } | null
  }
  stats: {
    certificates: number
    currentPoints: number
    submittedReports: number
    validReports: number
  }
  aiQuota: {
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
}

export type ChangeEmailCodeResponse = {
  devCode?: string
  message: string
}

export type ChangeEmailResponse = {
  email: string
  message: string
}

export type UpdateProfileBasicsPayload = {
  college: string
  grade: string
  identityText: string
  studentNo: string
}

export type UpdateProfileBasicsResponse = UpdateProfileBasicsPayload & {
  profileCompleted: boolean
}

export function getAccountProfile() {
  return request<AccountProfile>('/account/profile', { method: 'GET' })
}

export function completeAiAssistantTutorial() {
  return request<{ completedAt: string }>('/account/onboarding/ai-assistant-tutorial/complete', { method: 'POST' })
}

export function updateProfileBasics(payload: UpdateProfileBasicsPayload) {
  return request<UpdateProfileBasicsResponse>('/account/profile/basics', {
    body: payload,
    method: 'POST',
  })
}

export function changePassword(payload: HumanVerificationPayload & { code: string; newPassword: string }) {
  return request<{ message: string }>('/account/password/change', {
    body: payload,
    method: 'POST',
  })
}

export function changePasswordWithOld(payload: HumanVerificationPayload & { oldPassword: string; newPassword: string }) {
  return request<{ message: string }>('/account/password/change-with-old', {
    body: payload,
    method: 'POST',
  })
}

export function sendCurrentEmailCode(purpose: 'CHANGE_EMAIL' | 'CHANGE_PASSWORD', humanVerification: HumanVerificationPayload['humanVerification']) {
  return request<ChangeEmailCodeResponse>('/account/email/identity-code', {
    body: { humanVerification, purpose },
    method: 'POST',
  })
}

export function changeEmail(payload: HumanVerificationPayload & { code: string; newEmail: string }) {
  return request<ChangeEmailResponse>('/account/email/change', {
    body: payload,
    method: 'POST',
  })
}

export type MyAuditLogItem = {
  id: string
  action: string
  actionLabel: string
  createdAt: string
  ipAddress: string
  module: string
  moduleLabel: string
  requestPath: string
  result: string
  resultLabel: string
  summary: string
  userAgent: string
}

export type MyAuditLogListResponse = {
  items: MyAuditLogItem[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

export type MyAuditLogQuery = {
  module?: string
  page?: number
  pageSize?: number
  result?: string
}

export function getMyAuditLogs(query: MyAuditLogQuery = {}) {
  const params = new URLSearchParams()
  if (query.page) params.set('page', String(query.page))
  if (query.pageSize) params.set('pageSize', String(query.pageSize))
  if (query.module && query.module !== '全部') params.set('module', query.module)
  if (query.result && query.result !== '全部') params.set('result', query.result)
  const qs = params.toString()
  return request<MyAuditLogListResponse>(`/account/audit-logs${qs ? `?${qs}` : ''}`, { method: 'GET' })
}

export function uploadAvatar(file: File) {
  const form = new FormData()
  form.append('file', file)
  return apiFormRequest<{ avatarUrl: string; message: string }>('/account/avatar', {
    auth: true,
    formData: form,
    unauthenticatedMessage: '请先登录',
  })
}

async function request<T>(path: string, options: { body?: unknown; method: 'GET' | 'POST' }) {
  return apiRequest<T>(path, {
    ...options,
    auth: true,
    unauthenticatedMessage: '请先登录',
  })
}
