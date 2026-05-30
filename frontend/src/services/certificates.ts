import { apiBlobRequest, apiRequest } from './apiClient'

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
  }
}

export async function listManagedCertificates() {
  return request<ManagedCertificateListResponse>('/certificates/manage', { method: 'GET' })
}

export async function listMyCertificates() {
  return request<{ items: IssuedCertificate[]; stats: { issued: number; revoked: number; total: number } }>(
    '/certificates/my',
    { method: 'GET' },
  )
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
  const blob = await fetchCertificatePdfBlob(certificateId)
  const previewUrl = URL.createObjectURL(blob)
  window.open(previewUrl, '_blank', 'noopener,noreferrer')
  window.setTimeout(() => URL.revokeObjectURL(previewUrl), 60 * 1000)
}

export async function createCertificatePreviewUrl(certificateId: string) {
  const blob = await fetchCertificatePdfBlob(certificateId)
  return URL.createObjectURL(blob)
}

export async function downloadCertificatePdf(certificateId: string, fileName: string) {
  const blob = await fetchCertificatePdfBlob(certificateId)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = sanitizeDownloadName(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function fetchCertificatePdfBlob(certificateId: string) {
  return apiBlobRequest(`/certificates/${certificateId}/preview`, {
    auth: true,
    unauthenticatedMessage: '请先登录后再预览证书',
  })
}

export async function publicVerifyCertificate(certificateNo: string) {
  const normalized = certificateNo.trim()
  if (!normalized) {
    throw new Error('请输入证书编号')
  }

  return apiRequest<PublicCertificateVerifyResult>(`/certificates/public/${encodeURIComponent(normalized)}`, {
    method: 'GET',
  })
}

async function request<T>(
  path: string,
  options: {
    body?: unknown
    method: 'GET' | 'POST'
  },
) {
  return apiRequest<T>(path, {
    ...options,
    auth: true,
    unauthenticatedMessage: '请先登录后再管理证书',
  })
}

function sanitizeDownloadName(name: string) {
  return name.replace(/[\\/:*?"<>|]/g, '_').slice(0, 160) || 'certificate.pdf'
}
