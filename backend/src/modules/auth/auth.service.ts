import { BadRequestException, ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { AuditAction, AuthorizationLevel, RoleCode, User, UserStatus } from '@prisma/client'
import { randomBytes, createHash } from 'node:crypto'
import { getJwtExpiry, signJwt } from '../../common/crypto/jwt'
import { hashPassword, verifyPassword } from '../../common/crypto/password'
import { CaptchaService } from '../captcha/captcha.service'
import { PrismaService } from '../prisma/prisma.service'
import { RbacService } from '../rbac/rbac.service'
import { SchoolPolicyService } from '../school/school-policy.service'
import { ClientRequestMeta, LoginResponse } from './auth.types'
import { NormalizedRegisterInput } from './auth.validation'

const EMAIL_CODE_TTL_MS = 10 * 60 * 1000
const EMAIL_CODE_RESEND_INTERVAL_MS = 60 * 1000
const EMAIL_CODE_MAX_PER_WINDOW = 5
const EMAIL_CODE_WINDOW_MS = 10 * 60 * 1000

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(RbacService)
    private readonly rbac: RbacService,
    @Inject(CaptchaService)
    private readonly captcha: CaptchaService,
    @Inject(SchoolPolicyService)
    private readonly schoolPolicy: SchoolPolicyService,
  ) {}

  async loginWithPassword(unifiedCode: string, password: string, meta: ClientRequestMeta): Promise<LoginResponse> {
    const user = await this.prisma.user.findUnique({
      where: { unifiedCode },
      include: { role: true },
    })

    if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
      await this.writeLoginAudit(null, 'failed', meta)
      throw new UnauthorizedException('统一认证码或密码错误')
    }

    return this.completeLogin(user, meta)
  }

  async sendEmailLoginCode(email: string, captchaToken: string, meta: ClientRequestMeta) {
    const normalizedEmail = email.trim().toLowerCase()
    await this.captcha.consumeCaptchaToken(captchaToken, 'LOGIN_EMAIL_CODE', meta)

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

    const devCode = '123456'
    const codeHash = createHash('sha256').update(devCode).digest('hex')

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
      devCode: process.env.NODE_ENV === 'production' ? undefined : devCode,
    }
  }

  async sendRegisterEmailCode(email: string, captchaToken: string, meta: ClientRequestMeta) {
    const normalizedEmail = email.trim().toLowerCase()
    await this.captcha.consumeCaptchaToken(captchaToken, 'REGISTER_EMAIL_CODE', meta)
    await this.schoolPolicy.assertSchoolEmail(normalizedEmail)

    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    if (existingUser) {
      throw new ConflictException('该邮箱已注册，请直接登录')
    }

    const devCode = '123456'
    const codeHash = createHash('sha256').update(devCode).digest('hex')

    await this.prisma.emailVerificationCode.create({
      data: {
        email: normalizedEmail,
        codeHash,
        purpose: 'REGISTER',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    })

    return {
      message: `验证码已发送至 ${normalizedEmail}`,
      devCode: process.env.NODE_ENV === 'production' ? undefined : devCode,
    }
  }

  async register(input: NormalizedRegisterInput, meta: ClientRequestMeta): Promise<LoginResponse> {
    await this.schoolPolicy.assertSchoolEmail(input.email)
    await this.assertRegisterCode(input.email, input.code)

    const [existingCode, existingEmail, existingStudentNo, studentRole] = await Promise.all([
      this.prisma.user.findUnique({ where: { unifiedCode: input.unifiedCode } }),
      this.prisma.user.findUnique({ where: { email: input.email } }),
      input.studentNo ? this.prisma.user.findUnique({ where: { studentNo: input.studentNo } }) : Promise.resolve(null),
      this.prisma.role.findUnique({ where: { code: RoleCode.STUDENT } }),
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
    })

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

}
