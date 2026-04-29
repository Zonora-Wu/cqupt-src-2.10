import { getSavedSession } from './auth'

export type CertificateStatusLabel = '待签发' | '已签发' | '已撤销'
export type SeverityLabel = '严重' | '高危' | '中危' | '低危' | '信息'

export type ManagedCertificateItem = {
  archivedAt: string
  asset: string
  certificateId: string | null
  contribution: string
  id: string
  issueDate: string | null
  issuer: string | null
  level: SeverityLabel | null
  owner: string | null
  publicVerify: boolean
  recipient: string
  records: Array<{
    action: string
    actor: string
    note: string | null
    time: string
  }>
  status: CertificateStatusLabel
  type: string
  unifiedCode: string
  verifyCode: string
  vulnId: string
  vulnTitle: string
  vulnerabilityId: string
}

export type ManagedCertificateListResponse = {
  items: ManagedCertificateItem[]
  stats: {
    issued: number
    pending: number
    revoked: number
    total: number
  }
}

export type IssuedCertificate = {
  asset: string
  certificateNo: string
  contribution: string
  id: string
  issuedAt: string | null
  issuer: string | null
  publicVerify: boolean
  revokedAt: string | null
  revokeReason: string | null
  status: CertificateStatusLabel
  verifyCode: string
  vulnerability: {
    finalSeverity: SeverityLabel | null
    id: string
    reportNo: string
    title: string
  }
}

export type PublicCertificateVerifyResult = {
  certificateNo: string
  issuedAt: string | null
  recipientName: string
  status: string
  unifiedCode: string
  vulnerability: {
    finalSeverity: SeverityLabel | null
    reportNo: string
    title: string
  }
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api').replace(/\/$/, '')

export async function listManagedCertificates() {
  return request<ManagedCertificateListResponse>('/certificates/manage', { method: 'GET' })
}

export async function issueCertificate(payload: {
  contribution: string
  publicVerify: boolean
  vulnerabilityId: string
}) {
  return request<IssuedCertificate>('/certificates', {
    body: payload,
    method: 'POST',
  })
}

export async function revokeCertificate(certificateId: string, reason: string) {
  return request<IssuedCertificate>(`/certificates/${certificateId}/revoke`, {
    body: { reason },
    method: 'POST',
  })
}

export async function openCertificatePreview(certificateId: string) {
  const session = getSavedSession()
  if (!session?.accessToken) {
    throw new Error('请先登录后再预览证书')
  }

  let response: Response

  try {
    response = await fetch(`${API_BASE_URL}/certificates/${certificateId}/preview`, {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
      method: 'GET',
    })
  } catch {
    throw new Error('无法连接后端服务，请确认后端已启动')
  }

  if (!response.ok) {
    const data = await parseResponse(response)
    throw new Error(getApiErrorMessage(data))
  }

  const blob = await response.blob()
  const previewUrl = URL.createObjectURL(blob)
  window.open(previewUrl, '_blank', 'noopener,noreferrer')
  window.setTimeout(() => URL.revokeObjectURL(previewUrl), 60 * 1000)
}

export async function publicVerifyCertificate(certificateNo: string) {
  const normalized = certificateNo.trim()
  if (!normalized) {
    throw new Error('请输入证书编号')
  }

  let response: Response

  try {
    response = await fetch(`${API_BASE_URL}/certificates/public/${encodeURIComponent(normalized)}`, {
      method: 'GET',
    })
  } catch {
    throw new Error('无法连接后端服务，请确认后端已启动')
  }

  const data = await parseResponse(response)
  if (!response.ok) {
    throw new Error(getApiErrorMessage(data))
  }

  return data as PublicCertificateVerifyResult
}

async function request<T>(
  path: string,
  options: {
    body?: unknown
    method: 'GET' | 'POST'
  },
) {
  const session = getSavedSession()
  if (!session?.accessToken) {
    throw new Error('请先登录后再管理证书')
  }

  let response: Response

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      body: options.body ? JSON.stringify(options.body) : undefined,
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
