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

export type OpenAiChatMessage = {
  content: string
  role: 'system' | 'user'
}

export type OpenAiChatPayload = {
  messages: OpenAiChatMessage[]
  model: string
  user?: string
}
