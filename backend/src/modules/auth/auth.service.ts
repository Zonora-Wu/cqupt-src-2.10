import { BadRequestException, ConflictException, forwardRef, Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { AuditAction, AuthorizationLevel, Prisma, RoleCode, User, UserStatus } from '@prisma/client'

export type PendingRegistrationResponse = { pending: true; message: string }
import { randomBytes, createHash, randomInt, timingSafeEqual } from 'node:crypto'
import { getJwtExpiry, signJwt } from '../../common/crypto/jwt'
import { hashPassword, verifyPassword } from '../../common/crypto/password'
import { EmailService } from '../email/email.service'
import { HumanVerificationService } from '../human-verification/human-verification.service'
import { HumanVerificationInput } from '../human-verification/human-verification.types'
import { PrismaService } from '../prisma/prisma.service'
import { RbacService } from '../rbac/rbac.service'
import { NotificationDeliveryService } from '../notifications/notification-delivery.service'
import { ClientRequestMeta, LoginResponse } from './auth.types'
import { NormalizedRegisterInput, NormalizedResetPasswordInput } from './auth.validation'

const EMAIL_CODE_TTL_MS = 10 * 60 * 1000
const EMAIL_CODE_RESEND_INTERVAL_MS = 60 * 1000
const EMAIL_CODE_MAX_PER_WINDOW = 5
const EMAIL_CODE_WINDOW_MS = 10 * 60 * 1000
const PASSWORD_LOGIN_HUMAN_VERIFICATION_THRESHOLD = 3
const PASSWORD_LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000
const PASSWORD_RESET_MIN_RESPONSE_MS = 900

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(RbacService)
    private readonly rbac: RbacService,
    @Inject(HumanVerificationService)
    private readonly humanVerification: HumanVerificationService,
    @Inject(EmailService)
    private readonly email: EmailService,
    @Inject(forwardRef(() => NotificationDeliveryService))
    private readonly notifications: NotificationDeliveryService,
  ) {}

  async loginWithPassword(unifiedCode: string, password: string, humanInput: HumanVerificationInput | null, meta: ClientRequestMeta): Promise<LoginResponse> {
    if (!humanInput) {
      throw new UnauthorizedException({
        message: '请先完成安全校验',
        requiresHumanVerification: true,
      })
    }
    await this.humanVerification.verify(humanInput, 'LOGIN_PASSWORD', meta)

    const user = await this.prisma.user.findUnique({
      where: { unifiedCode },
      include: { role: true },
    })

    if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
      this.recordPasswordLoginFailure(unifiedCode, meta.ipAddress)
      await this.writeLoginAudit(null, 'failed', meta)
      throw new UnauthorizedException({
        message: '统一认证码或密码错误',
        requiresHumanVerification: this.requiresPasswordLoginVerification(unifiedCode, meta.ipAddress),
      })
    }

    this.clearPasswordLoginFailures(unifiedCode, meta.ipAddress)
    return this.completeLogin(user, meta)
  }

  async sendEmailLoginCode(email: string, humanInput: HumanVerificationInput, meta: ClientRequestMeta) {
    const normalizedEmail = email.trim().toLowerCase()
    await this.humanVerification.verify(humanInput, 'LOGIN_EMAIL_CODE', meta)

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    if (!user) {
      throw new UnauthorizedException('邮箱未注册或不可用')
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('账号当前不可登录')
    }

    if (!user.emailVerifiedAt) {
      throw new UnauthorizedException('邮箱尚未完成绑定验证')
    }

    await this.assertEmailCodeRateLimit(normalizedEmail, 'LOGIN', meta)

    const code = generateEmailCode()
    const codeHash = createHash('sha256').update(code).digest('hex')
    await this.email.sendVerificationCode({
      code,
      expiresInMinutes: EMAIL_CODE_TTL_MS / 60_000,
      purpose: 'LOGIN',
      to: normalizedEmail,
    })

    await this.prisma.$transaction(async (tx) => {
      await tx.emailVerificationCode.updateMany({
        where: {
          consumedAt: null,
          email: normalizedEmail,
          purpose: 'LOGIN',
        },
        data: { consumedAt: new Date() },
      })

      await tx.emailVerificationCode.create({
        data: {
          userId: user.id,
          email: normalizedEmail,
          codeHash,
          purpose: 'LOGIN',
          expiresAt: new Date(Date.now() + EMAIL_CODE_TTL_MS),
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        },
      })
    })

    return {
      message: `验证码已发送至 ${normalizedEmail}`,
    }
  }

  async sendRegisterEmailCode(email: string, humanInput: HumanVerificationInput, meta: ClientRequestMeta) {
    const normalizedEmail = email.trim().toLowerCase()
    await this.humanVerification.verify(humanInput, 'REGISTER_EMAIL_CODE', meta)

    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    if (existingUser) {
      throw new ConflictException('该邮箱已注册，请直接登录')
    }

    await this.assertEmailCodeRateLimit(normalizedEmail, 'REGISTER', meta)

    const code = generateEmailCode()
    const codeHash = createHash('sha256').update(code).digest('hex')
    await this.email.sendVerificationCode({
      code,
      expiresInMinutes: EMAIL_CODE_TTL_MS / 60_000,
      purpose: 'REGISTER',
      to: normalizedEmail,
    })

    await this.prisma.emailVerificationCode.create({
      data: {
        email: normalizedEmail,
        codeHash,
        purpose: 'REGISTER',
        expiresAt: new Date(Date.now() + EMAIL_CODE_TTL_MS),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    })

    return {
      message: `验证码已发送至 ${normalizedEmail}`,
    }
  }

  async sendPasswordResetCode(email: string, humanInput: HumanVerificationInput, meta: ClientRequestMeta) {
    const startedAt = Date.now()
    const normalizedEmail = email.trim().toLowerCase()
    await this.humanVerification.verify(humanInput, 'RESET_PASSWORD', meta)
    const user = await this.prisma.user.findUnique({
      select: { emailVerifiedAt: true, id: true, status: true },
      where: { email: normalizedEmail },
    })
    const genericMessage = '若该邮箱已绑定可用账号，验证码将发送至该邮箱'
    if (!user || user.status !== UserStatus.ACTIVE || !user.emailVerifiedAt) {
      await waitForPasswordResetResponse(startedAt)
      throw new BadRequestException('该邮箱未绑定可用账号，请检查邮箱或联系管理员')
    }

    const code = generateEmailCode()
    const codeHash = createHash('sha256').update(code).digest('hex')
    const verificationCodeId = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'RESET_PASSWORD:' + normalizedEmail}))`
      try {
        await this.assertEmailCodeRateLimit(normalizedEmail, 'RESET_PASSWORD', meta, tx)
      } catch (error) {
        if (error instanceof BadRequestException) return null
        throw error
      }
      await tx.emailVerificationCode.updateMany({
        data: { consumedAt: new Date() },
        where: { consumedAt: null, email: normalizedEmail, purpose: 'RESET_PASSWORD' },
      })
      const created = await tx.emailVerificationCode.create({
        data: {
          codeHash,
          email: normalizedEmail,
          expiresAt: new Date(Date.now() + EMAIL_CODE_TTL_MS),
          ipAddress: meta.ipAddress,
          purpose: 'RESET_PASSWORD',
          userAgent: meta.userAgent,
          userId: user.id,
        },
      })
      return created.id
    })
    if (!verificationCodeId) {
      await waitForPasswordResetResponse(startedAt)
      return { message: genericMessage }
    }
    try {
      await this.email.sendVerificationCode({
        code,
        expiresInMinutes: EMAIL_CODE_TTL_MS / 60_000,
        purpose: 'RESET_PASSWORD',
        to: normalizedEmail,
      })
    } catch (error) {
      await this.prisma.$transaction([
        this.prisma.emailVerificationCode.updateMany({
          data: { consumedAt: new Date() },
          where: { consumedAt: null, id: verificationCodeId },
        }),
        this.prisma.auditLog.create({
          data: {
            action: AuditAction.MANAGE_USER,
            actorId: user.id,
            ipAddress: meta.ipAddress,
            metadata: { action: 'send_password_reset_code', error: sanitizeResetEmailError(error) },
            requestPath: meta.requestPath,
            result: 'failed',
            targetId: user.id,
            targetType: 'User',
            userAgent: meta.userAgent,
          },
        }),
      ])
    }
    await waitForPasswordResetResponse(startedAt)
    return { message: genericMessage }
  }

  async resetPassword(input: NormalizedResetPasswordInput, meta: ClientRequestMeta) {
    const user = await this.prisma.user.findUnique({
      include: { role: true },
      where: { email: input.email },
    })
    const verificationCode = user ? await this.prisma.emailVerificationCode.findFirst({
      orderBy: { createdAt: 'desc' },
      where: {
        consumedAt: null,
        email: input.email,
        expiresAt: { gt: new Date() },
        purpose: 'RESET_PASSWORD',
        userId: user.id,
      },
    }) : null
    if (!user || user.status !== UserStatus.ACTIVE || !verificationCode || verificationCode.attemptCount >= 5) {
      throw new UnauthorizedException('邮箱验证码错误或已过期')
    }
    const codeHash = createHash('sha256').update(input.code).digest('hex')
    if (!safeHashEqual(verificationCode.codeHash, codeHash)) {
      await this.prisma.emailVerificationCode.updateMany({
        data: { attemptCount: { increment: 1 } },
        where: {
          attemptCount: { lt: 5 },
          consumedAt: null,
          id: verificationCode.id,
        },
      })
      throw new UnauthorizedException('邮箱验证码错误或已过期')
    }

    const changedAt = new Date()
    const notificationIds: string[] = []
    await this.prisma.$transaction(async (tx) => {
      const claimedCode = await tx.emailVerificationCode.updateMany({
        data: { attemptCount: { increment: 1 }, consumedAt: changedAt },
        where: {
          attemptCount: { lt: 5 },
          consumedAt: null,
          id: verificationCode.id,
        },
      })
      if (claimedCode.count !== 1) {
        throw new UnauthorizedException('邮箱验证码错误或已过期')
      }
      await tx.user.update({
        data: { passwordHash: hashPassword(input.newPassword) },
        where: { id: user.id },
      })
      await tx.refreshToken.updateMany({
        data: { revokedAt: changedAt },
        where: { revokedAt: null, userId: user.id },
      })
      await tx.auditLog.create({
        data: {
          action: AuditAction.MANAGE_USER,
          actorId: user.id,
          ipAddress: meta.ipAddress,
          metadata: { action: 'self_reset_password', refreshTokensRevoked: true },
          requestPath: meta.requestPath,
          result: 'success',
          targetId: user.id,
          targetType: 'User',
          userAgent: meta.userAgent,
        },
      })
      notificationIds.push(await this.notifications.create(tx, {
        channelId: 'system',
        channelTitle: '账号安全通知',
        content: `你的账号密码已于 ${formatSecurityTime(changedAt)} 通过找回密码功能重置。操作 IP：${maskIp(meta.ipAddress)}。如非本人操作，请立即联系管理员。`,
        emailRequired: true,
        entityId: `password-reset:${changedAt.toISOString()}`,
        entityType: 'SecurityEvent',
        eventKey: `security:${user.id}:password-reset:${changedAt.toISOString()}`,
        iconType: 'bell',
        recipientId: user.id,
        route: roleSecurityRoute(user.role.code),
      }))
    })
    await this.notifications.dispatchAfterCommit(notificationIds)
    return { message: '密码已重置，请使用新密码登录。' }
  }

  async register(input: NormalizedRegisterInput, meta: ClientRequestMeta): Promise<LoginResponse | PendingRegistrationResponse> {
    await this.assertRegisterCode(input.email, input.code)

    const [existingCode, existingEmail, studentRole, registrationSetting] = await Promise.all([
      this.prisma.user.findUnique({ where: { unifiedCode: input.unifiedCode } }),
      this.prisma.user.findUnique({ where: { email: input.email } }),
      this.prisma.role.findUnique({ where: { code: RoleCode.STUDENT } }),
      this.prisma.systemSetting.findUnique({ where: { key: 'open_registration' } }),
    ])

    if (existingCode) {
      throw new ConflictException('统一认证码已注册')
    }

    if (existingEmail) {
      throw new ConflictException('邮箱已注册')
    }

    if (!studentRole) {
      throw new BadRequestException('学生角色尚未初始化，请先执行数据库种子脚本')
    }

    // Check if open registration is enabled (default: true if setting not found)
    const openRegistration = registrationSetting ? (registrationSetting.value as boolean) !== false : true

    if (!openRegistration) {
      // Closed registration: create PENDING user awaiting admin approval
      await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            authorizationLevel: AuthorizationLevel.BASIC,
            email: input.email,
            emailVerifiedAt: new Date(),
            name: input.name,
            passwordHash: hashPassword(input.password),
            pendingRegistrationApproval: true,
            roleId: studentRole.id,
            status: UserStatus.PENDING,
            unifiedCode: input.unifiedCode,
          },
        })

        await tx.emailVerificationCode.updateMany({
          where: { email: input.email, purpose: 'REGISTER', consumedAt: null },
          data: { consumedAt: new Date() },
        })

        await tx.auditLog.create({
          data: {
            action: AuditAction.MANAGE_USER,
            actorId: created.id,
            ipAddress: meta.ipAddress,
            metadata: {
              action: 'pending_registration',
              email: input.email,
              name: input.name,
              unifiedCode: input.unifiedCode,
            },
            requestPath: meta.requestPath,
            result: 'success',
            targetId: created.id,
            targetType: 'User',
            userAgent: meta.userAgent,
          },
        })
      })

      return { pending: true, message: '注册申请已提交，等待管理员审核。审核通过后即可登录。' }
    }

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          authorizationLevel: AuthorizationLevel.BASIC,
          email: input.email,
          emailVerifiedAt: new Date(),
          name: input.name,
          passwordHash: hashPassword(input.password),
          pendingRegistrationApproval: false,
          roleId: studentRole.id,
          status: UserStatus.ACTIVE,
          unifiedCode: input.unifiedCode,
        },
        include: { role: true },
      })

      await tx.emailVerificationCode.updateMany({
        where: {
          email: input.email,
          purpose: 'REGISTER',
          consumedAt: null,
        },
        data: { consumedAt: new Date() },
      })

      await tx.auditLog.create({
        data: {
          action: AuditAction.MANAGE_USER,
          actorId: created.id,
          ipAddress: meta.ipAddress,
          metadata: {
            action: 'self_register',
            unifiedCode: input.unifiedCode,
          },
          requestPath: meta.requestPath,
          result: 'success',
          targetId: created.id,
          targetType: 'User',
          userAgent: meta.userAgent,
        },
      })

      return created
    }) as User & { role: { code: string } }

    return this.completeLogin(user, meta)
  }

  async loginWithEmailCode(email: string, code: string, meta: ClientRequestMeta): Promise<LoginResponse> {
    const normalizedEmail = email.trim().toLowerCase()
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { role: true },
    })

    if (!user) {
      await this.writeLoginAudit(null, 'failed', meta)
      throw new UnauthorizedException('邮箱验证码错误或已过期')
    }

    const codeHash = createHash('sha256').update(code).digest('hex')
    const verificationCode = await this.prisma.emailVerificationCode.findFirst({
      where: {
        email: normalizedEmail,
        codeHash,
        consumedAt: null,
        expiresAt: {
          gt: new Date(),
        },
        purpose: 'LOGIN',
        userId: user.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    if (!verificationCode) {
      await this.writeLoginAudit(user.id, 'failed', meta)
      throw new UnauthorizedException('邮箱验证码错误或已过期')
    }

    await this.prisma.emailVerificationCode.update({
      where: { id: verificationCode.id },
      data: { consumedAt: new Date() },
    })

    return this.completeLogin(user, meta)
  }

  private async completeLogin(user: User & { role: { code: string } }, meta: ClientRequestMeta): Promise<LoginResponse> {
    if (user.status !== UserStatus.ACTIVE) {
      await this.writeLoginAudit(user.id, 'blocked', meta)
      throw new UnauthorizedException('账号当前不可登录')
    }

    const permissions = await this.rbac.getUserPermissionCodes(user.id)
    const refreshToken = randomBytes(48).toString('base64url')
    const refreshTokenHash = createHash('sha256').update(refreshToken).digest('hex')
    const refreshExpiresAt = new Date(getJwtExpiry(process.env.JWT_REFRESH_EXPIRES_IN, 7 * 24 * 60 * 60) * 1000)
    const loginAt = new Date()
    const unfamiliarAdminIp = user.role.code === RoleCode.ADMIN && meta.ipAddress
      ? await this.isUnfamiliarLoginIp(user.id, meta.ipAddress)
      : false
    const notificationIds: string[] = []

    await this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: refreshTokenHash,
          expiresAt: refreshExpiresAt,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        },
      })
      await tx.user.update({
        where: { id: user.id },
        data: { lastLoginAt: loginAt },
      })
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: AuditAction.LOGIN,
          targetType: 'User',
          targetId: user.id,
          result: 'success',
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
          requestPath: meta.requestPath,
        },
      })
      if (unfamiliarAdminIp) {
        notificationIds.push(await this.notifications.create(tx, {
          channelId: 'system', channelTitle: '管理员登录安全提醒',
          content: `检测到管理员账号于 ${formatSecurityTime(loginAt)} 从新 IP ${maskIp(meta.ipAddress)} 登录。如非本人操作，请立即修改密码并检查账号。`,
          emailRequired: true, entityId: `login:${loginAt.toISOString()}`, entityType: 'SecurityEvent',
          eventKey: `security:${user.id}:unfamiliar-login:${loginAt.toISOString()}`, iconType: 'bell',
          recipientId: user.id, route: '/admin/account-security',
        }))
      }
    })
    await this.notifications.dispatchAfterCommit(notificationIds)

    const accessToken = signJwt(
      {
        sub: user.id,
        role: user.role.code,
        type: 'access',
        exp: getJwtExpiry(process.env.JWT_ACCESS_EXPIRES_IN, 15 * 60),
      },
      process.env.JWT_ACCESS_SECRET ?? '',
    )

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        unifiedCode: user.unifiedCode,
        email: user.email,
        name: user.name,
        role: user.role.code as LoginResponse['user']['role'],
        status: user.status,
        permissions,
      },
    }
  }

  private async isUnfamiliarLoginIp(userId: string, ipAddress: string) {
    const [previousLogin, matchingLogin] = await Promise.all([
      this.prisma.auditLog.findFirst({
        where: { action: AuditAction.LOGIN, actorId: userId, ipAddress: { not: null }, result: 'success' },
        select: { id: true },
      }),
      this.prisma.auditLog.findFirst({
        where: { action: AuditAction.LOGIN, actorId: userId, ipAddress, result: 'success' },
        select: { id: true },
      }),
    ])
    return Boolean(previousLogin && !matchingLogin)
  }

  private async writeLoginAudit(actorId: string | null, result: string, meta: ClientRequestMeta) {
    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: AuditAction.LOGIN,
        targetType: 'Auth',
        result,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        requestPath: meta.requestPath,
      },
    })
  }

  private async assertEmailCodeRateLimit(
    email: string,
    purpose: string,
    meta: ClientRequestMeta,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const recentCode = await client.emailVerificationCode.findFirst({
      where: {
        createdAt: { gte: new Date(Date.now() - EMAIL_CODE_RESEND_INTERVAL_MS) },
        email,
        purpose,
      },
      orderBy: { createdAt: 'desc' },
    })

    if (recentCode) {
      throw new BadRequestException('验证码发送过于频繁，请稍后再试')
    }

    const windowStart = new Date(Date.now() - EMAIL_CODE_WINDOW_MS)
    const [emailCount, ipCount] = await Promise.all([
      client.emailVerificationCode.count({
        where: {
          createdAt: { gte: windowStart },
          email,
          purpose,
        },
      }),
      meta.ipAddress
        ? client.emailVerificationCode.count({
            where: {
              createdAt: { gte: windowStart },
              ipAddress: meta.ipAddress,
              purpose,
            },
          })
        : Promise.resolve(0),
    ])

    if (emailCount >= EMAIL_CODE_MAX_PER_WINDOW || ipCount >= EMAIL_CODE_MAX_PER_WINDOW * 3) {
      throw new BadRequestException('验证码请求次数过多，请稍后再试')
    }
  }

  private async assertRegisterCode(email: string, code: string) {
    const codeHash = createHash('sha256').update(code).digest('hex')
    const verificationCode = await this.prisma.emailVerificationCode.findFirst({
      where: {
        codeHash,
        consumedAt: null,
        email,
        expiresAt: {
          gt: new Date(),
        },
        purpose: 'REGISTER',
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!verificationCode) {
      throw new UnauthorizedException('邮箱验证码错误或已过期')
    }
  }

  private readonly passwordLoginFailures = new Map<string, { count: number; updatedAt: number }>()

  private getPasswordLoginFailureKey(unifiedCode: string, ipAddress?: string) {
    return `${unifiedCode}:${ipAddress || 'unknown'}`
  }

  private requiresPasswordLoginVerification(unifiedCode: string, ipAddress?: string) {
    const key = this.getPasswordLoginFailureKey(unifiedCode, ipAddress)
    const failure = this.passwordLoginFailures.get(key)
    if (!failure) return false
    if (Date.now() - failure.updatedAt > PASSWORD_LOGIN_FAILURE_WINDOW_MS) {
      this.passwordLoginFailures.delete(key)
      return false
    }
    return failure.count >= PASSWORD_LOGIN_HUMAN_VERIFICATION_THRESHOLD
  }

  private recordPasswordLoginFailure(unifiedCode: string, ipAddress?: string) {
    const key = this.getPasswordLoginFailureKey(unifiedCode, ipAddress)
    const current = this.passwordLoginFailures.get(key)
    if (!current || Date.now() - current.updatedAt > PASSWORD_LOGIN_FAILURE_WINDOW_MS) {
      this.passwordLoginFailures.set(key, { count: 1, updatedAt: Date.now() })
      return
    }
    this.passwordLoginFailures.set(key, { count: current.count + 1, updatedAt: Date.now() })
  }

  private clearPasswordLoginFailures(unifiedCode: string, ipAddress?: string) {
    this.passwordLoginFailures.delete(this.getPasswordLoginFailureKey(unifiedCode, ipAddress))
  }

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

function safeHashEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left, 'hex')
  const rightBuffer = Buffer.from(right, 'hex')
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

async function waitForPasswordResetResponse(startedAt: number) {
  if (process.env.NODE_ENV === 'test') return
  const remaining = PASSWORD_RESET_MIN_RESPONSE_MS - (Date.now() - startedAt)
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining))
}

function sanitizeResetEmailError(error: unknown) {
  return error instanceof Error ? error.name.slice(0, 80) : 'UnknownError'
}

function roleSecurityRoute(role: string) {
  if (role === RoleCode.ADMIN) return '/admin/account-security'
  if (role === RoleCode.AUDITOR) return '/auditor/profile'
  return '/user/account-security'
}

function generateEmailCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}
