import { apiBlobRequest, apiFormRequest, apiRequest } from './apiClient'

export type CreateVulnerabilityPayload = {
  assetName: string
  assetUrl?: string
  detailMarkdown: string
  impactAssessment?: string
  ownerUnit?: string
  repairSuggestion?: string
  reproductionSteps?: string
  requestPacket?: string
  selfSeverity: string
  testBoundary?: string
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

export type VulnerabilityEventRecord = {
  id: string
  action: string
  actorName: string | null
  fromStatus: string | null
  toStatus: string | null
  note: string | null
  createdAt: string
}

export type MyVulnerabilityDetail = {
  id: string
  reportNo: string
  title: string
  selfSeverity: string
  finalSeverity: string | null
  status: string
  assetName: string
  assetUrl: string | null
  ownerUnit: string | null
  vulnerabilityType: string
  reproductionSteps: string
  impactAssessment: string
  repairSuggestion: string
  requestPacket: string | null
  testBoundary: string | null
  reviewerName: string | null
  points: number
  submittedAt: string | null
  confirmedAt: string | null
  updatedAt: string
  attachments: MyVulnerabilityAttachment[]
  events: VulnerabilityEventRecord[]
}

export type SupplementVulnerabilityResponse = {
  id: string
  reportNo: string
  status: string
  updatedAt: string
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

export async function getMyVulnerabilityDetail(reportId: string) {
  return apiRequest<MyVulnerabilityDetail>(`/vulnerabilities/my/${reportId}`, {
    auth: true,
    method: 'GET',
    unauthenticatedMessage: '请先登录后再查看漏洞',
  })
}

export async function supplementVulnerability(reportId: string, note: string) {
  return apiRequest<SupplementVulnerabilityResponse>(`/vulnerabilities/my/${reportId}/supplement`, {
    auth: true,
    body: { note },
    method: 'POST',
    unauthenticatedMessage: '请先登录后再操作',
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

// ---- 管理员漏洞管理 ----

export type AdminVulnerabilityListItem = {
  id: string
  reportNo: string
  title: string
  selfSeverity: string
  finalSeverity: string | null
  status: string
  assetName: string
  ownerUnit: string | null
  submitterName: string
  reviewerName: string | null
  points: number
  submittedAt: string | null
  updatedAt: string
  attachmentCount: number
  lastEvent: {
    action: string
    createdAt: string
    note: string | null
  } | null
}

export type AdminVulnerabilityListResponse = {
  items: AdminVulnerabilityListItem[]
  stats: {
    total: number
    submitted: number
    pendingReview: number
    needSupplement: number
    confirmed: number
    fixing: number
    pendingRetest: number
    rejected: number
    archived: number
  }
}

export type AdminVulnerabilityDetail = {
  id: string
  reportNo: string
  title: string
  selfSeverity: string
  finalSeverity: string | null
  status: string
  assetName: string
  assetUrl: string | null
  ownerUnit: string | null
  vulnerabilityType: string
  reproductionSteps: string
  impactAssessment: string
  repairSuggestion: string
  requestPacket: string | null
  testBoundary: string | null
  submitterName: string
  submitterEmail: string
  submitterUnifiedCode: string
  reviewerName: string | null
  points: number
  submittedAt: string | null
  confirmedAt: string | null
  updatedAt: string
  certificateContribution: string
  certificate: {
    certificateNo: string
    id: string
    issuedAt: string | null
    issuerName: string | null
    publicVerify: boolean
    status: string
    verifyCode: string
  } | null
  attachments: Array<{
    id: string
    originalName: string
    sizeBytes: number
    uploadedAt: string
  }>
  events: Array<{
    id: string
    action: string
    actorName: string | null
    fromStatus: string | null
    toStatus: string | null
    note: string | null
    createdAt: string
  }>
}

export async function listAdminVulnerabilities() {
  return apiRequest<AdminVulnerabilityListResponse>('/vulnerabilities/manage', {
    auth: true,
    method: 'GET',
    unauthenticatedMessage: '请先登录后再访问',
  })
}

export async function getVulnerabilityDetail(reportId: string) {
  const raw = await apiRequest<{
    id: string
    reportNo: string
    title: string
    selfSeverity: string
    finalSeverity: string | null
    status: string
    assetName: string
    assetUrl: string | null
    ownerUnit: string | null
    vulnerabilityType: string
    reproductionSteps: string
    impactAssessment: string
    repairSuggestion: string
    requestPacket: string | null
    testBoundary: string | null
    submitter: { id: string; name: string; email: string; unifiedCode: string }
    reviewer: { id: string; name: string; email: string } | null
    points: number
    submittedAt: string | null
    confirmedAt: string | null
    updatedAt: string
    certificateContribution: string
    certificate: AdminVulnerabilityDetail['certificate']
    attachments: Array<{ id: string; originalName: string; sizeBytes: number; uploadedAt: string }>
    events: Array<{
      id: string
      action: string
      actorName: string | null
      fromStatus: string | null
      toStatus: string | null
      note: string | null
      createdAt: string
    }>
  }>(`/vulnerabilities/${reportId}`, {
    auth: true,
    method: 'GET',
    unauthenticatedMessage: '请先登录后再访问',
  })

  const detail: AdminVulnerabilityDetail = {
    ...raw,
    submitterName: raw.submitter.name,
    submitterEmail: raw.submitter.email,
    submitterUnifiedCode: raw.submitter.unifiedCode,
    reviewerName: raw.reviewer?.name ?? null,
  }

  return detail
}

// ---- 审核员复测归档 ----

export type RetestQueueItem = {
  archivedAt: string | null
  assetName: string
  assetUrl: string | null
  finalSeverity: string | null
  id: string
  lastFixNote: string | null
  lastRetestNote: string | null
  ownerUnit: string | null
  reportNo: string
  status: string
  submitter: { email: string; name: string }
  title: string
  updatedAt: string
}

export type RetestQueueResponse = {
  items: RetestQueueItem[]
  stats: {
    archived: number
    pendingRetest: number
  }
}

export type RetestPayload = {
  decision: 'RETEST_PASS' | 'RETURN_TO_FIX' | 'ARCHIVE'
  note: string
}

export type RetestResponse = {
  id: string
  reportNo: string
  status: string
  updatedAt: string
}

export async function listRetestQueue() {
  return apiRequest<RetestQueueResponse>('/vulnerabilities/retest-queue', {
    auth: true,
    method: 'GET',
    unauthenticatedMessage: '请先登录',
  })
}

export async function retestVulnerability(reportId: string, payload: RetestPayload) {
  return apiRequest<RetestResponse>(`/vulnerabilities/${reportId}/retest`, {
    auth: true,
    body: payload,
    method: 'POST',
    unauthenticatedMessage: '请先登录',
  })
}

export async function markFixing(reportId: string, note: string) {
  return apiRequest<RetestResponse>(`/vulnerabilities/${reportId}/mark-fixing`, {
    auth: true,
    body: { note },
    method: 'POST',
    unauthenticatedMessage: '请先登录',
  })
}
