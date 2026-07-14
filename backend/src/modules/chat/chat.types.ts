import { ChatConversationType, RoleCode } from '@prisma/client'

export type CreateDirectConversationBody = { targetUserId?: unknown }
export type CreateGroupConversationBody = { memberIds?: unknown; title?: unknown }
export type SendMessageBody = { clientMessageId?: unknown; content?: unknown }
export type ReadConversationBody = { messageId?: unknown }
export type ManageConversationBody = { reason?: unknown; title?: unknown }
export type ManageMembersBody = { userIds?: unknown }
export type RestrictUserBody = { expiresAt?: unknown; reason?: unknown; userId?: unknown }
export type SensitiveWordBody = { active?: unknown; term?: unknown }
export type CleanupBody = { before?: unknown; confirmationToken?: unknown }

export type ChatContact = {
  avatarUrl: string | null
  college: string | null
  id: string
  name: string
  role: RoleCode
  unifiedCode?: string
}

export type ConversationListQuery = { cursor?: string; take?: number }
export type MessageListQuery = { before?: string; limit?: number }

export type ChatConversationInput = {
  memberIds: string[]
  title: string
  type: ChatConversationType
}
