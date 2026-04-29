import { getSavedSession } from './auth'

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

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api').replace(/\/$/, '')

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
  const session = getSavedSession()
  if (!session?.accessToken) {
    throw new Error('请先登录后再管理系统设置')
  }

  let response: Response

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
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

async function requestForm<T>(path: string, formData: FormData) {
  const session = getSavedSession()
  if (!session?.accessToken) {
    throw new Error('请先登录后再管理系统设置')
  }

  let response: Response

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      body: formData,
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
      method: 'POST',
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

async function parseResponse(response: Response) {
  const text = await response.text()
  if (!text) {
    return null
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

function getApiErrorMessage(data: unknown) {
  if (typeof data === 'object' && data && 'message' in data) {
    const message = (data as { message?: unknown }).message
    if (Array.isArray(message)) {
      return message.join('，')
    }
    if (typeof message === 'string') {
      return message
    }
  }

  return '请求失败，请稍后重试'
}
