// ── OpenAI Function Calling Tool 定义 ──

export type AiToolParameter = {
  type: 'object'
  properties: Record<
    string,
    {
      type: string
      description: string
      enum?: string[]
    }
  >
  required?: string[]
}

export type AiToolDefinition = {
  name: string
  description: string
  parameters: AiToolParameter
}

// ── Tool Call（Hermes Agent → Backend 的调用请求）──

export type AiToolCall = {
  id: string
  name: string
  arguments: Record<string, unknown>
}

// ── Tool Result（Backend → Hermes Agent 的执行结果）──

export type AiToolResult = {
  tool_call_id: string
  role: 'tool'
  content: string // JSON string
}

// ── AI 对话请求 ──

export type AiChatBody = {
  context?: unknown
  message?: unknown
  modelProfileId?: unknown
  mode?: unknown
  sessionId?: unknown
  skillIds?: unknown
}

export type NormalizedAiChatInput = {
  context?: Record<string, unknown>
  message: string
  modelProfileId?: string
  mode: 'student' | 'auditor' | 'admin'
  sessionId?: string
  skillIds?: string[]
}

// ── OpenAI Chat 协议扩展 ──

export type OpenAiChatMessage = {
  content: string | null
  role: 'system' | 'user' | 'assistant' | 'tool'
  name?: string
  tool_calls?: Array<{
    id: string
    type: 'function'
    function: {
      name: string
      arguments: string
    }
  }>
  tool_call_id?: string
}

export type OpenAiChatPayload = {
  messages: OpenAiChatMessage[]
  model: string
  tools?: AiToolDefinition[]
  tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } }
  user?: string
}

// ── 用户上下文（注入 system prompt 的轻量摘要）──

export type UserVulnerabilitySummary = {
  reportNo: string
  id: string
  title: string
  status: string
  selfSeverity: string
  finalSeverity: string | null
  submittedAt: string | null
  needsSupplement: boolean
  hasCertificate: boolean
}

export type UserMallSuggestion = {
  id: string
  name: string
  category: string
  description: string | null
  imageUrl: string | null
  pointsCost: number
  stock: number
  perUserLimit: number
  canRedeem: boolean
  remainingAfterRedeem: number
}

export type UserLearningSuggestion = {
  id: string
  title: string
  category: string
  kind: string
  description: string | null
}

export type UserContextDomain = 'learning' | 'mall' | 'points' | 'vulnerabilities'

export type UserContextSnapshot = {
  injectedDomains: UserContextDomain[]
  omittedDomains: UserContextDomain[]
  points: {
    balance: number
    earned: number
    spent: number
    pendingRedemptions: number
  }
  vulnerabilities: {
    total: number
    needsSupplement: number
    confirmed: number
    pending: number
    recent: UserVulnerabilitySummary[]
  }
  mallSuggestions: UserMallSuggestion[]
  learningSuggestions: UserLearningSuggestion[]
}

// ── Backend-hosted Agent Tool Gateway（模型输出 dataRequests，后端执行）──

export type AiDataRequestToolName =
  | 'get_audit_log_summary'
  | 'get_assigned_reports'
  | 'get_my_vulnerabilities'
  | 'get_platform_stats'
  | 'get_point_balance'
  | 'get_redeem_eligibility'
  | 'get_review_queue_stats'
  | 'get_user_summary'
  | 'search_learning_resources'
  | 'search_mall_products'

export type AiDataRequest = {
  id: string
  tool: AiDataRequestToolName
  arguments: Record<string, unknown>
  reason?: string
}

export type AiDataRequestResult = {
  id: string
  tool: AiDataRequestToolName
  ok: boolean
  result?: unknown
  error?: string
}

// ── 结构化响应 ──

export type AiVulnerabilityDraft = {
  assetName: string
  assetUrl?: string
  detailMarkdown: string
  id: string
  impactAssessment: string
  missingFields: string[]
  networkPosition?: string
  ownerUnit?: string
  repairSuggestion: string
  reproductionSteps: string
  selfSeverity: string
  sourceEvidence?: {
    category?: string
    rawTitle?: string
  }
  testBoundary?: string
  title: string
  vulnerabilityType: string
}

export type AiVulnerabilityReportDraftResponse = {
  drafts: AiVulnerabilityDraft[]
  fileName: string
  message: string
  sourceTextLength: number
}

export type AiAttachmentTextResponse = {
  fileName: string
  kind: 'PDF_TEXT'
  mimeType: string | null
  size: number
  sourceTextLength: number
  textExcerpt: string
}

export type AiReportAssessment = {
  disclaimer: string
  imageEvidenceNotice: string | null
  improvements: string[]
  limitations: string[]
  score: number
  strengths: string[]
  summary: string
}

export type AiReportAnalysisResponse = {
  assessment: AiReportAssessment
  draft: AiVulnerabilityDraft
  fileName: string
  omittedFields: string[]
  redactionCount: number
}

export type AiCard =
  | {
      type: 'LEARNING_RESOURCE'
      id: string
      title: string
      category: string
      description: string | null
      kind: string
      actionLabel: string
    }
  | {
      type: 'MALL_PRODUCT'
      id: string
      name: string
      description: string | null
      imageUrl: string | null
      perUserLimit?: number
      pointsCost: number
      stock: number
      userBalance: number
      canRedeem: boolean
      actionId?: string
    }
  | {
      type: 'VULNERABILITY'
      id: string
      reportNo: string
      title: string
      status: string
      severity: string
      needsSupplement: boolean
  }

export type AiPendingAction = {
  id: string
  type: 'MALL_REDEEM' | 'OPEN_LEARNING_RESOURCE' | 'VIEW_VULNERABILITY'
  label: string
  payload: Record<string, unknown>
  expiresIn: number
}

export type AiChatResponse = {
  content: string
  mode: 'student' | 'auditor' | 'admin'
  cards?: AiCard[]
  actions?: AiPendingAction[]
  assistantTurnId?: string
  dataRoute?: AiDataRouteDecision
  knowledgeHitIds?: string[]
  knowledgeSources?: AiKnowledgeResponseSource[]
  quota?: AiQuotaSummary
  sessionId?: string
  skillRoute?: {
    active: string[]
    available: string[]
    blocked: string[]
    strategy: 'explicit_backend_role_routing'
  }
  toolCalls?: Array<{ name: string }>
  usedKnowledge?: boolean
}

export type AiKnowledgeResponseSource = {
  id: string
  title: string
  sourceType: 'PLATFORM_KB'
  category: string
  confidence: number
}

export type AiDataUsageRoute =
  | 'DIRECT_RESOURCE_RESPONSE'
  | 'KNOWLEDGE_DIRECT_ANSWER'
  | 'KNOWLEDGE_INJECTED_AGENT'
  | 'AGENT_DATA_REQUEST'
  | 'NORMAL_AGENT'
  | 'ACTION_PROPOSAL'

export type AiDataRouteDecision = {
  route: AiDataUsageRoute
  reasonCode:
    | 'HAS_ATTACHMENT_CONTEXT'
    | 'WRITE_INTENT_REQUIRES_CONFIRMATION'
    | 'REALTIME_BUSINESS_DATA'
    | 'HIGH_CONFIDENCE_KB'
    | 'MEDIUM_CONFIDENCE_KB'
    | 'MODEL_REQUESTED_PLATFORM_DATA'
    | 'OPEN_ENDED_AGENT_TASK'
    | 'SAFETY_FALLBACK'
  confidence: number
  dataSources: Array<'USER_CONTEXT' | 'REALTIME_DB' | 'AI_KNOWLEDGE' | 'PLATFORM_TOOL_RESULTS' | 'ATTACHMENT_TEXT' | 'NONE'>
  requiresModelCall: boolean
  requiresKnowledgeHit: boolean
  requiresSourceBadge: boolean
  requiresUserConfirmation: boolean
  allowedContextDomains: UserContextDomain[]
  blockedRoutes: Array<{ route: AiDataUsageRoute; reason: string }>
  selectedKnowledgeIds?: string[]
  candidateKnowledgeIds?: string[]
  knowledgeUsagePolicy?: {
    strength: number
    directThreshold: number | null
    injectThreshold: number | null
    directTopK: number
    injectTopK: number
    retrievalEnabled: boolean
    directAnswerEnabled: boolean
    agentInjectEnabled: boolean
    requireSourceBadge: boolean
    auditCandidateHits: boolean
  }
}

export type AiKnowledgeUsagePolicy = {
  strength: number
  retrievalEnabled: boolean
  directAnswerEnabled: boolean
  agentInjectEnabled: boolean
  directThreshold: number
  injectThreshold: number
  directTopK: number
  injectTopK: number
  allowAttachmentKnowledgeInjection: boolean
  requireSourceBadge: boolean
  auditCandidateHits: boolean
  resolvedFrom: 'DEFAULT' | 'ADMIN_GLOBAL'
}

export type AiQuotaSummary = {
  activeLimit: number
  dailyLimit: number
  enabled: boolean
  monthlyLimit: number
  overridden: boolean
  quotaPeriod: 'DAY' | 'WEEK' | 'MONTH'
  remaining: number
  resetAt: string
  usedPercent: number
  usedThisMonth: number
  usedThisPeriod: number
  weeklyLimit: number
}

// ── AiSkill ──

export type AiSkillLibraryItem = {
  aiSpace: 'STUDENT' | 'AUDITOR' | 'ADMIN'
  content: string
  id: string
  source: string | null
  title: string
}

// ── AiActionProposal（待确认动作）──

export type AiActionProposalInput = {
  aiSpace: 'STUDENT' | 'AUDITOR' | 'ADMIN'
  actionType: string
  reason: string
  payload: Record<string, unknown>
  reportId?: string
}
