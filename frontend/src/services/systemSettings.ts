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

async function request<T>(path: string, options: { method: 'GET' }) {
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
