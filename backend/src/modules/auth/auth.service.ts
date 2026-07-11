import { BadRequestException, ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { AuditAction, AuthorizationLevel, RoleCode, User, UserStatus } from '@prisma/client'

export type PendingRegistrationResponse = { pending: true; message: string }
import { randomBytes, createHash, randomInt } from 'node:crypto'
import { getJwtExpiry, signJwt } from '../../common/crypto/jwt'
import { hashPassword, verifyPassword } from '../../common/crypto/password'
import { EmailService } from '../email/email.service'
import { HumanVerificationService } from '../human-verification/human-verification.service'
import { HumanVerificationInput } from '../human-verification/human-verification.types'
import { PrismaService } from '../prisma/prisma.service'
import { RbacService } from '../rbac/rbac.service'
import { ClientRequestMeta, LoginResponse } from './auth.types'
import { NormalizedRegisterInput } from './auth.validation'

const EMAIL_CODE_TTL_MS = 10 * 60 * 1000
const EMAIL_CODE_RESEND_INTERVAL_MS = 60 * 1000
const EMAIL_CODE_MAX_PER_WINDOW = 5
const EMAIL_CODE_WINDOW_MS = 10 * 60 * 1000
const PASSWORD_LOGIN_HUMAN_VERIFICATION_THRESHOLD = 3
const PASSWORD_LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000

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

  async register(input: NormalizedRegisterInput, meta: ClientRequestMeta): Promise<LoginResponse | PendingRegistrationResponse> {
    await this.humanVerification.verify(input.humanVerification, 'REGISTER_SUBMIT', meta)
    await this.assertRegisterCode(input.email, input.code)

    const [existingCode, existingEmail, existingStudentNo, studentRole, registrationSetting] = await Promise.all([
      this.prisma.user.findUnique({ where: { unifiedCode: input.unifiedCode } }),
      this.prisma.user.findUnique({ where: { email: input.email } }),
      input.studentNo ? this.prisma.user.findUnique({ where: { studentNo: input.studentNo } }) : Promise.resolve(null),
      this.prisma.role.findUnique({ where: { code: RoleCode.STUDENT } }),
      this.prisma.systemSetting.findUnique({ where: { key: 'open_registration' } }),
    ])

    if (existingCode) {
      throw new ConflictException('统一认证码已注册')
    }

    if (existingEmail) {
      throw new ConflictException('邮箱已注册')
    }

    if (existingStudentNo) {
      throw new ConflictException('学号已注册')
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
            college: input.college,
            email: input.email,
            emailVerifiedAt: new Date(),
            grade: input.grade || null,
            identityText: input.identityText,
            name: input.name,
            passwordHash: hashPassword(input.password),
            pendingRegistrationApproval: true,
            roleId: studentRole.id,
            status: UserStatus.PENDING,
            studentNo: input.studentNo || null,
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
              college: input.college,
              email: input.email,
              identityText: input.identityText,
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
          college: input.college,
          email: input.email,
          emailVerifiedAt: new Date(),
          grade: input.grade || null,
          identityText: input.identityText,
          name: input.name,
          passwordHash: hashPassword(input.password),
          pendingRegistrationApproval: false,
          roleId: studentRole.id,
          status: UserStatus.ACTIVE,
          studentNo: input.studentNo || null,
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
            college: input.college,
            identityText: input.identityText,
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

    await this.prisma.$transaction([
      this.prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: refreshTokenHash,
          expiresAt: refreshExpiresAt,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      }),
      this.prisma.auditLog.create({
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
      }),
    ])

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

  private async assertEmailCodeRateLimit(email: string, purpose: string, meta: ClientRequestMeta) {
    const recentCode = await this.prisma.emailVerificationCode.findFirst({
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
      this.prisma.emailVerificationCode.count({
        where: {
          createdAt: { gte: windowStart },
          email,
          purpose,
        },
      }),
      meta.ipAddress
        ? this.prisma.emailVerificationCode.count({
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

function generateEmailCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}
