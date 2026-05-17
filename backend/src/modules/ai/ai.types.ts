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
  mode?: unknown
}

export type NormalizedAiChatInput = {
  context?: Record<string, unknown>
  message: string
  mode: 'student' | 'auditor' | 'admin'
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

export type UserContextSnapshot = {
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

// ── 结构化响应 ──

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
  quota?: AiQuotaSummary
  toolCalls?: Array<{ name: string }>
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
