import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { AuditAction, ChatConversationStatus, ChatConversationType, ChatMemberRole, Prisma, RoleCode, UserStatus } from '@prisma/client'
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { AuthenticatedRequestUser, ClientRequestMeta } from '../auth/auth.types'
import { PrismaService } from '../prisma/prisma.service'
import { ChatRateLimitService } from './chat-rate-limit.service'
import { ChatRealtimePublisher } from './chat-realtime.publisher'

const MAX_GROUP_MEMBERS = 200
const GLOBAL_TITLE = '全体交流'
const conversationInclude = {
  members: { where: { removedAt: null }, include: { user: { include: { role: true } } } },
  messages: { orderBy: { createdAt: 'desc' }, take: 1, include: { sender: { include: { role: true } } } },
} satisfies Prisma.ChatConversationInclude

@Injectable()
export class ChatService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ChatRealtimePublisher) private readonly realtime: ChatRealtimePublisher,
    @Inject(ChatRateLimitService) private readonly rateLimit: ChatRateLimitService,
  ) {}

  async bootstrap(user: AuthenticatedRequestUser) {
    const [globalConversation, conversations, staff, restriction] = await Promise.all([
      this.ensureGlobal(user),
      this.listConversations(user),
      this.listStaffContacts(),
      this.getActiveRestriction(user.id),
    ])
    const global = await this.ensureGlobalReadBaseline(globalConversation, user.id)
    const globalItem = await this.mapConversation(global, user.id)
    const unique = new Map(conversations.map((item) => [item.id, item]))
    unique.set(globalItem.id, globalItem)
    const items = [...unique.values()].sort((a, b) => {
      if (a.type === ChatConversationType.GLOBAL) return -1
      if (b.type === ChatConversationType.GLOBAL) return 1
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })
    return { conversations: items, restriction: restriction ? { expiresAt: restriction.expiresAt, reason: restriction.reason } : null, staff }
  }

  async listStaffContacts() {
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null, status: UserStatus.ACTIVE, role: { code: { in: [RoleCode.ADMIN, RoleCode.AUDITOR] } } },
      include: { role: true },
      orderBy: [{ role: { code: 'asc' } }, { name: 'asc' }],
    })
    return users.map((item) => mapContact(item, false))
  }

  async searchContact(unifiedCode: string, user: AuthenticatedRequestUser, ipAddress?: string) {
    await this.rateLimit.consume(`chat-search:user:${user.id}`, 10, 60_000)
    if (ipAddress) await this.rateLimit.consume(`chat-search:ip:${ipAddress}`, 30, 60_000)
    const normalized = unifiedCode.trim()
    if (!/^[A-Za-z0-9]{4,64}$/.test(normalized)) throw new NotFoundException('未找到可聊天用户')
    const target = await this.prisma.user.findFirst({
      where: { deletedAt: null, status: UserStatus.ACTIVE, unifiedCode: normalized },
      include: { role: true },
    })
    if (!target || target.id === user.id) throw new NotFoundException('未找到可聊天用户')
    return mapContact(target, false)
  }

  async createDirect(targetUserId: string, user: AuthenticatedRequestUser) {
    if (targetUserId === user.id) throw new ConflictException('不能与自己创建私聊')
    const target = await this.prisma.user.findFirst({ where: { id: targetUserId, deletedAt: null, status: UserStatus.ACTIVE }, include: { role: true } })
    if (!target) throw new NotFoundException('联系人不存在或不可用')
    const directKey = [user.id, targetUserId].sort().join(':')
    const existing = await this.prisma.chatConversation.findUnique({ where: { directKey }, include: conversationInclude })
    if (existing) return this.mapConversation(existing, user.id)

    const requiresFirstReply = user.role === RoleCode.STUDENT
    try {
      const conversation = await this.prisma.chatConversation.create({
        data: {
          type: ChatConversationType.DIRECT,
          directKey,
          directInitiatorId: user.id,
          acceptedAt: requiresFirstReply ? null : new Date(),
          createdById: user.id,
          members: { create: [{ userId: user.id, role: ChatMemberRole.OWNER }, { userId: targetUserId, role: ChatMemberRole.MEMBER }] },
        },
        include: conversationInclude,
      })
      return this.mapConversation(conversation, user.id)
    } catch (error) {
      if (isUniqueViolation(error)) {
        const raced = await this.prisma.chatConversation.findUnique({ where: { directKey }, include: conversationInclude })
        if (raced) return this.mapConversation(raced, user.id)
      }
      throw error
    }
  }

  async createGroup(title: string, memberIds: string[], user: AuthenticatedRequestUser, meta: ClientRequestMeta) {
    this.requireAdmin(user)
    const ids = [...new Set([user.id, ...memberIds])]
    if (ids.length > MAX_GROUP_MEMBERS) throw new ConflictException('普通群最多 200 人')
    const activeUsers = await this.prisma.user.findMany({ where: { id: { in: ids }, deletedAt: null, status: UserStatus.ACTIVE }, select: { id: true } })
    if (activeUsers.length !== ids.length) throw new NotFoundException('存在不可用群成员')
    const conversation = await this.prisma.$transaction(async (tx) => {
      const created = await tx.chatConversation.create({
        data: {
          type: ChatConversationType.GROUP,
          title,
          createdById: user.id,
          members: { create: ids.map((id) => ({ userId: id, role: id === user.id ? ChatMemberRole.OWNER : ChatMemberRole.MEMBER })) },
        },
        include: conversationInclude,
      })
      await this.audit(tx, user, AuditAction.CHAT_CONVERSATION_MANAGED, 'ChatConversation', created.id, 'group_created', meta, { memberCount: ids.length })
      return created
    })
    this.publishConversationChanged(conversation)
    return this.mapConversation(conversation, user.id)
  }

  async listConversations(user: AuthenticatedRequestUser) {
    const conversations = await this.prisma.chatConversation.findMany({
      where: { members: { some: { userId: user.id, removedAt: null } } },
      include: conversationInclude,
      orderBy: { updatedAt: 'desc' },
      take: 200,
    })
    return Promise.all(conversations.map((conversation) => this.mapConversation(conversation, user.id)))
  }

  async listMessages(id: string, user: AuthenticatedRequestUser, before?: string, limit = 50, after?: string) {
    if (before && after) throw new BadRequestException('不能同时使用向前和向后游标')
    const conversation = await this.getAccessibleConversation(id, user.id)
    const cursorId = before ?? after
    const cursor = cursorId ? await this.prisma.chatMessage.findFirst({ where: { id: cursorId, conversationId: id }, select: { id: true, createdAt: true } }) : null
    if (cursorId && !cursor) throw new BadRequestException('消息游标无效')
    const cursorWhere = cursor
      ? after
        ? { OR: [{ createdAt: { gt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { gt: cursor.id } }] }
        : { OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] }
      : {}
    const messages = await this.prisma.chatMessage.findMany({
      where: { conversationId: id, ...cursorWhere },
      include: { sender: { include: { role: true } } },
      orderBy: [{ createdAt: after ? 'asc' : 'desc' }, { id: after ? 'asc' : 'desc' }],
      take: limit + 1,
    })
    const hasMore = messages.length > limit
    const limited = hasMore ? messages.slice(0, limit) : messages
    const page = after ? limited : limited.reverse()
    if (user.role === RoleCode.ADMIN && !this.isMember(conversation, user.id)) {
      await this.prisma.auditLog.create({ data: this.auditData(user, AuditAction.CHAT_RECORDS_VIEWED, 'ChatConversation', id, 'success', {}, { after: after ?? null, before: before ?? null, limit }) })
    }
    return { hasMore, messages: page.map(mapMessage) }
  }

  async sendMessage(id: string, input: { clientMessageId: string; content: string }, user: AuthenticatedRequestUser, meta: ClientRequestMeta) {
    const existing = await this.prisma.chatMessage.findUnique({ where: { senderId_clientMessageId: { senderId: user.id, clientMessageId: input.clientMessageId } }, include: { sender: { include: { role: true } } } })
    if (existing) return { blocked: false, message: mapMessage(existing) }
    const result = await this.prisma.$transaction(async (tx) => {
      const conversation = await tx.chatConversation.findUnique({ where: { id }, include: conversationInclude })
      if (!conversation) throw new NotFoundException('会话不存在')
      await this.assertAccessInTransaction(tx, conversation, user.id)
      if (conversation.status !== ChatConversationStatus.OPEN) throw new ConflictException('会话已关闭，无法发送消息')
      const restriction = await tx.chatUserRestriction.findFirst({ where: { userId: user.id, liftedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } })
      if (restriction) throw new ForbiddenException('当前账号已被禁止使用聊天功能')
      const sensitive = await tx.chatSensitiveWord.findFirst({ where: { active: true, normalizedTerm: { in: [input.content.toLocaleLowerCase('zh-CN')] } } })
        ?? (await tx.chatSensitiveWord.findMany({ where: { active: true }, select: { id: true, normalizedTerm: true } })).find((word) => input.content.toLocaleLowerCase('zh-CN').includes(word.normalizedTerm))
      if (sensitive) {
        await this.audit(tx, user, AuditAction.CHAT_MESSAGE_BLOCKED, 'ChatConversation', id, 'blocked', meta, { contentHash: sha256(input.content), sensitiveWordId: sensitive.id })
        return { blocked: true as const, message: null }
      }
      await this.rateLimit.consume(`chat-send:short:${user.id}`, 10, 10_000)
      await this.rateLimit.consume(`chat-send:minute:${user.id}`, 60, 60_000)
      await this.consumeStrangerQuota(tx, conversation, user)
      const message = await tx.chatMessage.create({ data: { conversationId: id, senderId: user.id, clientMessageId: input.clientMessageId, content: input.content }, include: { sender: { include: { role: true } } } })
      await tx.chatConversation.update({ where: { id }, data: { updatedAt: new Date() } })
      return { blocked: false as const, message: mapMessage(message) }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    if (!result.blocked && result.message) {
      const recipients = await this.prisma.chatConversation.findUnique({ where: { id }, include: { members: { where: { removedAt: null }, select: { userId: true } } } })
      if (recipients?.type === ChatConversationType.GLOBAL) {
        this.realtime.toGlobal('message.created', { conversationId: id, message: result.message })
      } else {
        for (const member of recipients?.members ?? []) this.realtime.toUser(member.userId, 'message.created', { conversationId: id, message: result.message })
      }
    }
    return result
  }

  async markRead(id: string, messageId: string, user: AuthenticatedRequestUser) {
    const conversation = await this.getAccessibleConversation(id, user.id)
    const message = await this.prisma.chatMessage.findFirst({ where: { id: messageId, conversationId: id }, select: { id: true, createdAt: true } })
    if (!message) throw new NotFoundException('消息不存在')
    const advanced = await this.advanceReadCursor(conversation.type, id, user.id, message)
    if (advanced) {
      const payload = { conversationId: id, userId: user.id, messageId: message.id, readAt: message.createdAt }
      if (conversation.type === ChatConversationType.GLOBAL) {
        this.realtime.toGlobal('message.read', payload)
      } else {
        for (const member of conversation.members) this.realtime.toUser(member.userId, 'message.read', payload)
      }
    }
    return { advanced, ok: true }
  }

  async updateConversation(id: string, input: { reason: string; title?: string }, user: AuthenticatedRequestUser, meta: ClientRequestMeta) {
    this.requireAdmin(user)
    const conversation = await this.prisma.chatConversation.findUnique({ where: { id }, include: conversationInclude })
    if (!conversation) throw new NotFoundException('会话不存在')
    if (conversation.type === ChatConversationType.DIRECT) throw new ConflictException('私聊不能改名')
    if (!input.title) throw new ConflictException('请提供群名称')
    const updated = await this.prisma.$transaction(async (tx) => {
      const value = await tx.chatConversation.update({ where: { id }, data: { title: input.title }, include: conversationInclude })
      await this.audit(tx, user, AuditAction.CHAT_CONVERSATION_MANAGED, 'ChatConversation', id, 'renamed', meta, { reason: input.reason })
      return value
    })
    this.publishConversationChanged(updated)
    return this.mapConversation(updated, user.id)
  }

  async addMembers(id: string, userIds: string[], user: AuthenticatedRequestUser, meta: ClientRequestMeta) {
    this.requireAdmin(user)
    const conversation = await this.prisma.chatConversation.findUnique({ where: { id }, include: conversationInclude })
    if (!conversation) throw new NotFoundException('会话不存在')
    if (conversation.type !== ChatConversationType.GROUP) throw new ConflictException('仅普通群可管理成员')
    const currentIds = new Set(conversation.members.map((member) => member.userId))
    const addIds = userIds.filter((id) => !currentIds.has(id))
    if (conversation.members.length + addIds.length > MAX_GROUP_MEMBERS) throw new ConflictException('普通群最多 200 人')
    const active = await this.prisma.user.count({ where: { id: { in: addIds }, deletedAt: null, status: UserStatus.ACTIVE } })
    if (active !== addIds.length) throw new NotFoundException('存在不可用成员')
    const updated = await this.prisma.$transaction(async (tx) => {
      for (const memberId of addIds) await tx.chatConversationMember.upsert({ where: { conversationId_userId: { conversationId: id, userId: memberId } }, create: { conversationId: id, userId: memberId }, update: { removedAt: null, joinedAt: new Date() } })
      const value = await tx.chatConversation.findUniqueOrThrow({ where: { id }, include: conversationInclude })
      await this.audit(tx, user, AuditAction.CHAT_CONVERSATION_MANAGED, 'ChatConversation', id, 'members_added', meta, { memberIds: addIds })
      return value
    })
    this.publishConversationChanged(updated)
    return this.mapConversation(updated, user.id)
  }

  async removeMember(id: string, targetUserId: string, user: AuthenticatedRequestUser, meta: ClientRequestMeta) {
    this.requireAdmin(user)
    const conversation = await this.prisma.chatConversation.findUnique({ where: { id }, include: conversationInclude })
    if (!conversation) throw new NotFoundException('会话不存在')
    if (conversation.type !== ChatConversationType.GROUP) throw new ConflictException('仅普通群可管理成员')
    if (targetUserId === conversation.createdById) throw new ConflictException('不能移除建群管理员')
    await this.prisma.$transaction(async (tx) => {
      await tx.chatConversationMember.update({ where: { conversationId_userId: { conversationId: id, userId: targetUserId } }, data: { removedAt: new Date() } })
      await this.audit(tx, user, AuditAction.CHAT_CONVERSATION_MANAGED, 'ChatConversation', id, 'member_removed', meta, { userId: targetUserId })
    })
    this.realtime.toUser(targetUserId, 'conversation.memberChanged', { conversationId: id, removed: true })
    return { ok: true }
  }

  async setConversationStatus(id: string, open: boolean, reason: string, user: AuthenticatedRequestUser, meta: ClientRequestMeta) {
    this.requireAdmin(user)
    const status = open ? ChatConversationStatus.OPEN : ChatConversationStatus.CLOSED
    const updated = await this.prisma.$transaction(async (tx) => {
      const value = await tx.chatConversation.update({ where: { id }, data: { status, closedAt: open ? null : new Date(), closedById: open ? null : user.id, closedReason: open ? null : reason }, include: conversationInclude })
      await this.audit(tx, user, AuditAction.CHAT_CONVERSATION_MANAGED, 'ChatConversation', id, open ? 'reopened' : 'closed', meta, { reason })
      return value
    })
    this.publishConversationChanged(updated)
    this.realtime.toConversation(id, open ? 'conversation.updated' : 'conversation.closed', { conversation: await this.mapConversation(updated, user.id) })
    return this.mapConversation(updated, user.id)
  }

  async dissolveGroup(id: string, reason: string, user: AuthenticatedRequestUser, meta: ClientRequestMeta) {
    this.requireAdmin(user)
    const conversation = await this.prisma.chatConversation.findUnique({ where: { id } })
    if (!conversation) throw new NotFoundException('会话不存在')
    if (conversation.type !== ChatConversationType.GROUP) throw new ConflictException('仅普通群可解散')
    await this.prisma.$transaction(async (tx) => {
      await tx.chatConversation.update({ where: { id }, data: { status: ChatConversationStatus.DISSOLVED, closedAt: new Date(), closedById: user.id, closedReason: reason } })
      await this.audit(tx, user, AuditAction.CHAT_CONVERSATION_MANAGED, 'ChatConversation', id, 'dissolved', meta, { reason })
    })
    this.realtime.toConversation(id, 'conversation.dissolved', { conversationId: id, reason })
    return { ok: true }
  }

  async listAdminConversations(user: AuthenticatedRequestUser) {
    this.requireAdmin(user)
    const rows = await this.prisma.chatConversation.findMany({ include: conversationInclude, orderBy: { updatedAt: 'desc' }, take: 300 })
    return Promise.all(rows.map((row) => this.mapConversation(row, user.id)))
  }

  async restrictUser(input: { userId: string; reason: string; expiresAt: Date | null }, user: AuthenticatedRequestUser, meta: ClientRequestMeta) {
    this.requireAdmin(user)
    if (input.userId === user.id) throw new ConflictException('不能禁用自己')
    const target = await this.prisma.user.findUnique({ where: { id: input.userId } })
    if (!target) throw new NotFoundException('用户不存在')
    const restriction = await this.prisma.$transaction(async (tx) => {
      const value = await tx.chatUserRestriction.upsert({ where: { userId: input.userId }, create: { ...input, disabledById: user.id }, update: { disabledById: user.id, disabledAt: new Date(), expiresAt: input.expiresAt, liftedAt: null, reason: input.reason } })
      await this.audit(tx, user, AuditAction.CHAT_USER_RESTRICTED, 'User', input.userId, 'disabled', meta, { expiresAt: input.expiresAt, reason: input.reason })
      return value
    })
    this.realtime.toUser(input.userId, 'chat.restrictionChanged', { disabled: true, expiresAt: restriction.expiresAt, reason: restriction.reason })
    return restriction
  }

  async liftRestriction(userId: string, user: AuthenticatedRequestUser, meta: ClientRequestMeta) {
    this.requireAdmin(user)
    await this.prisma.$transaction(async (tx) => {
      await tx.chatUserRestriction.update({ where: { userId }, data: { liftedAt: new Date() } })
      await this.audit(tx, user, AuditAction.CHAT_USER_RESTRICTED, 'User', userId, 'lifted', meta, {})
    })
    this.realtime.toUser(userId, 'chat.restrictionChanged', { disabled: false })
    return { ok: true }
  }

  async listSensitiveWords(user: AuthenticatedRequestUser) {
    this.requireAdmin(user)
    return this.prisma.chatSensitiveWord.findMany({ orderBy: { createdAt: 'desc' } })
  }

  async createSensitiveWord(term: string, active: boolean | undefined, user: AuthenticatedRequestUser, meta: ClientRequestMeta) {
    this.requireAdmin(user)
    const normalizedTerm = term.toLocaleLowerCase('zh-CN')
    const word = await this.prisma.$transaction(async (tx) => {
      const value = await tx.chatSensitiveWord.create({ data: { active: active ?? true, createdById: user.id, normalizedTerm, term } })
      await this.audit(tx, user, AuditAction.CHAT_SENSITIVE_WORD_MANAGED, 'ChatSensitiveWord', value.id, 'created', meta, {})
      return value
    })
    return word
  }

  async updateSensitiveWord(id: string, input: { term?: string; active?: boolean }, user: AuthenticatedRequestUser, meta: ClientRequestMeta) {
    this.requireAdmin(user)
    const word = await this.prisma.$transaction(async (tx) => {
      const value = await tx.chatSensitiveWord.update({ where: { id }, data: { active: input.active, term: input.term, normalizedTerm: input.term?.toLocaleLowerCase('zh-CN') } })
      await this.audit(tx, user, AuditAction.CHAT_SENSITIVE_WORD_MANAGED, 'ChatSensitiveWord', id, 'updated', meta, {})
      return value
    })
    return word
  }

  async deleteSensitiveWord(id: string, user: AuthenticatedRequestUser, meta: ClientRequestMeta) {
    this.requireAdmin(user)
    await this.prisma.$transaction(async (tx) => {
      await tx.chatSensitiveWord.delete({ where: { id } })
      await this.audit(tx, user, AuditAction.CHAT_SENSITIVE_WORD_MANAGED, 'ChatSensitiveWord', id, 'deleted', meta, {})
    })
    return { ok: true }
  }

  async getStorage(user: AuthenticatedRequestUser) {
    this.requireAdmin(user)
    const quotaBytes = Number(process.env.CHAT_DATABASE_QUOTA_BYTES ?? 5 * 1024 * 1024 * 1024)
    const rows = await this.prisma.$queryRaw<Array<{ databaseBytes: bigint; chatBytes: bigint }>>(Prisma.sql`
      SELECT pg_database_size(current_database()) AS "databaseBytes",
        pg_total_relation_size('"ChatMessage"') + pg_total_relation_size('"ChatConversation"') + pg_total_relation_size('"ChatConversationMember"') AS "chatBytes"
    `)
    const value = rows[0] ?? { databaseBytes: BigInt(0), chatBytes: BigInt(0) }
    const databaseBytes = Number(value.databaseBytes)
    return { chatBytes: Number(value.chatBytes), databaseBytes, quotaBytes, usagePercent: quotaBytes > 0 ? Math.round((databaseBytes / quotaBytes) * 1000) / 10 : 0, warning: quotaBytes > 0 && databaseBytes / quotaBytes >= 0.8 }
  }

  async previewCleanup(before: Date, user: AuthenticatedRequestUser) {
    this.requireAdmin(user)
    const count = await this.prisma.chatMessage.count({ where: { createdAt: { lt: before } } })
    return { before: before.toISOString(), count, confirmationToken: this.signCleanupToken(before, count), expiresAt: new Date(Date.now() + 10 * 60_000).toISOString() }
  }

  async cleanup(before: Date, token: string, user: AuthenticatedRequestUser, meta: ClientRequestMeta) {
    this.requireAdmin(user)
    const count = await this.prisma.chatMessage.count({ where: { createdAt: { lt: before } } })
    if (!this.verifyCleanupToken(token, before, count)) throw new ForbiddenException('清理确认已过期，请重新预览')
    const deleted = await this.prisma.$transaction(async (tx) => {
      const result = await tx.chatMessage.deleteMany({ where: { createdAt: { lt: before } } })
      await this.audit(tx, user, AuditAction.CHAT_RECORDS_DELETED, 'ChatMessage', null, 'success', meta, { before: before.toISOString(), count: result.count })
      return result.count
    })
    return { deleted }
  }

  async *exportMessages(before: Date, user: AuthenticatedRequestUser, meta: ClientRequestMeta) {
    this.requireAdmin(user)
    await this.prisma.auditLog.create({ data: this.auditData(user, AuditAction.CHAT_RECORDS_EXPORTED, 'ChatMessage', null, 'success', meta, { before: before.toISOString() }) })
    let cursor: string | undefined
    while (true) {
      const batch = await this.prisma.chatMessage.findMany({
        where: { createdAt: { lt: before } },
        include: { sender: { include: { role: true } }, conversation: true },
        orderBy: { id: 'asc' },
        take: 500,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      })
      if (batch.length === 0) return
      for (const message of batch) yield message
      cursor = batch.at(-1)?.id
    }
  }

  private async ensureGlobal(user: AuthenticatedRequestUser) {
    const existing = await this.prisma.chatConversation.findFirst({ where: { type: ChatConversationType.GLOBAL }, include: conversationInclude })
    if (existing) return existing
    const administrator = await this.prisma.user.findFirst({ where: { deletedAt: null, status: UserStatus.ACTIVE, role: { code: RoleCode.ADMIN } }, select: { id: true } })
    try {
      return await this.prisma.chatConversation.create({ data: { type: ChatConversationType.GLOBAL, title: GLOBAL_TITLE, createdById: administrator?.id ?? user.id }, include: conversationInclude })
    } catch (error) {
      if (isUniqueViolation(error)) return this.prisma.chatConversation.findFirstOrThrow({ where: { type: ChatConversationType.GLOBAL }, include: conversationInclude })
      throw error
    }
  }

  private async ensureGlobalReadBaseline(
    conversation: Prisma.ChatConversationGetPayload<{ include: typeof conversationInclude }>,
    userId: string,
  ) {
    const latest = conversation.messages[0] ?? null
    await this.prisma.chatConversationMember.createMany({
      data: [{
        conversationId: conversation.id,
        lastReadAt: latest?.createdAt ?? conversation.createdAt,
        lastReadMessageId: latest?.id,
        role: ChatMemberRole.MEMBER,
        userId,
      }],
      skipDuplicates: true,
    })
    return this.prisma.chatConversation.findUniqueOrThrow({ where: { id: conversation.id }, include: conversationInclude })
  }

  private async advanceReadCursor(
    conversationType: ChatConversationType,
    conversationId: string,
    userId: string,
    target: { createdAt: Date; id: string },
  ) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const member = await tx.chatConversationMember.findUnique({
            where: { conversationId_userId: { conversationId, userId } },
            include: { lastReadMessage: { select: { createdAt: true, id: true } } },
          })
          if (!member) {
            if (conversationType !== ChatConversationType.GLOBAL) throw new ForbiddenException('无权更新此会话的已读状态')
            await tx.chatConversationMember.create({
              data: { conversationId, lastReadAt: target.createdAt, lastReadMessageId: target.id, role: ChatMemberRole.MEMBER, userId },
            })
            return true
          }

          const current = member.lastReadMessage
            ?? (member.lastReadAt ? { createdAt: member.lastReadAt, id: member.lastReadMessageId ?? '' } : null)
          if (current && !isMessageCursorAfter(target, current)) return false

          await tx.chatConversationMember.update({
            where: { id: member.id },
            data: {
              lastReadAt: target.createdAt,
              lastReadMessageId: target.id,
              removedAt: conversationType === ChatConversationType.GLOBAL ? null : undefined,
            },
          })
          return true
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
      } catch (error) {
        if (attempt < 2 && isReadCursorRetryable(error)) continue
        throw error
      }
    }
    return false
  }

  private async getAccessibleConversation(id: string, userId: string) {
    const conversation = await this.prisma.chatConversation.findUnique({ where: { id }, include: conversationInclude })
    if (!conversation) throw new NotFoundException('会话不存在')
    if (conversation.type !== ChatConversationType.GLOBAL && !this.isMember(conversation, userId)) {
      const actor = await this.prisma.user.findUnique({ where: { id: userId }, include: { role: true } })
      if (actor?.role.code !== RoleCode.ADMIN) throw new ForbiddenException('无权访问此会话')
    }
    return conversation
  }

  private async assertAccessInTransaction(tx: Prisma.TransactionClient, conversation: Prisma.ChatConversationGetPayload<{ include: typeof conversationInclude }>, userId: string) {
    if (conversation.type === ChatConversationType.GLOBAL) return
    if (!conversation.members.some((member) => member.userId === userId && !member.removedAt)) throw new ForbiddenException('无权在此会话发送消息')
    const restriction = await tx.chatConversationMember.findFirst({ where: { conversationId: conversation.id, userId, removedAt: null } })
    if (!restriction) throw new ForbiddenException('无权在此会话发送消息')
  }

  private async consumeStrangerQuota(tx: Prisma.TransactionClient, conversation: Prisma.ChatConversationGetPayload<{ include: typeof conversationInclude }>, user: AuthenticatedRequestUser) {
    if (conversation.type !== ChatConversationType.DIRECT || conversation.acceptedAt || conversation.directInitiatorId !== user.id || user.role !== RoleCode.STUDENT) {
      if (conversation.type === ChatConversationType.DIRECT && !conversation.acceptedAt && conversation.directInitiatorId !== user.id) {
        await tx.chatConversation.update({ where: { id: conversation.id }, data: { acceptedAt: new Date() } })
      }
      return
    }
    const updated = await tx.chatConversation.updateMany({ where: { id: conversation.id, acceptedAt: null, strangerMessageCount: { lt: 3 } }, data: { strangerMessageCount: { increment: 1 } } })
    if (updated.count === 0) throw new ConflictException('对方回复前最多发送 3 条消息')
  }

  private async mapConversation(conversation: Prisma.ChatConversationGetPayload<{ include: typeof conversationInclude }>, userId: string) {
    const member = conversation.members.find((item) => item.userId === userId)
    const last = conversation.messages[0] ?? null
    const unreadSince = getUnreadBaseline(member, conversation.createdAt)
    const unreadCursor = member?.lastReadAt && member.lastReadMessageId
      ? { createdAt: member.lastReadAt, id: member.lastReadMessageId }
      : null
    const unread = await this.prisma.chatMessage.count({
      where: {
        conversationId: conversation.id,
        senderId: { not: userId },
        ...(unreadCursor
          ? { OR: [{ createdAt: { gt: unreadCursor.createdAt } }, { createdAt: unreadCursor.createdAt, id: { gt: unreadCursor.id } }] }
          : { createdAt: { gt: unreadSince } }),
      },
    })
    const other = conversation.type === ChatConversationType.DIRECT ? conversation.members.find((item) => item.userId !== userId)?.user : null
    const strangerRemaining = conversation.type === ChatConversationType.DIRECT && conversation.directInitiatorId === userId && !conversation.acceptedAt ? Math.max(0, 3 - conversation.strangerMessageCount) : null
    return {
      id: conversation.id,
      type: conversation.type,
      status: conversation.status,
      title: conversation.type === ChatConversationType.DIRECT ? other?.name ?? '私聊' : conversation.title ?? GLOBAL_TITLE,
      avatarUrl: conversation.type === ChatConversationType.DIRECT ? other?.avatarUrl ?? null : null,
      members: conversation.members.map((item) => mapContact(item.user, false)),
      lastMessage: last ? mapMessage(last) : null,
      unread,
      updatedAt: conversation.updatedAt.toISOString(),
      closedReason: conversation.closedReason,
      strangerRemaining,
      accepted: Boolean(conversation.acceptedAt),
      otherReadAt: conversation.type === ChatConversationType.DIRECT ? conversation.members.find((item) => item.userId !== userId)?.lastReadAt?.toISOString() ?? null : null,
      canSend: conversation.status === ChatConversationStatus.OPEN && strangerRemaining !== 0,
    }
  }

  private isMember(conversation: Prisma.ChatConversationGetPayload<{ include: typeof conversationInclude }>, userId: string) {
    return conversation.members.some((member) => member.userId === userId && !member.removedAt)
  }

  private async getActiveRestriction(userId: string) {
    return this.prisma.chatUserRestriction.findFirst({ where: { userId, liftedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } })
  }

  private requireAdmin(user: AuthenticatedRequestUser) {
    if (user.role !== RoleCode.ADMIN || !user.permissions.includes('chat:manage')) throw new ForbiddenException('仅管理员可执行此操作')
  }

  private async audit(tx: Prisma.TransactionClient, user: AuthenticatedRequestUser, action: AuditAction, targetType: string, targetId: string | null, result: string, meta: ClientRequestMeta, metadata: Record<string, unknown>) {
    await tx.auditLog.create({ data: this.auditData(user, action, targetType, targetId, result, meta, metadata) })
  }

  private auditData(user: AuthenticatedRequestUser, action: AuditAction, targetType: string, targetId: string | null, result: string, meta: ClientRequestMeta, metadata: Record<string, unknown>): Prisma.AuditLogUncheckedCreateInput {
    return { actorId: user.id, action, targetType, targetId, result, ipAddress: meta.ipAddress ?? null, userAgent: meta.userAgent ?? null, requestPath: meta.requestPath ?? null, metadata: metadata as Prisma.InputJsonValue }
  }

  private publishConversationChanged(conversation: Prisma.ChatConversationGetPayload<{ include: typeof conversationInclude }>) {
    for (const member of conversation.members) this.realtime.toUser(member.userId, 'conversation.updated', { conversationId: conversation.id })
    if (conversation.type === ChatConversationType.GLOBAL) this.realtime.toGlobal('conversation.updated', { conversationId: conversation.id })
  }

  private signCleanupToken(before: Date, count: number) {
    const expires = Math.floor(Date.now() / 1000) + 600
    const payload = JSON.stringify({ before: before.toISOString(), count, expires })
    const signature = createHmac('sha256', process.env.JWT_ACCESS_SECRET ?? '').update(payload).digest('hex')
    return Buffer.from(JSON.stringify({ payload, signature })).toString('base64url')
  }

  private verifyCleanupToken(token: string, before: Date, count: number) {
    try {
      const parsed = JSON.parse(Buffer.from(token, 'base64url').toString('utf8')) as { payload?: unknown; signature?: unknown }
      if (typeof parsed.payload !== 'string' || typeof parsed.signature !== 'string') return false
      const body = JSON.parse(parsed.payload) as { before?: unknown; count?: unknown; expires?: unknown }
      if (typeof body.before !== 'string' || typeof body.count !== 'number' || typeof body.expires !== 'number') return false
      const payload = parsed.payload
      const expected = createHmac('sha256', process.env.JWT_ACCESS_SECRET ?? '').update(payload).digest('hex')
      const actual = Buffer.from(parsed.signature)
      const expectedBuffer = Buffer.from(expected)
      return body.before === before.toISOString() && body.count === count && body.expires >= Math.floor(Date.now() / 1000) && actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer)
    } catch {
      return false
    }
  }
}

function mapContact(user: { id: string; name: string; avatarUrl: string | null; college?: string | null; role: { code: RoleCode } }, includeCode: boolean) {
  return { avatarUrl: user.avatarUrl, college: user.college, id: user.id, name: user.name, role: user.role.code, ...(includeCode ? { unifiedCode: (user as { unifiedCode?: string }).unifiedCode } : {}) }
}

function mapMessage(message: { id: string; content: string; createdAt: Date; senderId: string; sender: { id: string; name: string; avatarUrl: string | null; role: { code: RoleCode } } }) {
  return { id: message.id, content: message.content, createdAt: message.createdAt.toISOString(), senderId: message.senderId, sender: mapContact(message.sender, false) }
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}

function isReadCursorRetryable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2002' || error.code === 'P2034')
}

export function isMessageCursorAfter(
  target: { createdAt: Date; id: string },
  current: { createdAt: Date; id: string },
) {
  const timeDifference = target.createdAt.getTime() - current.createdAt.getTime()
  return timeDifference > 0 || (timeDifference === 0 && target.id > current.id)
}

export function getUnreadBaseline(
  member: { joinedAt: Date; lastReadAt: Date | null } | undefined,
  conversationCreatedAt: Date,
) {
  return member?.lastReadAt ?? member?.joinedAt ?? conversationCreatedAt
}
