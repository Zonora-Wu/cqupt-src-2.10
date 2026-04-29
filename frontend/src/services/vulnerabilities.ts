import { getSavedSession } from './auth'

export type CreateVulnerabilityPayload = {
  assetName: string
  assetUrl?: string
  detailMarkdown: string
  ownerUnit?: string
  requestPacket?: string
  selfSeverity: string
  title: string
  vulnerabilityType: string
}

export type CreateVulnerabilityResponse = {
  id: string
  reportNo: string
  status: string
  submittedAt: string
  title: string
}

export type UploadVulnerabilityAttachmentResponse = {
  id: string
  originalName: string
  previewUrl: string
  sha256: string
  sizeBytes: number
  uploadedAt: string
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api').replace(/\/$/, '')

export async function createVulnerability(payload: CreateVulnerabilityPayload) {
  const session = getSavedSession()
  if (!session?.accessToken) {
    throw new Error('请先登录后再提交漏洞')
  }

  let response: Response

  try {
    response = await fetch(`${API_BASE_URL}/vulnerabilities`, {
      body: JSON.stringify(payload),
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
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

  return data as CreateVulnerabilityResponse
}

export async function uploadVulnerabilityAttachment(reportId: string, file: File) {
  const session = getSavedSession()
  if (!session?.accessToken) {
    throw new Error('请先登录后再上传附件')
  }

  const formData = new FormData()
  formData.append('file', file)

  let response: Response

  try {
    response = await fetch(`${API_BASE_URL}/vulnerabilities/${reportId}/attachments`, {
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

  return data as UploadVulnerabilityAttachmentResponse
}

export async function openAttachmentPreview(attachmentId: string) {
  const session = getSavedSession()
  if (!session?.accessToken) {
    throw new Error('请先登录后再预览附件')
  }

  let response: Response

  try {
    response = await fetch(`${API_BASE_URL}/attachments/${attachmentId}/preview`, {
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

  return '提交失败，请稍后重试'
}
