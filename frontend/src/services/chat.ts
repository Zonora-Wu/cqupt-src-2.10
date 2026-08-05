import { apiBlobResponse, apiRequest } from './apiClient'

export type ChatRole = 'ADMIN' | 'AUDITOR' | 'STUDENT'
export type ChatContact = { avatarUrl: string | null; college: string | null; id: string; name: string; role: ChatRole }
export type ChatMessage = { id: string; content: string; createdAt: string; senderId: string; sender: ChatContact }
export type ChatConversation = {
  accepted: boolean
  avatarUrl: string | null
  canSend: boolean
  closedReason: string | null
  id: string
  lastMessage: ChatMessage | null
  members: ChatContact[]
  otherReadAt: string | null
  status: 'OPEN' | 'CLOSED' | 'DISSOLVED'
  strangerRemaining: number | null
  title: string
  type: 'DIRECT' | 'GROUP' | 'GLOBAL'
  unread: number
  updatedAt: string
}
export type ChatBootstrap = { conversations: ChatConversation[]; restriction: { expiresAt: string | null; reason: string } | null; staff: ChatContact[] }

export const getChatBootstrap = () => apiRequest<ChatBootstrap>('/chat/bootstrap', { auth: true, method: 'GET' })
export const searchChatContact = (unifiedCode: string) => apiRequest<ChatContact>('/chat/contacts/search?unifiedCode=' + encodeURIComponent(unifiedCode), { auth: true, method: 'GET' })
export const createDirectConversation = (targetUserId: string) => apiRequest<ChatConversation>('/chat/conversations/direct', { auth: true, body: { targetUserId }, method: 'POST' })
export const createGroupConversation = (title: string, memberIds: string[]) => apiRequest<ChatConversation>('/chat/conversations/group', { auth: true, body: { title, memberIds }, method: 'POST' })
type ChatMessagePage = { hasMore: boolean; messages: ChatMessage[] }

export const getChatMessages = (id: string, before?: string) => apiRequest<ChatMessagePage>(`/chat/conversations/${id}/messages${before ? `?before=${encodeURIComponent(before)}` : ''}`, { auth: true, method: 'GET' })

export async function getChatMessagesAfter(id: string, after: string) {
  const collected: ChatMessage[] = []
  let cursor = after
  let hasMore = true
  while (hasMore) {
    const page = await apiRequest<ChatMessagePage>(`/chat/conversations/${id}/messages?after=${encodeURIComponent(cursor)}&limit=100`, { auth: true, method: 'GET' })
    if (page.messages.length === 0) break
    collected.push(...page.messages)
    cursor = page.messages.at(-1)!.id
    hasMore = page.hasMore
  }
  return collected
}
export const sendChatMessage = (id: string, content: string, clientMessageId: string) => apiRequest<{ blocked: boolean; message: ChatMessage | null }>(`/chat/conversations/${id}/messages`, { auth: true, body: { content, clientMessageId }, method: 'POST' })
export const markChatRead = (id: string, messageId: string) => apiRequest<{ ok: boolean }>(`/chat/conversations/${id}/read`, { auth: true, body: { messageId }, method: 'POST' })
export const getAdminConversations = () => apiRequest<ChatConversation[]>('/chat/admin/conversations', { auth: true, method: 'GET' })
export const getChatStorage = () => apiRequest<{ chatBytes: number; databaseBytes: number; quotaBytes: number; usagePercent: number; warning: boolean }>('/chat/admin/storage', { auth: true, method: 'GET' })
export const getSensitiveWords = () => apiRequest<Array<{ id: string; term: string; active: boolean }>>('/chat/admin/sensitive-words', { auth: true, method: 'GET' })
export const addSensitiveWord = (term: string) => apiRequest('/chat/admin/sensitive-words', { auth: true, body: { term }, method: 'POST' })
export const removeSensitiveWord = (id: string) => apiRequest(`/chat/admin/sensitive-words/${id}`, { auth: true, method: 'DELETE' })
export const restrictChatUser = (userId: string, reason: string, expiresAt?: string) => apiRequest('/chat/admin/restrictions', { auth: true, body: { userId, reason, ...(expiresAt ? { expiresAt } : {}) }, method: 'POST' })
export const closeChatConversation = (id: string, reason: string) => apiRequest(`/chat/conversations/${id}/close`, { auth: true, body: { reason }, method: 'POST' })
export const previewChatCleanup = (before: string) => apiRequest<{ before: string; count: number; confirmationToken: string }>('/chat/admin/cleanup/preview', { auth: true, body: { before }, method: 'POST' })
export const executeChatCleanup = (before: string, confirmationToken: string) => apiRequest<{ deleted: number }>('/chat/admin/cleanup', { auth: true, body: { before, confirmationToken }, method: 'POST' })
export async function downloadChatExport(before: string) {
  const { blob, response } = await apiBlobResponse('/chat/admin/export', { auth: true, body: { before }, method: 'POST' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = response.headers.get('content-disposition')?.match(/filename="?([^";]+)"?/)?.[1] ?? 'chat-backup.jsonl'
  anchor.click()
  URL.revokeObjectURL(url)
}
