import {
  AiKnowledgeCategory,
  AiKnowledgeConversationStatus,
  AiKnowledgeFeedbackValue,
  AiKnowledgeMaintenanceStatus,
  AiKnowledgeRoleScope,
  AiKnowledgeSensitivity,
  AiKnowledgeStatus,
  AiKnowledgeVisibility,
  AiSkillCandidateStatus,
  AiSpace,
} from '@prisma/client'

export type AiKnowledgeCaptureInput = {
  aiSpace: AiSpace
  answer: string
  callId?: string
  question: string
  userId?: string
}

export type AiKnowledgeConversationTurnInput = {
  aiSpace: AiSpace
  answer: string
  callId?: string
  question: string
  userId?: string
}

export type AiKnowledgeConversationListQuery = {
  page: number
  pageSize: number
  status?: AiKnowledgeConversationStatus
}

export type AiKnowledgeConversationReviewInput = {
  note?: string
  status: Extract<AiKnowledgeConversationStatus, 'APPROVED_TO_KB' | 'SKILL_CANDIDATE' | 'DISCARDED'>
}

export type AiKnowledgeRetrievalInput = {
  aiSpace: AiSpace
  limit?: number
  question: string
  recordHits?: boolean
  userId?: string
}

export type AiKnowledgeHitSummary = {
  agentInjectEnabled: boolean
  id: string
  title: string
  answer: string
  category: AiKnowledgeCategory
  directAnswerEnabled: boolean
  hitId?: string
  maintenanceStatus: AiKnowledgeMaintenanceStatus
  retrievalEnabled: boolean
  tags: string[]
  similarity: number
}

export type AiKnowledgeListQuery = {
  category?: AiKnowledgeCategory
  keyword?: string
  page: number
  pageSize: number
  roleScope?: AiKnowledgeRoleScope
  status?: AiKnowledgeStatus
}

export type AiKnowledgeReviewInput = {
  status: Extract<AiKnowledgeStatus, 'APPROVED' | 'REJECTED' | 'ARCHIVED'>
  note?: string
}

export type AiKnowledgeCreateInput = {
  answer: string
  category?: AiKnowledgeCategory
  question: string
  roleScope?: AiKnowledgeRoleScope
  sensitivity?: AiKnowledgeSensitivity
  tags?: string[]
  title: string
  visibility?: AiKnowledgeVisibility
}

export type AiKnowledgeFeedbackInput = {
  note?: string
  value: AiKnowledgeFeedbackValue
}

export type AiSkillCandidateCreateInput = {
  description: string
  name: string
  sourceKnowledgeIds: string[]
}

export type AiSkillCandidateReviewInput = {
  note?: string
  status: Extract<AiSkillCandidateStatus, 'APPROVED' | 'REJECTED'>
}

export type AiKnowledgeMaintenancePriority = 'P0' | 'P1' | 'P2' | 'P3' | 'P4'
export type AiKnowledgeMaintenanceTaskStatus = 'OPEN' | 'RESOLVED' | 'DISMISSED'
export type AiKnowledgeMaintenanceTaskType = 'STALE_REVIEW' | 'LOW_QUALITY' | 'DUPLICATE' | 'SECURITY' | 'ARCHIVE' | 'EXPIRY'

export type AiKnowledgeMaintenanceListQuery = {
  knowledgeId?: string
  page: number
  pageSize: number
  priority?: AiKnowledgeMaintenancePriority
  status?: AiKnowledgeMaintenanceTaskStatus
  taskType?: AiKnowledgeMaintenanceTaskType
}

export type AiKnowledgeMaintenanceResolveInput = {
  reason?: string
}
