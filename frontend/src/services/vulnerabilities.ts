import { apiBlobRequest, apiFormRequest, apiRequest } from './apiClient'

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

export type MyVulnerabilityAttachment = {
  id: string
  originalName: string
  sizeBytes: number
  uploadedAt: string
}

export type MyVulnerabilityItem = {
  assetName: string
  attachments: MyVulnerabilityAttachment[]
  finalSeverity: string | null
  id: string
  lastEvent: {
    action: string
    createdAt: string
    note: string | null
  } | null
  ownerUnit: string | null
  points: number
  reportNo: string
  selfSeverity: string
  status: string
  submittedAt: string | null
  title: string
  updatedAt: string
  vulnerabilityType: string
}

export type MyVulnerabilityListResponse = {
  items: MyVulnerabilityItem[]
  stats: {
    confirmed: number
    needSupplement: number
    pending: number
    total: number
  }
}

export type ReviewQueueItem = {
  assetName: string
  assetUrl: string | null
  attachments: MyVulnerabilityAttachment[]
  finalSeverity: string | null
  id: string
  impactAssessment: string
  lastEvent: {
    action: string
    createdAt: string
    note: string | null
  } | null
  ownerUnit: string | null
  points: number
  repairSuggestion: string
  reportNo: string
  requestPacket: string | null
  reproductionSteps: string
  selfSeverity: string
  status: string
  submittedAt: string | null
  submitter: {
    email: string
    name: string
    unifiedCode: string
  }
  testBoundary: string | null
  title: string
  updatedAt: string
  vulnerabilityType: string
}

export type ReviewQueueResponse = {
  items: ReviewQueueItem[]
  stats: {
    confirmed: number
    needSupplement: number
    pendingReview: number
    submitted: number
    total: number
  }
}

export type ReviewDecisionPayload = {
  decision: 'CONFIRM' | 'NEEDS_SUPPLEMENT' | 'REJECT'
  finalSeverity?: string
  note: string
  points?: number
}

export type ReviewDecisionResponse = {
  finalSeverity: string | null
  id: string
  points: number
  reportNo: string
  status: string
  updatedAt: string
}

export async function createVulnerability(payload: CreateVulnerabilityPayload) {
  return apiRequest<CreateVulnerabilityResponse>('/vulnerabilities', {
    auth: true,
    body: payload,
    method: 'POST',
    unauthenticatedMessage: '请先登录后再提交漏洞',
  })
}

export async function listMyVulnerabilities() {
  return apiRequest<MyVulnerabilityListResponse>('/vulnerabilities/my', {
    auth: true,
    method: 'GET',
    unauthenticatedMessage: '请先登录后再查看漏洞',
  })
}

export async function listReviewQueue() {
  return apiRequest<ReviewQueueResponse>('/vulnerabilities/review-queue', {
    auth: true,
    method: 'GET',
    unauthenticatedMessage: '请先登录后再查看审核队列',
  })
}

export async function reviewVulnerability(reportId: string, payload: ReviewDecisionPayload) {
  return apiRequest<ReviewDecisionResponse>(`/vulnerabilities/${reportId}/review`, {
    auth: true,
    body: payload,
    method: 'POST',
    unauthenticatedMessage: '请先登录后再审核漏洞',
  })
}

export async function uploadVulnerabilityAttachment(reportId: string, file: File) {
  const formData = new FormData()
  formData.append('file', file)

  return apiFormRequest<UploadVulnerabilityAttachmentResponse>(`/vulnerabilities/${reportId}/attachments`, {
    auth: true,
    formData,
    unauthenticatedMessage: '请先登录后再上传附件',
  })
}

export async function openAttachmentPreview(attachmentId: string) {
  const blob = await apiBlobRequest(`/attachments/${attachmentId}/preview`, {
    auth: true,
    unauthenticatedMessage: '请先登录后再预览附件',
  })
  const previewUrl = URL.createObjectURL(blob)
  window.open(previewUrl, '_blank', 'noopener,noreferrer')

  window.setTimeout(() => URL.revokeObjectURL(previewUrl), 60 * 1000)
}
