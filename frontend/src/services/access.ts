import { apiRequest } from './apiClient'

export type AccessStatus = {
  accountActive: boolean
  activeAgreement: {
    id: string
    publishedAt: string | null
    signedAt: string | null
    title: string
    version: string
  } | null
  authorizationLevel: 'BASIC' | 'TRUSTED' | 'STAFF'
  canSubmitVulnerability: boolean
  emailVerified: boolean
  examThreshold: number
  missingRequirements: string[]
  profileCompleted: boolean
  responsibilityAgreementRequired: boolean
  responsibilitySigned: boolean
  role: 'STUDENT' | 'AUDITOR' | 'ADMIN'
  roleAllowed: boolean
  securityExamPassed: boolean
  securityExamRequired: boolean
}

export type ResponsibilityAgreement = {
  content: string
  id: string
  publishedAt: string | null
  title: string
  version: string
} | null

export function getAccessStatus() {
  return request<AccessStatus>('/access/status', { method: 'GET' })
}

export function getCurrentResponsibilityAgreement() {
  return request<ResponsibilityAgreement>('/access/responsibility-agreement/current', { method: 'GET' })
}

export function signCurrentResponsibilityAgreement(deviceFingerprint?: string) {
  return request<{ agreementId: string; signedAt: string; title: string; version: string }>(
    '/access/responsibility-agreement/sign',
    {
      body: { deviceFingerprint },
      method: 'POST',
    },
  )
}

export function submitSecurityExam(score: number) {
  return request<{ passed: boolean; score: number; submittedAt: string; threshold: number }>(
    '/access/security-exam/submit',
    {
      body: { score },
      method: 'POST',
    },
  )
}

async function request<T>(path: string, options: { body?: unknown; method: 'GET' | 'POST' }) {
  return apiRequest<T>(path, {
    ...options,
    auth: true,
    unauthenticatedMessage: '请先登录',
  })
}
