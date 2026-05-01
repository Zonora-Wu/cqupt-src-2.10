import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { AuditAction, Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { getAuditActionLabelMatches, getAuditRiskLevel, getModuleActionList, mapAuditLogDetail, mapAuditLogItem } from './audit-log-mapper'
import { AuditLogQuery } from './audit-logs.types'

const auditInclude = {
  actor: {
    include: {
      role: true,
    },
  },
} satisfies Prisma.AuditLogInclude

@Injectable()
export class AuditLogsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listAuditLogs(query: AuditLogQuery) {
    const where = buildAuditWhere(query)
    const [total, logs] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        include: auditInclude,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        where,
      }),
    ])

    return {
      items: logs.map(mapAuditLogItem),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
    }
  }

  async getAuditLogDetail(id: string) {
    const log = await this.prisma.auditLog.findUnique({
      include: auditInclude,
      where: { id },
    })

    if (!log) {
      throw new NotFoundException('审计日志不存在')
    }

    return mapAuditLogDetail(log)
  }

  async listTargetAuditLogs(targetType: string, targetId: string, query: AuditLogQuery) {
    return this.listAuditLogs({
      ...query,
      targetId,
      targetType,
    })
  }

  async getAuditLogStats(query: AuditLogQuery) {
    const where = buildAuditWhere(query)
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const [total, today, actionGroups, resultGroups, recentHighRiskLogs] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.count({
        where: {
          ...where,
          createdAt: {
            ...(where.createdAt && typeof where.createdAt === 'object' ? where.createdAt : {}),
            gte: todayStart,
          },
        },
      }),
      this.prisma.auditLog.groupBy({
        by: ['action'],
        _count: { _all: true },
        where,
      }),
      this.prisma.auditLog.groupBy({
        by: ['result'],
        _count: { _all: true },
        where,
      }),
      this.prisma.auditLog.findMany({
        include: auditInclude,
        orderBy: { createdAt: 'desc' },
        take: 200,
        where,
      }),
    ])

    const highRisk = await this.prisma.auditLog.count({
      where: mergeWhereWithAnd(where, buildRiskWhere('HIGH')),
    })

    return {
      actionGroups: actionGroups
        .map((group) => ({
          action: group.action,
          count: group._count._all,
        }))
        .sort((a, b) => b.count - a.count),
      highRisk,
      recentHighRisk: recentHighRiskLogs
        .filter((log) => getAuditRiskLevel(log.action, log.result) === 'HIGH')
        .slice(0, 5)
        .map(mapAuditLogItem),
      resultGroups: resultGroups
        .map((group) => ({
          count: group._count._all,
          result: group.result,
        }))
        .sort((a, b) => b.count - a.count),
      today,
      total,
    }
  }
}

function buildAuditWhere(query: AuditLogQuery): Prisma.AuditLogWhereInput {
  const actionFilters: AuditAction[][] = []

  if (query.action) actionFilters.push([query.action])
  if (query.module) actionFilters.push(getModuleActionList(query.module))

  const actionIn = intersectActionFilters(actionFilters)
  const where: Prisma.AuditLogWhereInput = {}

  if (actionIn) {
    where.action = { in: actionIn }
  }

  if (query.actorId) {
    where.actorId = query.actorId
  }

  if (query.actorKeyword) {
    where.actor = buildActorKeywordWhere(query.actorKeyword)
  }

  if (query.dateFrom || query.dateTo) {
    where.createdAt = {
      ...(query.dateFrom ? { gte: query.dateFrom } : {}),
      ...(query.dateTo ? { lte: query.dateTo } : {}),
    }
  }

  if (query.ipAddress) {
    where.ipAddress = { contains: query.ipAddress, mode: 'insensitive' }
  }

  if (query.result) {
    where.result = { contains: query.result, mode: 'insensitive' }
  }

  if (query.targetId) {
    where.targetId = query.targetId
  }

  if (query.targetType) {
    where.targetType = query.targetType
  }

  if (query.keyword) {
    const actionMatches = getAuditActionLabelMatches(query.keyword)
    where.OR = [
      { actor: buildActorKeywordWhere(query.keyword) },
      { ipAddress: { contains: query.keyword, mode: 'insensitive' } },
      { requestPath: { contains: query.keyword, mode: 'insensitive' } },
      { result: { contains: query.keyword, mode: 'insensitive' } },
      { targetId: { contains: query.keyword, mode: 'insensitive' } },
      { targetType: { contains: query.keyword, mode: 'insensitive' } },
      ...(actionMatches.length > 0 ? [{ action: { in: actionMatches } }] : []),
    ]
  }

  if (query.riskLevel) {
    return mergeWhereWithAnd(where, buildRiskWhere(query.riskLevel))
  }

  return where
}

function buildRiskWhere(riskLevel: AuditLogQuery['riskLevel']): Prisma.AuditLogWhereInput {
  if (riskLevel === 'HIGH') {
    return {
      OR: [
        {
          action: {
            in: [
              AuditAction.CHANGE_SYSTEM_SETTING,
              AuditAction.CHANGE_USER_PERMISSION,
              AuditAction.ISSUE_CERTIFICATE,
              AuditAction.MANAGE_USER,
              AuditAction.REVIEW_VULNERABILITY,
              AuditAction.REVOKE_CERTIFICATE,
              AuditAction.VIEW_SENSITIVE_ATTACHMENT,
            ],
          },
        },
        {
          action: AuditAction.LOGIN,
          result: { not: 'success' },
        },
      ],
    }
  }

  if (riskLevel === 'MEDIUM') {
    return {
      action: {
        in: [
          AuditAction.CALL_AI,
          AuditAction.MANAGE_LEARNING_RESOURCE,
          AuditAction.MANAGE_MALL,
          AuditAction.PUBLISH_ANNOUNCEMENT,
          AuditAction.SUBMIT_VULNERABILITY,
        ],
      },
    }
  }

  return {
    AND: [
      {
        action: {
          notIn: [
            AuditAction.CALL_AI,
            AuditAction.CHANGE_SYSTEM_SETTING,
            AuditAction.CHANGE_USER_PERMISSION,
            AuditAction.ISSUE_CERTIFICATE,
            AuditAction.MANAGE_LEARNING_RESOURCE,
            AuditAction.MANAGE_MALL,
            AuditAction.MANAGE_USER,
            AuditAction.PUBLISH_ANNOUNCEMENT,
            AuditAction.REVIEW_VULNERABILITY,
            AuditAction.REVOKE_CERTIFICATE,
            AuditAction.SUBMIT_VULNERABILITY,
            AuditAction.VIEW_SENSITIVE_ATTACHMENT,
          ],
        },
      },
      {
        OR: [
          { action: { not: AuditAction.LOGIN } },
          { result: 'success' },
        ],
      },
    ],
  }
}

function mergeWhereWithAnd(left: Prisma.AuditLogWhereInput, right: Prisma.AuditLogWhereInput): Prisma.AuditLogWhereInput {
  if (Object.keys(left).length === 0) return right
  if (Object.keys(right).length === 0) return left
  return {
    AND: [left, right],
  }
}

function buildActorKeywordWhere(keyword: string): Prisma.UserWhereInput {
  return {
    OR: [
      { email: { contains: keyword, mode: 'insensitive' } },
      { name: { contains: keyword, mode: 'insensitive' } },
      { unifiedCode: { contains: keyword, mode: 'insensitive' } },
    ],
  }
}

function intersectActionFilters(filters: AuditAction[][]) {
  if (filters.length === 0) return undefined
  const [first, ...rest] = filters
  const firstSet = new Set(first)
  const result = rest.reduce((current, next) => {
    const nextSet = new Set(next)
    return new Set(Array.from(current).filter((action) => nextSet.has(action)))
  }, firstSet)

  return Array.from(result)
}
