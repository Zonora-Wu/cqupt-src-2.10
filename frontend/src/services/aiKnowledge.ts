import { apiRequest } from './apiClient'

export type AiKnowledgeCategory =
  | 'VULNERABILITY_REPORTING'
  | 'XSS'
  | 'SQL_INJECTION'
  | 'SSRF'
  | 'FILE_UPLOAD'
  | 'ACCESS_CONTROL'
  | 'AUTHENTICATION'
  | 'SECURITY_LEARNING'
  | 'SRC_RULES'
  | 'PLATFORM_USAGE'
  | 'AUDITOR_REVIEW'
  | 'ADMIN_ANALYTICS'

export type AiKnowledgeRoleScope = 'STUDENT' | 'AUDITOR' | 'ADMIN' | 'ALL'
export type AiKnowledgeVisibility = 'PRIVATE' | 'REVIEW_REQUIRED' | 'PLATFORM_PUBLIC' | 'ROLE_ONLY'
export type AiKnowledgeSensitivity = 'PUBLIC' | 'INTERNAL' | 'SENSITIVE' | 'REJECTED'
export type AiKnowledgeStatus = 'CANDIDATE' | 'AUTO_APPROVED' | 'NEEDS_REVIEW' | 'APPROVED' | 'REJECTED' | 'ARCHIVED' | 'PROMOTED_TO_SKILL'
export type AiKnowledgeJobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'DISCARDED'
export type AiKnowledgeConversationStatus = 'ACTIVE' | 'READY_REVIEW' | 'APPROVED_TO_KB' | 'SKILL_CANDIDATE' | 'DISCARDED'
export type AiSkillCandidateStatus = 'DRAFT' | 'NEEDS_REVIEW' | 'APPROVED' | 'REJECTED' | 'INSTALLED' | 'FAILED'
export type AiSpace = 'STUDENT' | 'AUDITOR' | 'ADMIN'

export type Pagination = { page: number; pageSize: number; total: number; totalPages: number }

export type AiKnowledgeEntry = {
  id: string
  title: string
  canonicalQuestion: string
  canonicalAnswer: string
  category: AiKnowledgeCategory
  tags: string[]
  roleScope: AiKnowledgeRoleScope
  visibility: AiKnowledgeVisibility
  sensitivity: AiKnowledgeSensitivity
  status: AiKnowledgeStatus
  hitCount: number
  helpfulCount: number
  unhelpfulCount: number
  abuseReportCount: number
  generalityScore: number
  safetyScore: number
  privacyRiskScore: number
  educationalValueScore: number
  reuseValueScore: number
  answerQualityScore: number
  platformRelevanceScore: number
  confidenceScore: number
  reviewNote?: string | null
  createdAt: string
  updatedAt: string
}

export type AiKnowledgeCaptureJob = {
  id: string
  aiSpace: AiSpace
  questionSummary: string
  answerSummary?: string
  status: AiKnowledgeJobStatus
  attempts?: number
  error?: string | null
  createdAt: string
  updatedAt: string
}

export type AiKnowledgeConversationTurn = {
  id: string
  role: 'user' | 'assistant' | string
  content: string
  createdAt: string
}

export type AiKnowledgeConversation = {
  id: string
  aiSpace: AiSpace
  status: AiKnowledgeConversationStatus
  title: string
  problemStatement: string
  resolutionSummary?: string | null
  pitfalls: string[]
  environmentNotes: string[]
  successfulSteps: string[]
  failedAttempts: string[]
  collectedEvidence: string[]
  suggestedKnowledgeType: 'KB' | 'SKILL' | 'DISCARD' | string
  autoDecisionReason?: string | null
  aiOverallScore: number
  aiKbScore: number
  aiSkillScore: number
  aiSafetyScore: number
  aiPrivacyRiskScore: number
  aiConfidenceScore: number
  aiAutoApproveThreshold: number
  aiReviewThreshold: number
  aiEvaluation?: {
    signals?: string[]
    risks?: string[]
    reason?: string
    suggestedKnowledgeType?: string
  } | null
  duplicateRiskScore: number
  similarKnowledgeMatches?: Array<{
    id: string
    title: string
    category: AiKnowledgeCategory
    status: AiKnowledgeStatus
    similarity: number
    hitCount: number
    helpfulCount: number
    tags: string[]
  }> | null
  mergeSuggestion?: string | null
  turnCount: number
  lastUserMessage?: string | null
  reviewNote?: string | null
  turns?: AiKnowledgeConversationTurn[]
  createdAt: string
  updatedAt: string
}

export type AiSkillCandidate = {
  id: string
  name: string
  description: string
  content: string
  sourceKnowledgeIds: string[]
  roleScope: AiKnowledgeRoleScope
  status: AiSkillCandidateStatus
  reviewNote?: string | null
  installedPath?: string | null
  installError?: string | null
  createdAt: string
  updatedAt: string
}

export type AiKnowledgeStats = {
  totals: {
    approved: number
    discardedCaptures: number
    installedSkills: number
    needsReview: number
    pendingCaptures: number
    recentHits: number
    rejected: number
    skillCandidates: number
    total: number
  }
  byCategory: Array<{ category: AiKnowledgeCategory; count: number }>
  byStatus: Array<{ status: AiKnowledgeStatus; count: number }>
  recentQueue: AiKnowledgeCaptureJob[]
}

export function listAiKnowledgeConversations(params: { page?: number; pageSize?: number; status?: AiKnowledgeConversationStatus } = {}) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && String(value) !== '') search.set(key, String(value))
  })
  return apiRequest<{ items: AiKnowledgeConversation[]; pagination: Pagination }>(`/ai/knowledge/conversations${search.size ? `?${search}` : ''}`, { auth: true, method: 'GET' })
}

export function summarizeAiKnowledgeConversation(id: string) {
  return apiRequest<AiKnowledgeConversation>(`/ai/knowledge/conversations/${id}/summarize`, { auth: true, method: 'POST' })
}

export function reviewAiKnowledgeConversation(id: string, status: Extract<AiKnowledgeConversationStatus, 'APPROVED_TO_KB' | 'SKILL_CANDIDATE' | 'DISCARDED'>, note?: string) {
  return apiRequest<AiKnowledgeConversation>(`/ai/knowledge/conversations/${id}/review`, { auth: true, body: { note, status }, method: 'POST' })
}

export function getAiKnowledgeStats() {
  return apiRequest<AiKnowledgeStats>('/ai/knowledge/stats', { auth: true, method: 'GET' })
}

export function listAiKnowledge(params: { page?: number; pageSize?: number; status?: AiKnowledgeStatus; category?: AiKnowledgeCategory; roleScope?: AiKnowledgeRoleScope; keyword?: string } = {}) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && String(value) !== '') search.set(key, String(value))
  })
  return apiRequest<{ items: AiKnowledgeEntry[]; pagination: Pagination }>(`/ai/knowledge${search.size ? `?${search}` : ''}`, { auth: true, method: 'GET' })
}

export function reviewAiKnowledge(id: string, status: Extract<AiKnowledgeStatus, 'APPROVED' | 'REJECTED' | 'ARCHIVED'>, note?: string) {
  return apiRequest<AiKnowledgeEntry>(`/ai/knowledge/${id}/review`, { auth: true, body: { note, status }, method: 'POST' })
}

export function processAiKnowledgeCaptures() {
  return apiRequest<{ processed: number; results: Array<{ id: string; status: string }> }>('/ai/knowledge/process-captures', { auth: true, method: 'POST' })
}

export function listAiKnowledgeCaptureJobs(params: { page?: number; pageSize?: number; status?: AiKnowledgeJobStatus } = {}) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && String(value) !== '') search.set(key, String(value))
  })
  return apiRequest<{ items: AiKnowledgeCaptureJob[]; pagination: Pagination }>(`/ai/knowledge/capture-jobs${search.size ? `?${search}` : ''}`, { auth: true, method: 'GET' })
}

export function listAiSkillCandidates() {
  return apiRequest<AiSkillCandidate[]>('/ai/knowledge/skill-candidates', { auth: true, method: 'GET' })
}

export function createAiSkillCandidate(body: { name: string; description: string; sourceKnowledgeIds: string[] }) {
  return apiRequest<AiSkillCandidate>('/ai/knowledge/skill-candidates', { auth: true, body, method: 'POST' })
}

export function reviewAiSkillCandidate(id: string, status: Extract<AiSkillCandidateStatus, 'APPROVED' | 'REJECTED'>, note?: string) {
  return apiRequest<AiSkillCandidate>(`/ai/knowledge/skill-candidates/${id}/review`, { auth: true, body: { note, status }, method: 'POST' })
}

export function installAiSkillCandidate(id: string) {
  return apiRequest<{ candidate: AiSkillCandidate; containerPath: string; contentSha256: string; targetPath: string }>(`/ai/knowledge/skill-candidates/${id}/install`, { auth: true, method: 'POST' })
}
