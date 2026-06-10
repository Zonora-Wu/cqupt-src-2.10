import { apiRequest } from './apiClient'

export type AiRetestMode = 'PLAN_ONLY' | 'CONTROLLED_RUN' | 'HERMES_DIRECT'
export type AiRetestJobStatus =
  | 'PENDING'
  | 'QUEUED'
  | 'PLANNING'
  | 'POLICY_CHECK'
  | 'PLAN_REVIEW'
  | 'DIRECT_PLAN_REVIEW'
  | 'DIRECT_RUNNING'
  | 'DIRECT_ACTION_REVIEW'
  | 'ADVISORY_ONLY'
  | 'RUNNING'
  | 'CANCELLING'
  | 'REPORTING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED'
  | 'BLOCKED'
  | 'EXPIRED'

export type AiRetestRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type AiRetestReproducibility =
  | 'REPRODUCED'
  | 'NOT_REPRODUCED'
  | 'PARTIALLY_REPRODUCED'
  | 'INSUFFICIENT_EVIDENCE'
  | 'BLOCKED_BY_POLICY'
  | 'NOT_EXECUTED_PLATFORM_BLOCKED'

export type AiRetestReportStep = {
  evidence: Array<{ id: string; sha256: string | null; type: string }>
  executionState: 'EXECUTED' | 'REJECTED' | 'BLOCKED' | 'NOT_EXECUTED' | 'EVIDENCE_INSUFFICIENT'
  resultSummary: unknown
  riskLevel: AiRetestRiskLevel | null
  sequence: number
  sourceId: string | null
  status: string
  target: string | null
  title: string
  toolType: string | null
}

export type AiRetestReportJson = {
  schemaVersion: string
  conclusion: {
    confidence: 'LOW' | 'MEDIUM' | 'HIGH'
    manualReviewRequired: true
    reproducibility: AiRetestReproducibility
    riskLevelSuggestion: AiRetestRiskLevel
  }
  steps: AiRetestReportStep[]
  evidenceSummary: string
  impactAssessment: string
  remediationAdvice: {
    shortTerm: string
    rootCauseFix: string
    regressionTest: string
  }
  limitations: string[]
  manualRetestAdvice: {
    manualRetestOnly: boolean
    runnerExecutionAllowed: boolean
    blockedReason: string | null
    authorizationChecklist: string[]
    evidenceToReview: string[]
    safeManualApproach: string[]
    remediationAdvice: string[]
  }
  reviewCommentDraft: string
}

export type AiRetestJobSummary = {
  createdAt: string
  finishedAt: string | null
  jobId: string
  mode: AiRetestMode
  policyDecision: string | null
  reproducibility: AiRetestReproducibility | null
  riskLevel: AiRetestRiskLevel | null
  status: AiRetestJobStatus
}

export type AiRetestJobDetail = {
  artifacts: Array<{
    artifactType: string
    createdAt: string
    id: string
    mimeType: string
    redactionSummary: unknown
    sanitizedPreview: string | null
    sha256: string
    sizeBytes: number
    stepId: string | null
  }>
  cancelledAt: string | null
  createdAt: string
  directSession: null | {
    actions: Array<{
      actionType: string
      approvedAt: string | null
      commandHash: string
      commandPreview: string | null
      expectedImpact: string | null
      expiresAt: string
      id: string
      riskLevel: AiRetestRiskLevel
      riskSummary: string
      sequence: number
      status: string
      target: string | null
      toolClass: string | null
    }>
    approvedTargetScope: unknown
    approvedToolClasses: string[]
    confirmedAt: string | null
    id: string
    impactScope: unknown
    proposal: Record<string, unknown>
    proposalHash: string
    riskSummary: string
    status: string
  }
  expiresAt: string
  failureCode: string | null
  failureMessage: string | null
  finishedAt: string | null
  jobId: string
  mode: AiRetestMode
  plan: null | {
    manualRetestOnly: boolean
    overallRisk: AiRetestRiskLevel
    requiresApproval: boolean
    runnerAllowed: boolean
  }
  policyDecision: string | null
  report: null | {
    adoptedAt: string | null
    adoptedCommentId: string | null
    confidence: string | null
    createdAt: string
    manualRetestOnly: boolean
    manualReviewRequired: boolean
    promptVersion: string
    reproducibility: AiRetestReproducibility
    reportHash: string
    reportJson: AiRetestReportJson
    runnerAllowed: boolean
    schemaVersion: string
  }
  reproducibility: AiRetestReproducibility | null
  riskLevel: AiRetestRiskLevel | null
  startedAt: string | null
  status: AiRetestJobStatus
  steps: Array<{
    durationMs: number | null
    errorCode: string | null
    errorMessage: string | null
    id: string
    method: string | null
    policyDecision: string | null
    policyReasons: string[]
    requestCount: number
    resultSummary: unknown
    riskLevel: AiRetestRiskLevel
    sequence: number
    status: string
    targetUrl: string | null
    title: string
    toolType: string
  }>
  traceId: string
}

export type AiRetestCredentialType =
  | 'USERNAME_PASSWORD'
  | 'COOKIE'
  | 'BEARER_TOKEN'
  | 'CUSTOM_HEADERS'
  | 'CLIENT_CERT_REFERENCE'
  | 'INTERACTIVE_OTP'

export async function listAiRetestJobs(vulnerabilityId: string) {
  return apiRequest<{ items: AiRetestJobSummary[]; page: number; pageSize: number; total: number }>(
    `/vulnerabilities/${vulnerabilityId}/ai-retests?page=1&pageSize=20`,
    { auth: true, method: 'GET' },
  )
}

export async function getAiRetestJob(jobId: string) {
  return apiRequest<AiRetestJobDetail>(`/ai-retests/${jobId}`, { auth: true, method: 'GET' })
}

export async function createAiRetestJob(
  vulnerabilityId: string,
  input: {
    mode: AiRetestMode
    note?: string
    confirmedTargets: string[]
    confirmationText: string
    credentialRequest: { needsAccount: boolean; needsCaptcha: boolean; notes?: string }
    scopeConfirmed: boolean
    riskAcknowledged: boolean
  },
  idempotencyKey: string,
) {
  return apiRequest<{ deduplicated: boolean; jobId: string; status: AiRetestJobStatus }>(
    `/vulnerabilities/${vulnerabilityId}/ai-retests`,
    {
      auth: true,
      body: input,
      headers: { 'Idempotency-Key': idempotencyKey },
      method: 'POST',
    },
  )
}

export async function cancelAiRetestJob(jobId: string) {
  return apiRequest<{ jobId: string; status: AiRetestJobStatus }>(`/ai-retests/${jobId}/cancel`, {
    auth: true,
    method: 'POST',
  })
}

export async function approveAiRetestPlan(jobId: string, input: {
  acknowledgedRisk: true
  approvalNote: string
  approvedStepIds: string[]
}) {
  return apiRequest<{ jobId: string; status: AiRetestJobStatus }>(`/ai-retests/${jobId}/approve-plan`, {
    auth: true,
    body: input,
    method: 'POST',
  })
}

export async function approveAiRetestDirectPlan(jobId: string, input: {
  acknowledgedRisks: true
  approvedToolClasses: string[]
  confirmationText: string
  confirmedImpactScope: string[]
  confirmedTargetScope: string[]
  proposalHash: string
}) {
  return apiRequest<{ jobId: string; status: AiRetestJobStatus }>(`/ai-retests/${jobId}/direct-plan/approve`, {
    auth: true,
    body: input,
    method: 'POST',
  })
}

export async function approveAiRetestDirectAction(jobId: string, actionId: string, input: {
  acknowledgedRisk: true
  approvalNote: string
  commandHash: string
}) {
  return apiRequest<{ jobId: string; status: AiRetestJobStatus }>(
    `/ai-retests/${jobId}/direct-actions/${actionId}/approve`,
    { auth: true, body: input, method: 'POST' },
  )
}

export async function rejectAiRetestDirectAction(jobId: string, actionId: string, rejectionNote: string) {
  return apiRequest<{ jobId: string; status: AiRetestJobStatus }>(
    `/ai-retests/${jobId}/direct-actions/${actionId}/reject`,
    { auth: true, body: { rejectionNote }, method: 'POST' },
  )
}

export async function createAiRetestCredential(jobId: string, input: {
  allowedUses: string[]
  credentialType: AiRetestCredentialType
  expiresInMinutes: number
  payload: Record<string, unknown>
  targetScope: string[]
}) {
  return apiRequest<{ id: string; credentialType: AiRetestCredentialType; expiresAt: string }>(
    `/ai-retests/${jobId}/direct-credentials`,
    { auth: true, body: input, method: 'POST' },
  )
}

export async function getAiRetestArtifact(jobId: string, artifactId: string) {
  return apiRequest<{
    artifactType: string
    mimeType: string
    redactionSummary: unknown
    sanitizedPreview: string
    sha256: string
    sizeBytes: number
  }>(`/ai-retests/${jobId}/artifacts/${artifactId}`, { auth: true, method: 'GET' })
}

export async function adoptAiRetestReviewComment(jobId: string) {
  return apiRequest<{
    commentId: string
    content: string
    jobId: string
    vulnerabilityStatusUnchanged: string
  }>(`/ai-retests/${jobId}/adopt-review-comment`, { auth: true, method: 'POST' })
}
