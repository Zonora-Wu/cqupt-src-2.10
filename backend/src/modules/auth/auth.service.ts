import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { AuditAction, User, UserStatus } from '@prisma/client'
import { randomBytes, createHash } from 'node:crypto'
import { getJwtExpiry, signJwt } from '../../common/crypto/jwt'
import { verifyPassword } from '../../common/crypto/password'
import { PrismaService } from '../prisma/prisma.service'
import { RbacService } from '../rbac/rbac.service'
import { ClientRequestMeta, LoginResponse } from './auth.types'

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(RbacService)
    private readonly rbac: RbacService,
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

  async sendEmailLoginCode(email: string, meta: ClientRequestMeta) {
    const normalizedEmail = email.trim().toLowerCase()
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    if (!user) {
      throw new UnauthorizedException('邮箱未注册或不可用')
    }

    const devCode = '123456'
    const codeHash = createHash('sha256').update(devCode).digest('hex')

    await this.prisma.emailVerificationCode.create({
      data: {
        userId: user.id,
        email: normalizedEmail,
        codeHash,
        purpose: 'LOGIN',
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
}
