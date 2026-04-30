import { BadRequestException } from '@nestjs/common'
import { AuditAction } from '@prisma/client'
import { AuditLogQuery, AuditModuleCode, AuditRiskLevel } from './audit-logs.types'

const moduleAliases: Record<string, AuditModuleCode> = {
  AI: 'AI',
  AI调用: 'AI',
  ANNOUNCEMENT: 'ANNOUNCEMENT',
  ATTACHMENT: 'ATTACHMENT',
  AUTH: 'AUTH',
  CERTIFICATE: 'CERTIFICATE',
  LEARNING: 'LEARNING',
  MALL: 'MALL',
  SYSTEM: 'SYSTEM',
  USER: 'USER',
  VULNERABILITY: 'VULNERABILITY',
  公告管理: 'ANNOUNCEMENT',
  学习管理: 'LEARNING',
  审计日志: 'SYSTEM',
  敏感附件: 'ATTACHMENT',
  漏洞管理: 'VULNERABILITY',
  用户管理: 'USER',
  积分商城: 'MALL',
  系统设置: 'SYSTEM',
  认证登录: 'AUTH',
  证书管理: 'CERTIFICATE',
}

const riskAliases: Record<string, AuditRiskLevel> = {
  HIGH: 'HIGH',
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  普通: 'LOW',
  重要: 'MEDIUM',
  高风险: 'HIGH',
}

type RawQuery = Record<string, unknown>

export function normalizeAuditLogQuery(query: RawQuery): AuditLogQuery {
  const page = normalizeInt(query.page, 1, 1, 100000)
  const pageSize = normalizeInt(query.pageSize, 20, 1, 100)

  return {
    action: normalizeAction(query.action),
    actorId: normalizeText(query.actorId, 120),
    actorKeyword: normalizeText(query.actorKeyword, 120),
    dateFrom: normalizeDate(query.dateFrom, '开始时间'),
    dateTo: normalizeDate(query.dateTo, '结束时间'),
    ipAddress: normalizeText(query.ipAddress, 80),
    keyword: normalizeText(query.keyword, 120),
    module: normalizeModule(query.module),
    page,
    pageSize,
    result: normalizeResult(query.result),
    riskLevel: normalizeRisk(query.riskLevel),
    targetId: normalizeText(query.targetId, 160),
    targetType: normalizeText(query.targetType, 80),
  }
}

function normalizeInt(value: unknown, defaultValue: number, min: number, max: number) {
  if (value === undefined || value === null || value === '') return defaultValue
  const number = Number(value)
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new BadRequestException(`分页参数必须是 ${min} 到 ${max} 之间的整数`)
  }
  return number
}

function normalizeText(value: unknown, maxLength: number) {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string') {
    throw new BadRequestException('查询参数格式不正确')
  }

  const text = value.trim()
  if (!text) return undefined
  if (text.length > maxLength) {
    throw new BadRequestException(`查询参数不能超过 ${maxLength} 个字符`)
  }

  return text
}

function normalizeAction(value: unknown) {
  const text = normalizeText(value, 80)
  if (!text) return undefined
  if (Object.values(AuditAction).includes(text as AuditAction)) {
    return text as AuditAction
  }

  throw new BadRequestException('审计动作不正确')
}

function normalizeModule(value: unknown) {
  const text = normalizeText(value, 30)
  if (!text || text === '全部模块') return undefined
  const module = moduleAliases[text]
  if (!module) {
    throw new BadRequestException('审计模块不正确')
  }

  return module
}

function normalizeRisk(value: unknown) {
  const text = normalizeText(value, 30)
  if (!text || text === '全部等级') return undefined
  const risk = riskAliases[text]
  if (!risk) {
    throw new BadRequestException('风险等级不正确')
  }

  return risk
}

function normalizeResult(value: unknown) {
  const text = normalizeText(value, 40)
  if (!text || text === '全部结果') return undefined
  const resultAliases: Record<string, string> = {
    blocked: 'blocked',
    failed: 'failed',
    failure: 'failed',
    success: 'success',
    已拦截: 'blocked',
    失败: 'failed',
    成功: 'success',
  }

  return resultAliases[text] ?? text
}

function normalizeDate(value: unknown, label: string) {
  const text = normalizeText(value, 60)
  if (!text) return undefined
  const date = new Date(text)
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`${label}格式不正确`)
  }

  return date
}
