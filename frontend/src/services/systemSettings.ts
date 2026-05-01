import { apiFormRequest, apiRequest } from './apiClient'

export type CertificateTemplateSummary = {
  active: boolean
  createdAt: string
  id: string
  name: string
  sealConfigured: boolean
  templateMimeType: string
  templateSizeBytes: number
  updatedAt: string
  version: string
}

export type RegistrationMode = {
  open: boolean
}

export type PendingRegistrationItem = {
  id: string
  name: string
  email: string
  unifiedCode: string
  college: string
  identityText: string | null
  studentNo: string | null
  grade: string | null
  createdAt: string
}

export async function getActiveCertificateTemplate() {
  return request<CertificateTemplateSummary | null>('/system-settings/certificate-template/active', {
    method: 'GET',
  })
}

export async function uploadCertificateTemplateBackground(file: File) {
  const formData = new FormData()
  formData.append('file', file)

  return requestForm<CertificateTemplateSummary>('/system-settings/certificate-template/background', formData)
}

export async function uploadCertificateSeal(file: File) {
  const formData = new FormData()
  formData.append('file', file)

  return requestForm<CertificateTemplateSummary>('/system-settings/certificate-template/seal', formData)
}

export async function getRegistrationMode() {
  return apiRequest<RegistrationMode>('/system-settings/registration-mode', { method: 'GET' })
}

export async function setRegistrationMode(open: boolean) {
  return request<RegistrationMode>('/system-settings/registration-mode', { method: 'POST', body: { open } })
}

export async function listPendingRegistrations() {
  return request<PendingRegistrationItem[]>('/system-settings/pending-registrations', { method: 'GET' })
}

export async function approveRegistration(id: string) {
  return request<{ success: true }>(`/system-settings/pending-registrations/${id}/approve`, { method: 'POST' })
}

export async function rejectRegistration(id: string) {
  return request<{ success: true }>(`/system-settings/pending-registrations/${id}/reject`, { method: 'POST' })
}

async function request<T>(path: string, options: { method: 'GET' | 'POST'; body?: Record<string, unknown> }) {
  return apiRequest<T>(path, {
    ...options,
    auth: true,
    unauthenticatedMessage: '请先登录后再管理系统设置',
  })
}

async function requestForm<T>(path: string, formData: FormData) {
  return apiFormRequest<T>(path, {
    auth: true,
    formData,
    unauthenticatedMessage: '请先登录后再管理系统设置',
  })
}
