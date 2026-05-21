import { BadRequestException } from '@nestjs/common'
import {
  AiKnowledgeCategory,
  AiKnowledgeConversationStatus,
  AiKnowledgeFeedbackValue,
  AiKnowledgeRoleScope,
  AiKnowledgeSensitivity,
  AiKnowledgeStatus,
  AiKnowledgeVisibility,
  AiSkillCandidateStatus,
} from '@prisma/client'
import {
  AiKnowledgeCreateInput,
  AiKnowledgeConversationListQuery,
  AiKnowledgeConversationReviewInput,
  AiKnowledgeFeedbackInput,
  AiKnowledgeListQuery,
  AiKnowledgeReviewInput,
  AiSkillCandidateCreateInput,
  AiSkillCandidateReviewInput,
} from './ai-knowledge.types'

const MAX_PAGE_SIZE = 100
const DEFAULT_PAGE_SIZE = 20

export function normalizeKnowledgeListQuery(query: Record<string, unknown>): AiKnowledgeListQuery {
  return {
    category: normalizeEnum(query.category, AiKnowledgeCategory, '知识分类'),
    keyword: optionalText(query.keyword, '关键词', 80),
    page: positiveInt(query.page, 1),
    pageSize: Math.min(positiveInt(query.pageSize, DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE),
    roleScope: normalizeEnum(query.roleScope, AiKnowledgeRoleScope, '角色范围'),
    status: normalizeEnum(query.status, AiKnowledgeStatus, '知识状态'),
  }
}

export function normalizeConversationListQuery(query: Record<string, unknown>): AiKnowledgeConversationListQuery {
  return {
    page: positiveInt(query.page, 1),
    pageSize: Math.min(positiveInt(query.pageSize, DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE),
    status: normalizeEnum(query.status, AiKnowledgeConversationStatus, '会话状态'),
  }
}

export function normalizeConversationReviewBody(body: Record<string, unknown>): AiKnowledgeConversationReviewInput {
  const status = normalizeEnum(body.status, AiKnowledgeConversationStatus, '会话审核状态')
  if (status !== AiKnowledgeConversationStatus.APPROVED_TO_KB && status !== AiKnowledgeConversationStatus.SKILL_CANDIDATE && status !== AiKnowledgeConversationStatus.DISCARDED) {
    throw new BadRequestException('会话审核状态只能是 APPROVED_TO_KB、SKILL_CANDIDATE 或 DISCARDED')
  }
  return { note: optionalText(body.note, '审核备注', 1000), status }
}

export function normalizeCreateKnowledgeBody(body: Record<string, unknown>): AiKnowledgeCreateInput {
  return {
    answer: requiredText(body.answer, '标准答案', 20, 12000),
    category: normalizeEnum(body.category, AiKnowledgeCategory, '知识分类') ?? AiKnowledgeCategory.VULNERABILITY_REPORTING,
    question: requiredText(body.question, '标准问题', 5, 3000),
    roleScope: normalizeEnum(body.roleScope, AiKnowledgeRoleScope, '角色范围') ?? AiKnowledgeRoleScope.ALL,
    sensitivity: normalizeEnum(body.sensitivity, AiKnowledgeSensitivity, '敏感级别'),
    tags: normalizeTags(body.tags),
    title: requiredText(body.title, '标题', 3, 120),
    visibility: normalizeEnum(body.visibility, AiKnowledgeVisibility, '可见性') ?? AiKnowledgeVisibility.REVIEW_REQUIRED,
  }
}

export function normalizeKnowledgeReviewBody(body: Record<string, unknown>): AiKnowledgeReviewInput {
  const status = normalizeEnum(body.status, AiKnowledgeStatus, '审核状态')
  if (status !== AiKnowledgeStatus.APPROVED && status !== AiKnowledgeStatus.REJECTED && status !== AiKnowledgeStatus.ARCHIVED) {
    throw new BadRequestException('审核状态只能是 APPROVED、REJECTED 或 ARCHIVED')
  }
  return { note: optionalText(body.note, '审核备注', 1000), status }
}

export function normalizeKnowledgeFeedbackBody(body: Record<string, unknown>): AiKnowledgeFeedbackInput {
  const value = normalizeEnum(body.value, AiKnowledgeFeedbackValue, '反馈值')
  if (!value) throw new BadRequestException('反馈值不能为空')
  return { note: optionalText(body.note, '反馈备注', 500), value }
}

export function normalizeSkillCandidateBody(body: Record<string, unknown>): AiSkillCandidateCreateInput {
  return {
    description: requiredText(body.description, 'Skill 描述', 10, 500),
    name: normalizeSkillName(requiredText(body.name, 'Skill 名称', 3, 64)),
    sourceKnowledgeIds: normalizeIdList(body.sourceKnowledgeIds),
  }
}

export function normalizeSkillCandidateReviewBody(body: Record<string, unknown>): AiSkillCandidateReviewInput {
  const status = normalizeEnum(body.status, AiSkillCandidateStatus, '候选状态')
  if (status !== AiSkillCandidateStatus.APPROVED && status !== AiSkillCandidateStatus.REJECTED) {
    throw new BadRequestException('候选审核状态只能是 APPROVED 或 REJECTED')
  }
  return { note: optionalText(body.note, '审核备注', 1000), status }
}

function requiredText(value: unknown, label: string, min: number, max: number) {
  if (typeof value !== 'string') throw new BadRequestException(`${label}格式不正确`)
  const text = value.trim()
  if (text.length < min) throw new BadRequestException(`${label}不能少于 ${min} 个字符`)
  if (text.length > max) throw new BadRequestException(`${label}不能超过 ${max} 个字符`)
  return text
}

function optionalText(value: unknown, label: string, max: number) {
  if (value === undefined || value === null || value === '') return undefined
  return requiredText(value, label, 1, max)
}

function positiveInt(value: unknown, fallback: number) {
  if (value === undefined || value === null || value === '') return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) throw new BadRequestException('分页参数不正确')
  return parsed
}

function normalizeEnum<T extends Record<string, string>>(value: unknown, source: T | undefined, label: string): T[keyof T] | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (!source || typeof value !== 'string' || !Object.values(source).includes(value)) {
    throw new BadRequestException(`${label}不正确`)
  }
  return value as T[keyof T]
}

function normalizeTags(value: unknown) {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) throw new BadRequestException('标签格式不正确')
  return value.map((item) => requiredText(item, '标签', 1, 24)).slice(0, 12)
}

function normalizeIdList(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) throw new BadRequestException('来源知识不能为空')
  return value.map((item) => requiredText(item, '知识 ID', 3, 128)).slice(0, 20)
}

function normalizeSkillName(value: string) {
  const name = value.trim().toLowerCase()
  if (!/^[a-z0-9][a-z0-9_-]{2,63}$/.test(name)) {
    throw new BadRequestException('Skill 名称只能包含小写字母、数字、下划线和短横线，且必须以字母或数字开头')
  }
  return name
}
