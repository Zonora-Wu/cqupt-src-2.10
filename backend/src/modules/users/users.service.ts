import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { AuditAction, PointDirection, Prisma, RoleCode, UserStatus } from '@prisma/client'
import { randomBytes } from 'node:crypto'
import { hashPassword } from '../../common/crypto/password'
import { AuthenticatedRequestUser, ClientRequestMeta } from '../auth/auth.types'
import { PrismaService } from '../prisma/prisma.service'
import {
  NormalizedResetUserPasswordInput,
  NormalizedUpdateUserAiQuotaInput,
  NormalizedUpdateUserPermissionInput,
  NormalizedUpdateUserRoleInput,
  NormalizedUpdateUserStatusInput,
} from './users.types'

const DEFAULT_AI_MONTHLY_TOKENS = 100_000
const AI_DEFAULT_MONTHLY_TOKENS_KEY = 'ai_default_monthly_tokens'

@Injectable()
export class UsersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listManagedUsers() {
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null },
      include: managedUserInclude,
      orderBy: [{ role: { code: 'asc' } }, { createdAt: 'desc' }],
      take: 500,
    })
    const quotaContext = await this.getQuotaContext(users.map((user) => user.id))

    return {
      items: users.map((user) => summarizeManagedUser(user, quotaContext)),
      stats: summarizeUserStats(users),
    }
  }

  async getManagedUserDetail(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { deletedAt: null, id },
      include: {
        ...managedUserInclude,
        auditLogs: {
          orderBy: { createdAt: 'desc' },
          select: {
            action: true,
            createdAt: true,
            ipAddress: true,
            metadata: true,
            result: true,
            targetType: true,
          },
          take: 20,
        },
        permissionOverrides: {
          include: { permission: true },
          orderBy: { updatedAt: 'desc' },
        },
      },
    })

    if (!user) {
      throw new NotFoundException('用户不存在')
    }

    const quotaContext = await this.getQuotaContext([user.id])
    return summarizeManagedUserDetail(user, quotaContext)
  }

  async listUserManagementOptions() {
    const [roles, permissions, colleges] = await Promise.all([
      this.prisma.role.findMany({ orderBy: { code: 'asc' } }),
      this.prisma.permission.findMany({ orderBy: { code: 'asc' } }),
      this.prisma.user.findMany({
        distinct: ['college'],
        select: { college: true },
        where: {
          college: { not: null },
          deletedAt: null,
        },
        orderBy: { college: 'asc' },
      }),
    ])

    return {
      colleges: colleges.map((item) => item.college).filter(Boolean),
      permissions: permissions.map((permission) => ({
        code: permission.code,
        name: permission.name,
      })),
      roles: roles.map((role) => ({
        code: role.code,
        description: role.description ?? '',
        label: role.name,
      })),
      statuses: [
        { code: UserStatus.ACTIVE, label: '正常' },
        { code: UserStatus.PENDING, label: '待准入' },
        { code: UserStatus.DISABLED, label: '已禁用' },
        { code: UserStatus.LOCKED, label: '已锁定' },
      ],
    }
  }

  async updateUserRole(
    id: string,
    input: NormalizedUpdateUserRoleInput,
    actor: AuthenticatedRequestUser,
    meta: ClientRequestMeta,
  ) {
    const target = await this.assertManageableUser(id, actor.id)

    if (target.role.code === RoleCode.ADMIN) {
      throw new ForbiddenException('管理员账号的角色不能修改')
    }
    const role = await this.prisma.role.findUnique({
      where: { code: input.role },
    })

    if (!role) {
      throw new BadRequestException('角色不存在')
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.user.update({
        where: { id },
        data: { roleId: role.id },
        include: managedUserInclude,
      })

      await tx.auditLog.create({
        data: {
          action: AuditAction.CHANGE_USER_PERMISSION,
          actorId: actor.id,
          ipAddress: meta.ipAddress,
          metadata: {
            fromRole: target.role.code,
            reason: input.reason,
            toRole: input.role,
          },
          requestPath: meta.requestPath,
          result: 'success',
          targetId: id,
          targetType: 'User',
          userAgent: meta.userAgent,
        },
      })

      return next
    })

    const quotaContext = await this.getQuotaContext([id])
    return summarizeManagedUser(updated, quotaContext)
  }

  async updateUserStatus(
    id: string,
    input: NormalizedUpdateUserStatusInput,
    actor: AuthenticatedRequestUser,
    meta: ClientRequestMeta,
  ) {
    const target = await this.assertManageableUser(id, actor.id)

    if (target.role.code === RoleCode.ADMIN && input.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('管理员账号不能被锁定或禁用')
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.user.update({
        where: { id },
        data: { status: input.status },
        include: managedUserInclude,
      })

      if (input.status !== UserStatus.ACTIVE) {
        await tx.refreshToken.updateMany({
          where: {
            revokedAt: null,
            userId: id,
          },
          data: { revokedAt: new Date() },
        })
      }

      await tx.auditLog.create({
        data: {
          action: AuditAction.MANAGE_USER,
          actorId: actor.id,
          ipAddress: meta.ipAddress,
          metadata: {
            fromStatus: target.status,
            reason: input.reason,
            toStatus: input.status,
          },
          requestPath: meta.requestPath,
          result: 'success',
          targetId: id,
          targetType: 'User',
          userAgent: meta.userAgent,
        },
      })

      return next
    })

    const quotaContext = await this.getQuotaContext([id])
    return summarizeManagedUser(updated, quotaContext)
  }

  async updateUserPermissionOverride(
    id: string,
    input: NormalizedUpdateUserPermissionInput,
    actor: AuthenticatedRequestUser,
    meta: ClientRequestMeta,
  ) {
    await this.assertManageableUser(id, actor.id)
    const permission = await this.prisma.permission.findUnique({
      where: { code: input.permissionCode },
    })

    if (!permission) {
      throw new BadRequestException('权限点不存在')
    }

    const override = await this.prisma.$transaction(async (tx) => {
      const next = await tx.userPermissionOverride.upsert({
        where: {
          userId_permissionId: {
            permissionId: permission.id,
            userId: id,
          },
        },
        create: {
          enabled: input.enabled,
          permissionId: permission.id,
          reason: input.reason,
          userId: id,
        },
        update: {
          enabled: input.enabled,
          reason: input.reason,
        },
        include: { permission: true },
      })

      await tx.auditLog.create({
        data: {
          action: AuditAction.CHANGE_USER_PERMISSION,
          actorId: actor.id,
          ipAddress: meta.ipAddress,
          metadata: {
            enabled: input.enabled,
            permissionCode: input.permissionCode,
            reason: input.reason,
          },
          requestPath: meta.requestPath,
          result: 'success',
          targetId: id,
          targetType: 'UserPermissionOverride',
          userAgent: meta.userAgent,
        },
      })

      return next
    })

    return {
      code: override.permission.code,
      enabled: override.enabled,
      name: override.permission.name,
      reason: override.reason ?? '',
      updatedAt: override.updatedAt,
    }
  }

  async resetUserPassword(
    id: string,
    input: NormalizedResetUserPasswordInput,
    actor: AuthenticatedRequestUser,
    meta: ClientRequestMeta,
  ) {
    await this.assertManageableUser(id, actor.id)
    const temporaryPassword = input.newPassword ?? `Temp${randomBytes(5).toString('base64url')}+-`

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { passwordHash: hashPassword(temporaryPassword) },
      })
      await tx.refreshToken.updateMany({
        where: {
          revokedAt: null,
          userId: id,
        },
        data: { revokedAt: new Date() },
      })
      await tx.auditLog.create({
        data: {
          action: AuditAction.MANAGE_USER,
          actorId: actor.id,
          ipAddress: meta.ipAddress,
          metadata: {
            reason: input.reason,
            temporaryPasswordReturned: process.env.NODE_ENV !== 'production',
          },
          requestPath: meta.requestPath,
          result: 'success',
          targetId: id,
          targetType: 'User',
          userAgent: meta.userAgent,
        },
      })
    })

    return {
      message: '密码已重置，用户需要重新登录。',
      temporaryPassword: process.env.NODE_ENV === 'production' ? undefined : temporaryPassword,
    }
  }

  async updateUserAiQuota(
    id: string,
    input: NormalizedUpdateUserAiQuotaInput,
    actor: AuthenticatedRequestUser,
    meta: ClientRequestMeta,
  ) {
    await this.assertManageableUser(id, actor.id)

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.aiUserQuota.upsert({
        where: { userId: id },
        create: {
          enabled: input.enabled,
          monthlyLimit: input.monthlyLimit,
          updatedById: actor.id,
          userId: id,
        },
        update: {
          enabled: input.enabled,
          monthlyLimit: input.monthlyLimit,
          updatedById: actor.id,
        },
      })

      await tx.auditLog.create({
        data: {
          action: AuditAction.CHANGE_USER_PERMISSION,
          actorId: actor.id,
          ipAddress: meta.ipAddress,
          metadata: {
            action: 'update_ai_quota',
            enabled: input.enabled,
            monthlyLimit: input.monthlyLimit,
            reason: input.reason,
          },
          requestPath: meta.requestPath,
          result: 'success',
          targetId: id,
          targetType: 'AiUserQuota',
          userAgent: meta.userAgent,
        },
      })

      return tx.user.findFirstOrThrow({
        where: { deletedAt: null, id },
        include: managedUserInclude,
      })
    })

    const quotaContext = await this.getQuotaContext([id])
    return summarizeManagedUser(updated, quotaContext)
  }

  private async getQuotaContext(userIds: string[]) {
    const [defaultSetting, usageRows] = await Promise.all([
      this.prisma.systemSetting.findUnique({ where: { key: AI_DEFAULT_MONTHLY_TOKENS_KEY } }),
      userIds.length
        ? this.prisma.aiCallLog.groupBy({
            _sum: { tokensUsed: true },
            by: ['userId'],
            where: {
              createdAt: { gte: getMonthStart() },
              userId: { in: userIds },
            },
          })
        : Promise.resolve([]),
    ])
    const defaultMonthlyTokens = normalizeStoredTokenLimit(defaultSetting?.value, DEFAULT_AI_MONTHLY_TOKENS)
    const usageByUser = new Map(usageRows.map((row) => [row.userId ?? '', row._sum.tokensUsed ?? 0]))

    return {
      defaultMonthlyTokens,
      resetAt: getNextMonthStart(),
      usageByUser,
    }
  }

  private async assertManageableUser(id: string, actorId: string) {
    if (id === actorId) {
      throw new ForbiddenException('不能在用户管理中操作自己的账号')
    }

    const user = await this.prisma.user.findFirst({
      where: { deletedAt: null, id },
      include: { role: true },
    })

    if (!user) {
      throw new NotFoundException('用户不存在')
    }

    return user
  }
}

const managedUserInclude = {
  _count: {
    select: {
      receivedCertificates: true,
      submittedReports: true,
    },
  },
  auditLogs: {
    orderBy: { createdAt: 'desc' },
    select: {
      action: true,
      createdAt: true,
      ipAddress: true,
      result: true,
    },
    take: 8,
  },
  aiQuota: true,
  examAttempts: {
    orderBy: { createdAt: 'desc' },
    take: 1,
  },
  pointEntries: {
    orderBy: { createdAt: 'desc' },
    take: 1,
  },
  refreshTokens: {
    orderBy: { createdAt: 'desc' },
    take: 1,
  },
  responsibilitySigns: {
    include: { agreement: true },
    orderBy: { signedAt: 'desc' },
    take: 1,
  },
  role: true,
  submittedReports: {
    select: {
      status: true,
    },
  },
} satisfies Prisma.UserInclude

type ManagedUser = Prisma.UserGetPayload<{ include: typeof managedUserInclude }>

type QuotaContext = {
  defaultMonthlyTokens: number
  resetAt: Date
  usageByUser: Map<string, number>
}

function summarizeManagedUser(user: ManagedUser, quotaContext: QuotaContext) {
  const latestExam = user.examAttempts[0] ?? null
  const latestSignature = user.responsibilitySigns[0] ?? null
  const latestRefreshToken = user.refreshTokens[0] ?? null
  const latestLoginAudit = user.auditLogs.find((log) => log.action === AuditAction.LOGIN && log.result === 'success') ?? null
  const points = user.pointEntries[0]?.balanceAfter ?? 0
  const validReports = user.submittedReports.filter((report) =>
    ['CONFIRMED', 'FIXING', 'PENDING_RETEST', 'ARCHIVED', 'CERTIFIED'].includes(report.status),
  ).length

  return {
    accessStatus: getAccessStatus(latestExam, latestSignature),
    accountStatus: formatUserStatus(user.status),
    authorizationLevel: user.authorizationLevel,
    certificates: user._count.receivedCertificates,
    college: user.college ?? '',
    createdAt: user.createdAt,
    email: user.email,
    emailVerified: Boolean(user.emailVerifiedAt),
    grade: user.grade ?? '',
    id: user.id,
    identityText: user.identityText ?? '',
    aiQuota: summarizeAiQuota(user, quotaContext),
    lastIp: latestLoginAudit?.ipAddress ?? latestRefreshToken?.ipAddress ?? '',
    lastLogin: user.lastLoginAt,
    name: user.name,
    points,
    responsibilitySigned: Boolean(latestSignature),
    responsibilitySignedAt: latestSignature?.signedAt ?? null,
    responsibilityVersion: latestSignature?.agreement.version ?? '',
    role: user.role.code,
    roleLabel: user.role.name,
    securityExamPassed: latestExam?.passed ?? false,
    securityExamScore: latestExam?.score ?? null,
    securityExamTime: latestExam?.createdAt ?? null,
    status: user.status,
    studentNo: user.studentNo ?? '',
    submissions: user._count.submittedReports,
    unifiedCode: user.unifiedCode,
    updatedAt: user.updatedAt,
    validReports,
  }
}

function summarizeManagedUserDetail(
  user: ManagedUser & {
    permissionOverrides: Array<{
      enabled: boolean
      permission: {
        code: string
        name: string
      }
      reason: string | null
      updatedAt: Date
    }>
  },
  quotaContext: QuotaContext,
) {
  const detailAuditLogs = user.auditLogs as unknown as Array<{
    action: AuditAction
    createdAt: Date
    metadata: Prisma.JsonValue
    result: string
    targetType: string
  }>

  return {
    ...summarizeManagedUser(user, quotaContext),
    auditEvents: detailAuditLogs.map((log) => ({
      action: log.action,
      createdAt: log.createdAt,
      metadata: log.metadata,
      result: log.result,
      targetType: log.targetType,
    })),
    permissionOverrides: user.permissionOverrides.map((override) => ({
      code: override.permission.code,
      enabled: override.enabled,
      name: override.permission.name,
      reason: override.reason ?? '',
      updatedAt: override.updatedAt,
    })),
  }
}

function summarizeAiQuota(user: ManagedUser, quotaContext: QuotaContext) {
  const monthlyLimit = user.aiQuota?.monthlyLimit ?? quotaContext.defaultMonthlyTokens
  const usedThisMonth = quotaContext.usageByUser.get(user.id) ?? 0
  return {
    enabled: user.aiQuota?.enabled ?? true,
    monthlyLimit,
    overridden: Boolean(user.aiQuota),
    remaining: Math.max(0, monthlyLimit - usedThisMonth),
    resetAt: quotaContext.resetAt,
    usedPercent: monthlyLimit > 0 ? Math.min(100, Math.round((usedThisMonth / monthlyLimit) * 100)) : 100,
    usedThisMonth,
  }
}

function summarizeUserStats(users: ManagedUser[]) {
  return {
    active: users.filter((user) => user.status === UserStatus.ACTIVE).length,
    admins: users.filter((user) => user.role.code === RoleCode.ADMIN).length,
    auditors: users.filter((user) => user.role.code === RoleCode.AUDITOR).length,
    disabled: users.filter((user) => user.status === UserStatus.DISABLED).length,
    locked: users.filter((user) => user.status === UserStatus.LOCKED).length,
    pending: users.filter((user) => user.status === UserStatus.PENDING).length,
    students: users.filter((user) => user.role.code === RoleCode.STUDENT).length,
    total: users.length,
  }
}

function getAccessStatus(
  latestExam: ManagedUser['examAttempts'][number] | null,
  latestSignature: ManagedUser['responsibilitySigns'][number] | null,
) {
  if (latestSignature) return '已签责任书'
  if (latestExam?.passed) return '答题通过'
  if (latestExam && !latestExam.passed) return '未通过'
  return '未答题'
}

function formatUserStatus(status: UserStatus) {
  const map: Record<UserStatus, string> = {
    ACTIVE: '正常',
    DISABLED: '已禁用',
    LOCKED: '已锁定',
    PENDING: '待准入',
  }

  return map[status]
}

function getMonthStart() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

function getNextMonthStart() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() + 1, 1)
}

function normalizeStoredTokenLimit(value: unknown, fallback: number) {
  const numberValue = Number(value)
  return Number.isInteger(numberValue) && numberValue >= 0 ? numberValue : fallback
}
