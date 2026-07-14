import { BadRequestException } from '@nestjs/common'
import { CreateDirectConversationBody, CreateGroupConversationBody, ManageConversationBody, ManageMembersBody, ReadConversationBody, RestrictUserBody, SendMessageBody, SensitiveWordBody } from './chat.types'

export function normalizeDirectBody(body: CreateDirectConversationBody) {
  return { targetUserId: requireId(body.targetUserId, '联系人') }
}

export function normalizeGroupBody(body: CreateGroupConversationBody) {
  const title = requireText(body.title, '群名称', 2, 40)
  const memberIds = normalizeIds(body.memberIds)
  if (memberIds.length === 0) throw new BadRequestException('群成员不能为空')
  if (memberIds.length > 199) throw new BadRequestException('普通群最多 200 人')
  return { memberIds, title }
}

export function normalizeMessageBody(body: SendMessageBody) {
  const clientMessageId = requireText(body.clientMessageId, '消息标识', 8, 128)
  const content = normalizeChatText(body.content)
  return { clientMessageId, content }
}

export function normalizeReadBody(body: ReadConversationBody) {
  return { messageId: requireId(body.messageId, '消息') }
}

export function normalizeManageConversationBody(body: ManageConversationBody, titleRequired = false) {
  const title = titleRequired ? requireText(body.title, '群名称', 2, 40) : optionalText(body.title, '群名称', 2, 40)
  return { reason: requireText(body.reason, '操作原因', 2, 500), title }
}

export function normalizeMembersBody(body: ManageMembersBody) {
  const userIds = normalizeIds(body.userIds)
  if (userIds.length === 0) throw new BadRequestException('成员不能为空')
  return { userIds }
}

export function normalizeRestrictionBody(body: RestrictUserBody) {
  const expiresRaw = body.expiresAt
  let expiresAt: Date | null = null
  if (expiresRaw !== undefined && expiresRaw !== null && expiresRaw !== '') {
    if (typeof expiresRaw !== 'string') throw new BadRequestException('禁用截止时间格式不正确')
    expiresAt = new Date(expiresRaw)
    if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) throw new BadRequestException('禁用截止时间必须晚于当前时间')
  }
  return { expiresAt, reason: requireText(body.reason, '禁用原因', 2, 500), userId: requireId(body.userId, '用户') }
}

export function normalizeSensitiveWordBody(body: SensitiveWordBody, update = false) {
  if (body.active !== undefined && typeof body.active !== 'boolean') throw new BadRequestException('启用状态格式不正确')
  const active = body.active as boolean | undefined
  const term = body.term === undefined ? undefined : normalizeChatText(body.term, 80)
  if (!update && !term) throw new BadRequestException('敏感词不能为空')
  return { active, term }
}

export function normalizeChatText(value: unknown, max = 2000) {
  if (typeof value !== 'string') throw new BadRequestException('消息格式不正确')
  const text = value.normalize('NFKC').replace(/\s+/g, ' ').trim()
  if (!text) throw new BadRequestException('消息不能为空')
  if (Array.from(text).length > max) throw new BadRequestException(`消息不能超过 ${max} 个字符`)
  return text
}

export function normalizeCursor(value: unknown, max = 100) {
  const numberValue = Number(value ?? 50)
  if (!Number.isInteger(numberValue) || numberValue < 1 || numberValue > max) throw new BadRequestException('分页参数不正确')
  return numberValue
}

export function normalizeBefore(value: unknown) {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string' || value.length > 128) throw new BadRequestException('游标格式不正确')
  return value
}

function requireText(value: unknown, label: string, min: number, max: number) {
  const text = optionalText(value, label, min, max)
  if (!text) throw new BadRequestException(`${label}不能为空`)
  return text
}

function optionalText(value: unknown, label: string, min: number, max: number) {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string') throw new BadRequestException(`${label}格式不正确`)
  const text = value.trim()
  if (text.length < min || text.length > max) throw new BadRequestException(`${label}长度应为 ${min}-${max} 个字符`)
  return text
}

function requireId(value: unknown, label: string) {
  if (typeof value !== 'string' || !/^[a-z0-9]+$/i.test(value) || value.length < 8 || value.length > 64) {
    throw new BadRequestException(`${label}标识不正确`)
  }
  return value
}

function normalizeIds(value: unknown) {
  if (!Array.isArray(value)) throw new BadRequestException('成员格式不正确')
  const ids = [...new Set(value.map((item) => requireId(item, '用户')))]
  return ids
}
