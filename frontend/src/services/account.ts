import { apiRequest } from './apiClient'

export type AccountProfile = {
  account: {
    authorizationLevel: 'BASIC' | 'TRUSTED' | 'STAFF'
    college: string
    createdAt: string
    email: string
    emailVerified: boolean
    grade: string
    identityText: string
    lastLoginAt: string | null
    name: string
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
}

export type ChangeEmailCodeResponse = {
  devCode?: string
  message: string
}

export type ChangeEmailResponse = {
  email: string
  message: string
}

export function getAccountProfile() {
  return request<AccountProfile>('/account/profile', { method: 'GET' })
}

export function changePassword(payload: { newPassword: string; oldPassword: string }) {
  return request<{ message: string }>('/account/password/change', {
    body: payload,
    method: 'POST',
  })
}

export function sendChangeEmailCode(newEmail: string) {
  return request<ChangeEmailCodeResponse>('/account/email/code', {
    body: { newEmail },
    method: 'POST',
  })
}

export function changeEmail(payload: { code: string; newEmail: string }) {
  return request<ChangeEmailResponse>('/account/email/change', {
    body: payload,
    method: 'POST',
  })
}

async function request<T>(path: string, options: { body?: unknown; method: 'GET' | 'POST' }) {
  return apiRequest<T>(path, {
    ...options,
    auth: true,
    unauthenticatedMessage: '请先登录',
  })
}
