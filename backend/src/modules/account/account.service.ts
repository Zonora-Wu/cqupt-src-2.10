import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common'
import { AuditAction, VulnerabilityStatus } from '@prisma/client'
import { createHash } from 'node:crypto'
import { hashPassword, verifyPassword } from '../../common/crypto/password'
import { AuthenticatedRequestUser, ClientRequestMeta } from '../auth/auth.types'
import { PrismaService } from '../prisma/prisma.service'
import { SchoolPolicyService } from '../school/school-policy.service'
import { ChangeEmailInput, ChangePasswordInput, ChangePasswordWithOldInput, SendCurrentEmailCodeInput } from './account.types'

type UploadedImageFile = { buffer?: Buffer; mimetype?: string; size?: number }
const DEFAULT_AI_MONTHLY_TOKENS = 100_000
const AI_DEFAULT_MONTHLY_TOKENS_KEY = 'ai_default_monthly_tokens'

@Injectable()
export class AccountService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(SchoolPolicyService)
    private readonly schoolPolicy: SchoolPolicyService,
  ) {}

  async getProfile(user: AuthenticatedRequestUser) {
    const profile = await this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        id: user.id,
      },
      include: {
        _count: {
          select: {
            receivedCertificates: true,
            submittedReports: true,
          },
        },
        examAttempts: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        pointEntries: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        responsibilitySigns: {
          include: { agreement: true },
          orderBy: { signedAt: 'desc' },
          take: 1,
        },
        role: true,
        aiQuota: true,
        submittedReports: {
          select: { status: true },
        },
      },
    })

    if (!profile) {
      throw new NotFoundException('用户不存在')
    }

    const latestExam = profile.examAttempts[0] ?? null
    const latestSignature = profile.responsibilitySigns[0] ?? null
    const latestPoints = profile.pointEntries[0] ?? null
    const aiQuota = await this.getAiQuotaSummary(profile.id, profile.aiQuota)
    const validStatuses: VulnerabilityStatus[] = [
      VulnerabilityStatus.CONFIRMED,
      VulnerabilityStatus.FIXING,
      VulnerabilityStatus.PENDING_RETEST,
      VulnerabilityStatus.ARCHIVED,
      VulnerabilityStatus.CERTIFIED,
    ]

    return {
      account: {
        authorizationLevel: profile.authorizationLevel,
        avatarUrl: profile.avatarUrl ?? null,
        college: profile.college ?? '',
        createdAt: profile.createdAt,
        email: profile.email,
        emailVerified: Boolean(profile.emailVerifiedAt),
        grade: profile.grade ?? '',
        identityText: profile.identityText ?? '',
        lastLoginAt: profile.lastLoginAt,
        name: profile.name,
        role: profile.role.code,
        roleLabel: profile.role.name,
        status: profile.status,
        studentNo: profile.studentNo ?? '',
        unifiedCode: profile.unifiedCode,
      },
      security: {
        latestPasswordChangeHint: null,
        responsibilityAgreement: latestSignature
          ? {
              signedAt: latestSignature.signedAt,
              version: latestSignature.agreement.version,
            }
          : null,
        securityExam: latestExam
          ? {
              passed: latestExam.passed,
              score: latestExam.score,
              submittedAt: latestExam.createdAt,
            }
          : null,
      },
      stats: {
        certificates: profile._count.receivedCertificates,
        currentPoints: latestPoints?.balanceAfter ?? 0,
        submittedReports: profile._count.submittedReports,
        validReports: profile.submittedReports.filter((report) => validStatuses.includes(report.status)).length,
      },
      aiQuota,
    }
  }

  private async getAiQuotaSummary(userId: string, quotaOverride: { enabled: boolean; monthlyLimit: number } | null) {
    const [defaultSetting, usage] = await Promise.all([
      this.prisma.systemSetting.findUnique({ where: { key: AI_DEFAULT_MONTHLY_TOKENS_KEY } }),
      this.prisma.aiCallLog.aggregate({
        _sum: { tokensUsed: true },
        where: {
          createdAt: { gte: getMonthStart() },
          userId,
        },
      }),
    ])
    const defaultMonthlyTokens = normalizeStoredTokenLimit(defaultSetting?.value, DEFAULT_AI_MONTHLY_TOKENS)
    const monthlyLimit = quotaOverride?.monthlyLimit ?? defaultMonthlyTokens
    const usedThisMonth = usage._sum.tokensUsed ?? 0

    return {
      enabled: quotaOverride?.enabled ?? true,
      monthlyLimit,
      overridden: Boolean(quotaOverride),
      remaining: Math.max(0, monthlyLimit - usedThisMonth),
      resetAt: getNextMonthStart(),
      usedPercent: monthlyLimit > 0 ? Math.min(100, Math.round((usedThisMonth / monthlyLimit) * 100)) : 100,
      usedThisMonth,
    }
  }

  async changePassword(user: AuthenticatedRequestUser, input: ChangePasswordInput, meta: ClientRequestMeta) {
    const codeHash = createHash('sha256').update(input.code).digest('hex')
    const verificationCode = await this.prisma.emailVerificationCode.findFirst({
      where: {
        codeHash,
        consumedAt: null,
        email: user.email.toLowerCase(),
        expiresAt: { gt: new Date() },
        purpose: 'CHANGE_PASSWORD',
        userId: user.id,
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!verificationCode) {
      throw new UnauthorizedException('邮箱验证码错误或已过期')
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash: hashPassword(input.newPassword),
        },
      })

      await tx.refreshToken.updateMany({
        where: {
          revokedAt: null,
          userId: user.id,
        },
        data: {
          revokedAt: new Date(),
        },
      })

      await tx.emailVerificationCode.update({
        where: { id: verificationCode.id },
        data: { consumedAt: new Date() },
      })

      await tx.auditLog.create({
        data: {
          action: AuditAction.MANAGE_USER,
          actorId: user.id,
          ipAddress: meta.ipAddress,
          metadata: {
            action: 'self_change_password',
            refreshTokensRevoked: true,
          },
          requestPath: meta.requestPath,
          result: 'success',
          targetId: user.id,
          targetType: 'User',
          userAgent: meta.userAgent,
        },
      })
    })

    return {
      message: '密码已更新，请在其他设备上重新登录。',
    }
  }

  async changePasswordWithOld(user: AuthenticatedRequestUser, input: ChangePasswordWithOldInput, meta: ClientRequestMeta) {
    const currentUser = await this.prisma.user.findFirst({
      where: { deletedAt: null, id: user.id },
      select: { passwordHash: true },
    })

    if (!currentUser || !currentUser.passwordHash) {
      throw new UnauthorizedException('账号状态异常，无法修改密码')
    }

    if (!verifyPassword(input.oldPassword, currentUser.passwordHash)) {
      throw new UnauthorizedException('旧密码错误')
    }

    if (input.oldPassword === input.newPassword) {
      throw new BadRequestException('新密码不能与旧密码相同')
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash: hashPassword(input.newPassword),
        },
      })

      await tx.refreshToken.updateMany({
        where: {
          revokedAt: null,
          userId: user.id,
        },
        data: {
          revokedAt: new Date(),
        },
      })

      await tx.auditLog.create({
        data: {
          action: AuditAction.MANAGE_USER,
          actorId: user.id,
          ipAddress: meta.ipAddress,
          metadata: {
            action: 'self_change_password_with_old',
            refreshTokensRevoked: true,
          },
          requestPath: meta.requestPath,
          result: 'success',
          targetId: user.id,
          targetType: 'User',
          userAgent: meta.userAgent,
        },
      })
    })

    return {
      message: '密码已更新，请在其他设备上重新登录。',
    }
  }

  async sendCurrentEmailCode(user: AuthenticatedRequestUser, input: SendCurrentEmailCodeInput, meta: ClientRequestMeta) {
    if (!user.email) {
      throw new BadRequestException('当前账号未绑定邮箱')
    }

    const devCode = '123456'
    const codeHash = createHash('sha256').update(devCode).digest('hex')

    await this.prisma.emailVerificationCode.create({
      data: {
        codeHash,
        email: user.email.toLowerCase(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        ipAddress: meta.ipAddress,
        purpose: input.purpose,
        userAgent: meta.userAgent,
        userId: user.id,
      },
    })

    return {
      devCode: process.env.NODE_ENV === 'production' ? undefined : devCode,
      message: `验证码已发送至 ${maskEmail(user.email)}`,
    }
  }

  async changeEmail(user: AuthenticatedRequestUser, input: ChangeEmailInput, meta: ClientRequestMeta) {
    if (input.newEmail === user.email.toLowerCase()) {
      throw new BadRequestException('新邮箱不能与当前邮箱相同')
    }

    await this.schoolPolicy.assertSchoolEmail(input.newEmail)

    const existingUser = await this.prisma.user.findUnique({
      where: { email: input.newEmail },
    })

    if (existingUser) {
      throw new ConflictException('该邮箱已被其他账号绑定')
    }

    const codeHash = createHash('sha256').update(input.code).digest('hex')
    const verificationCode = await this.prisma.emailVerificationCode.findFirst({
      where: {
        codeHash,
        consumedAt: null,
        email: user.email.toLowerCase(),
        expiresAt: { gt: new Date() },
        purpose: 'CHANGE_EMAIL',
        userId: user.id,
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!verificationCode) {
      throw new UnauthorizedException('邮箱验证码错误或已过期')
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          email: input.newEmail,
          emailVerifiedAt: new Date(),
        },
      })

      await tx.emailVerificationCode.update({
        where: { id: verificationCode.id },
        data: { consumedAt: new Date() },
      })

      await tx.auditLog.create({
        data: {
          action: AuditAction.MANAGE_USER,
          actorId: user.id,
          ipAddress: meta.ipAddress,
          metadata: {
            action: 'self_change_email',
            fromEmail: maskEmail(user.email),
            toEmail: maskEmail(input.newEmail),
          },
          requestPath: meta.requestPath,
          result: 'success',
          targetId: user.id,
          targetType: 'User',
          userAgent: meta.userAgent,
        },
      })
    })

    return {
      email: input.newEmail,
      message: '邮箱已更新。',
    }
  }

  async uploadAvatar(userId: string, file: UploadedImageFile) {
    const allowedMime = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!file.mimetype || !allowedMime.includes(file.mimetype)) {
      throw new BadRequestException('仅支持 JPG、PNG、WebP、GIF 格式的图片')
    }

    if (!file.buffer || !file.size) {
      throw new BadRequestException('文件内容为空')
    }

    if (file.size > 2 * 1024 * 1024) {
      throw new BadRequestException('图片大小不能超过 2MB')
    }

    const base64 = file.buffer.toString('base64')
    const avatarUrl = `data:${file.mimetype};base64,${base64}`
    await this.prisma.user.update({ where: { id: userId }, data: { avatarUrl } })

    return { avatarUrl, message: '头像已更新' }
  }

  async getMyAuditLogs(userId: string, rawQuery: Record<string, unknown>) {
    const page = Math.max(1, Number(rawQuery['page']) || 1)
    const pageSize = Math.min(50, Math.max(1, Number(rawQuery['pageSize']) || 20))
    const module = typeof rawQuery['module'] === 'string' && rawQuery['module'] !== '全部' ? rawQuery['module'] : undefined
    const result = typeof rawQuery['result'] === 'string' && rawQuery['result'] !== '全部' ? rawQuery['result'] : undefined

    const where = {
      actorId: userId,
      ...(module ? { action: { in: getModuleActions(module) } } : {}),
      ...(result ? { result } : {}),
    }

    const [total, logs] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        where,
        select: {
          id: true,
          action: true,
          createdAt: true,
          ipAddress: true,
          requestPath: true,
          result: true,
          userAgent: true,
        },
      }),
    ])

    return {
      items: logs.map((log) => ({
        ...log,
        actionLabel: auditActionLabels[log.action as keyof typeof auditActionLabels] ?? log.action,
        resultLabel: log.result === 'success' ? '成功' : log.result === 'failure' ? '失败' : log.result,
        module: getActionModule(log.action),
        moduleLabel: getActionModuleLabel(log.action),
        summary: '',
      })),
      pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    }
  }
}

function maskEmail(email: string) {
  const [name, domain] = email.split('@')
  if (!name || !domain) return '***'
  const prefix = name.slice(0, 2)
  return `${prefix}${'*'.repeat(Math.max(3, name.length - 2))}@${domain}`
}

const auditActionLabels: Record<string, string> = {
  CALL_AI: '调用 AI 能力',
  CHANGE_SYSTEM_SETTING: '修改系统设置',
  CHANGE_USER_PERMISSION: '调整用户权限',
  CHANGE_VULNERABILITY_STATUS: '变更漏洞状态',
  CREATE_VULNERABILITY: '创建漏洞记录',
  ISSUE_CERTIFICATE: '签发证书',
  LOGIN: '登录',
  LOGOUT: '退出登录',
  MANAGE_LEARNING_RESOURCE: '管理学习资源',
  MANAGE_MALL: '管理积分商城',
  MANAGE_USER: '管理用户',
  PUBLISH_ANNOUNCEMENT: '管理公告',
  REVIEW_VULNERABILITY: '审核漏洞',
  REVOKE_CERTIFICATE: '撤销证书',
  SUBMIT_VULNERABILITY: '提交漏洞',
  VIEW_SENSITIVE_ATTACHMENT: '查看敏感附件',
}

const moduleActionMap: Record<string, string[]> = {
  AUTH: ['LOGIN', 'LOGOUT'],
  VULNERABILITY: ['SUBMIT_VULNERABILITY', 'CREATE_VULNERABILITY', 'CHANGE_VULNERABILITY_STATUS', 'REVIEW_VULNERABILITY'],
  CERTIFICATE: ['ISSUE_CERTIFICATE', 'REVOKE_CERTIFICATE'],
  USER: ['MANAGE_USER', 'CHANGE_USER_PERMISSION'],
  ANNOUNCEMENT: ['PUBLISH_ANNOUNCEMENT'],
  LEARNING: ['MANAGE_LEARNING_RESOURCE'],
  MALL: ['MANAGE_MALL'],
  AI: ['CALL_AI'],
  SYSTEM: ['CHANGE_SYSTEM_SETTING'],
  ATTACHMENT: ['VIEW_SENSITIVE_ATTACHMENT'],
}

function getModuleActions(module: string): AuditAction[] {
  return ((moduleActionMap[module] ?? []) as AuditAction[])
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

function getActionModule(action: string): string {
  for (const [mod, actions] of Object.entries(moduleActionMap)) {
    if (actions.includes(action)) return mod
  }
  return 'SYSTEM'
}

function getActionModuleLabel(action: string): string {
  const moduleLabels: Record<string, string> = {
    AUTH: '认证登录',
    VULNERABILITY: '漏洞管理',
    CERTIFICATE: '证书管理',
    USER: '用户管理',
    ANNOUNCEMENT: '公告管理',
    LEARNING: '学习管理',
    MALL: '积分商城',
    AI: 'AI 调用',
    SYSTEM: '系统设置',
    ATTACHMENT: '敏感附件',
  }
  return moduleLabels[getActionModule(action)] ?? '其他'
}
