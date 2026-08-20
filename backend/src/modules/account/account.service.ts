import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common'
import { AuditAction, VulnerabilityStatus } from '@prisma/client'
import { createHash, randomInt } from 'node:crypto'
import {
  getActiveTokenLimit,
  getNextQuotaPeriodStart,
  getQuotaPeriodStart,
  normalizeQuotaPeriod,
  normalizeStoredTokenLimit,
  type AiQuotaPeriod,
} from '../../common/ai-quota-period'
import { hashPassword, verifyPassword } from '../../common/crypto/password'
import { AuthenticatedRequestUser, ClientRequestMeta } from '../auth/auth.types'
import { EmailService } from '../email/email.service'
import { HumanVerificationService } from '../human-verification/human-verification.service'
import { PrismaService } from '../prisma/prisma.service'
import { NotificationDeliveryService } from '../notifications/notification-delivery.service'
import { ChangeEmailInput, ChangePasswordInput, ChangePasswordWithOldInput, SendCurrentEmailCodeInput, UpdateProfileBasicsInput } from './account.types'

type UploadedImageFile = { buffer?: Buffer; mimetype?: string; size?: number }
const DEFAULT_AI_DAILY_TOKENS = 20_000
const DEFAULT_AI_WEEKLY_TOKENS = 60_000
const DEFAULT_AI_MONTHLY_TOKENS = 100_000
const AI_DEFAULT_DAILY_TOKENS_KEY = 'ai_default_daily_tokens'
const AI_DEFAULT_WEEKLY_TOKENS_KEY = 'ai_default_weekly_tokens'
const AI_DEFAULT_MONTHLY_TOKENS_KEY = 'ai_default_monthly_tokens'
const AI_QUOTA_PERIOD_KEY = 'ai_quota_period'
const EMAIL_CODE_TTL_MS = 10 * 60 * 1000

@Injectable()
export class AccountService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(HumanVerificationService)
    private readonly humanVerification: HumanVerificationService,
    @Inject(EmailService)
    private readonly email: EmailService,
    @Inject(NotificationDeliveryService)
    private readonly notifications: NotificationDeliveryService,
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
        aiAssistantTutorialCompletedAt: profile.aiAssistantTutorialCompletedAt,
        avatarUrl: profile.avatarUrl ?? null,
        college: profile.college ?? '',
        createdAt: profile.createdAt,
        email: profile.email,
        emailVerified: Boolean(profile.emailVerifiedAt),
        grade: profile.grade ?? '',
        identityText: profile.identityText ?? '',
        lastLoginAt: profile.lastLoginAt,
        name: profile.name,
        profileCompleted: isProfileComplete(profile),
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

  async completeAiAssistantTutorial(userId: string) {
    const existing = await this.prisma.user.findFirst({
      select: { aiAssistantTutorialCompletedAt: true },
      where: { deletedAt: null, id: userId },
    })
    if (!existing) throw new NotFoundException('用户不存在')
    const completedAt = existing.aiAssistantTutorialCompletedAt ?? new Date()
    if (!existing.aiAssistantTutorialCompletedAt) {
      await this.prisma.user.update({ data: { aiAssistantTutorialCompletedAt: completedAt }, where: { id: userId } })
    }
    return { completedAt }
  }

  async updateProfileBasics(user: AuthenticatedRequestUser, input: UpdateProfileBasicsInput, meta: ClientRequestMeta) {
    if (input.studentNo) {
      const existingStudentNo = await this.prisma.user.findFirst({
        where: {
          deletedAt: null,
          id: { not: user.id },
          studentNo: input.studentNo,
        },
        select: { id: true },
      })

      if (existingStudentNo) {
        throw new ConflictException('学号已被其他账号使用')
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.user.update({
        where: { id: user.id },
        data: {
          college: input.college,
          grade: input.grade || null,
          identityText: input.identityText,
          studentNo: input.studentNo || null,
        },
        include: { role: true },
      })

      await tx.auditLog.create({
        data: {
          action: AuditAction.MANAGE_USER,
          actorId: user.id,
          ipAddress: meta.ipAddress,
          metadata: {
            action: 'update_profile_basics',
            college: input.college,
            grade: input.grade || null,
            identityText: input.identityText,
            studentNoProvided: Boolean(input.studentNo),
          },
          requestPath: meta.requestPath,
          result: 'success',
          targetId: user.id,
          targetType: 'User',
          userAgent: meta.userAgent,
        },
      })

      return next
    })

    return {
      college: updated.college ?? '',
      grade: updated.grade ?? '',
      identityText: updated.identityText ?? '',
      profileCompleted: isProfileComplete(updated),
      studentNo: updated.studentNo ?? '',
    }
  }

  private async getAiQuotaSummary(userId: string, quotaOverride: { dailyLimit: number | null; enabled: boolean; monthlyLimit: number; weeklyLimit: number | null } | null) {
    const settingsRows = await this.prisma.systemSetting.findMany({
      where: {
        key: {
          in: [
            AI_DEFAULT_DAILY_TOKENS_KEY,
            AI_DEFAULT_WEEKLY_TOKENS_KEY,
            AI_DEFAULT_MONTHLY_TOKENS_KEY,
            AI_QUOTA_PERIOD_KEY,
          ],
        },
      },
    })
    const settingsMap = Object.fromEntries(settingsRows.map((row) => [row.key, row.value]))
    const quotaPeriod = normalizeQuotaPeriod(settingsMap[AI_QUOTA_PERIOD_KEY])
    const usage = await this.prisma.aiCallLog.aggregate({
      _sum: { tokensUsed: true },
      where: {
        createdAt: { gte: getQuotaPeriodStart(quotaPeriod) },
        userId,
      },
    })
    const dailyLimit = quotaOverride?.dailyLimit ?? quotaOverride?.monthlyLimit ?? normalizeStoredTokenLimit(settingsMap[AI_DEFAULT_DAILY_TOKENS_KEY], DEFAULT_AI_DAILY_TOKENS)
    const weeklyLimit = quotaOverride?.weeklyLimit ?? quotaOverride?.monthlyLimit ?? normalizeStoredTokenLimit(settingsMap[AI_DEFAULT_WEEKLY_TOKENS_KEY], DEFAULT_AI_WEEKLY_TOKENS)
    const monthlyLimit = quotaOverride?.monthlyLimit ?? normalizeStoredTokenLimit(settingsMap[AI_DEFAULT_MONTHLY_TOKENS_KEY], DEFAULT_AI_MONTHLY_TOKENS)
    const activeLimit = getActiveTokenLimit({ daily: dailyLimit, monthly: monthlyLimit, weekly: weeklyLimit }, quotaPeriod)
    const usedThisPeriod = usage._sum.tokensUsed ?? 0

    return {
      activeLimit,
      dailyLimit,
      enabled: quotaOverride?.enabled ?? true,
      monthlyLimit,
      overridden: Boolean(quotaOverride),
      quotaPeriod,
      remaining: Math.max(0, activeLimit - usedThisPeriod),
      resetAt: getNextQuotaPeriodStart(quotaPeriod),
      usedPercent: activeLimit > 0 ? Math.min(100, Math.round((usedThisPeriod / activeLimit) * 100)) : 100,
      usedThisMonth: usedThisPeriod,
      usedThisPeriod,
      weeklyLimit,
    }
  }

  async changePassword(user: AuthenticatedRequestUser, input: ChangePasswordInput, meta: ClientRequestMeta) {
    await this.humanVerification.verify(input.humanVerification, 'CHANGE_PASSWORD', meta)

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

    const notificationIds: string[] = []
    const changedAt = new Date()
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
      notificationIds.push(await this.notifications.create(tx, {
        channelId: 'system', channelTitle: '账号安全通知',
        content: `你的账号密码已于 ${formatSecurityTime(changedAt)} 修改。操作 IP：${maskIp(meta.ipAddress)}。如非本人操作，请立即联系管理员。`,
        emailRequired: true, entityId: `password:${changedAt.toISOString()}`, entityType: 'SecurityEvent',
        eventKey: `security:${user.id}:password:${changedAt.toISOString()}`, iconType: 'bell',
        recipientId: user.id, route: roleSecurityRoute(user.role),
      }))
    })
    await this.notifications.dispatchAfterCommit(notificationIds)

    return {
      message: '密码已更新，请在其他设备上重新登录。',
    }
  }

  async changePasswordWithOld(user: AuthenticatedRequestUser, input: ChangePasswordWithOldInput, meta: ClientRequestMeta) {
    await this.humanVerification.verify(input.humanVerification, 'CHANGE_PASSWORD', meta)

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

    const notificationIds: string[] = []
    const changedAt = new Date()
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
      notificationIds.push(await this.notifications.create(tx, {
        channelId: 'system', channelTitle: '账号安全通知',
        content: `你的账号密码已于 ${formatSecurityTime(changedAt)} 修改。操作 IP：${maskIp(meta.ipAddress)}。如非本人操作，请立即联系管理员。`,
        emailRequired: true, entityId: `password:${changedAt.toISOString()}`, entityType: 'SecurityEvent',
        eventKey: `security:${user.id}:password:${changedAt.toISOString()}`, iconType: 'bell',
        recipientId: user.id, route: roleSecurityRoute(user.role),
      }))
    })
    await this.notifications.dispatchAfterCommit(notificationIds)

    return {
      message: '密码已更新，请在其他设备上重新登录。',
    }
  }

  async sendCurrentEmailCode(user: AuthenticatedRequestUser, input: SendCurrentEmailCodeInput, meta: ClientRequestMeta) {
    await this.humanVerification.verify(
      input.humanVerification,
      input.purpose === 'CHANGE_EMAIL' ? 'CHANGE_EMAIL_CODE' : 'CHANGE_PASSWORD',
      meta,
    )

    if (!user.email) {
      throw new BadRequestException('当前账号未绑定邮箱')
    }

    const code = generateEmailCode()
    const codeHash = createHash('sha256').update(code).digest('hex')
    await this.email.sendVerificationCode({
      code,
      expiresInMinutes: EMAIL_CODE_TTL_MS / 60_000,
      purpose: input.purpose,
      to: user.email,
    })

    await this.prisma.emailVerificationCode.create({
      data: {
        codeHash,
        email: user.email.toLowerCase(),
        expiresAt: new Date(Date.now() + EMAIL_CODE_TTL_MS),
        ipAddress: meta.ipAddress,
        purpose: input.purpose,
        userAgent: meta.userAgent,
        userId: user.id,
      },
    })

    return {
      message: `验证码已发送至 ${maskEmail(user.email)}`,
    }
  }

  async changeEmail(user: AuthenticatedRequestUser, input: ChangeEmailInput, meta: ClientRequestMeta) {
    await this.humanVerification.verify(input.humanVerification, 'CHANGE_EMAIL_SUBMIT', meta)

    if (input.newEmail === user.email.toLowerCase()) {
      throw new BadRequestException('新邮箱不能与当前邮箱相同')
    }

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

    const notificationIds: string[] = []
    const changedAt = new Date()
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
      notificationIds.push(await this.notifications.create(tx, {
        channelId: 'system', channelTitle: '账号安全通知',
        content: `你的绑定邮箱已于 ${formatSecurityTime(changedAt)} 修改。新邮箱：${maskEmail(input.newEmail)}。操作 IP：${maskIp(meta.ipAddress)}。`,
        emailRequired: true, entityId: `email:${changedAt.toISOString()}`, entityType: 'SecurityEvent',
        eventKey: `security:${user.id}:email:${changedAt.toISOString()}`, iconType: 'bell',
        recipientId: user.id, route: roleSecurityRoute(user.role),
      }))
    })
    await this.notifications.dispatchAfterCommit(notificationIds)

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

function generateEmailCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

function formatSecurityTime(value: Date) {
  return value.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
}

function maskIp(ipAddress?: string) {
  if (!ipAddress) return '未知'
  if (ipAddress.includes(':')) {
    const groups = ipAddress.split(':').filter(Boolean)
    return `${groups.slice(0, 2).join(':')}:****:****`
  }
  const parts = ipAddress.split('.')
  return parts.length === 4 ? `${parts[0]}.${parts[1]}.*.*` : '已隐藏'
}

function roleSecurityRoute(role: string) {
  if (role === 'ADMIN') return '/admin/account-security'
  if (role === 'AUDITOR') return '/auditor/profile'
  return '/user/account-security'
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

function isProfileComplete(user: { college: string | null; identityText: string | null; studentNo: string | null }) {
  const identityText = user.identityText?.trim() ?? ''
  return Boolean(user.college?.trim() && identityText && (isTeacherIdentity(identityText) || user.studentNo?.trim()))
}

function isTeacherIdentity(identityText: string) {
  return identityText === '教师' || identityText === '信息化办老师'
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
