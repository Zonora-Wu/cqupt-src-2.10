import { apiRequest } from './apiClient'

export type AdminResponsibilityAgreement = {
  content: string
  id: string
  publishedAt: string | null
  title: string
  version: string
} | null

export function getCurrentResponsibilityAgreementForAdmin() {
  return adminRequest<AdminResponsibilityAgreement>('/access/responsibility-agreement/admin/current', { method: 'GET' })
}

export function publishResponsibilityAgreement(data: { content: string; title: string }) {
  return adminRequest<NonNullable<AdminResponsibilityAgreement>>('/access/responsibility-agreement/admin/publish', {
    body: data,
    method: 'POST',
  })
}

function adminRequest<T>(path: string, options: { body?: unknown; method: 'GET' | 'POST' }) {
  return apiRequest<T>(path, {
    ...options,
    auth: true,
    unauthenticatedMessage: '请先登录后再管理责任书',
  })
}
