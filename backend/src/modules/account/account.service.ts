import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common'
import { AuditAction, VulnerabilityStatus } from '@prisma/client'
import { createHash } from 'node:crypto'
import { hashPassword, verifyPassword } from '../../common/crypto/password'
import { AuthenticatedRequestUser, ClientRequestMeta } from '../auth/auth.types'
import { PrismaService } from '../prisma/prisma.service'
import { SchoolPolicyService } from '../school/school-policy.service'
import { ChangeEmailInput, ChangePasswordInput, SendChangeEmailCodeInput } from './account.types'

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
    }
  }

  async changePassword(user: AuthenticatedRequestUser, input: ChangePasswordInput, meta: ClientRequestMeta) {
    const profile = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        passwordHash: true,
      },
    })

    if (!profile?.passwordHash || !verifyPassword(input.oldPassword, profile.passwordHash)) {
      throw new UnauthorizedException('原密码错误')
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

  async sendChangeEmailCode(user: AuthenticatedRequestUser, input: SendChangeEmailCodeInput, meta: ClientRequestMeta) {
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

    const devCode = '123456'
    const codeHash = createHash('sha256').update(devCode).digest('hex')

    await this.prisma.emailVerificationCode.create({
      data: {
        codeHash,
        email: input.newEmail,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        ipAddress: meta.ipAddress,
        purpose: 'CHANGE_EMAIL',
        userAgent: meta.userAgent,
        userId: user.id,
      },
    })

    return {
      devCode: process.env.NODE_ENV === 'production' ? undefined : devCode,
      message: `验证码已发送至 ${input.newEmail}`,
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
        email: input.newEmail,
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
}

function maskEmail(email: string) {
  const [name, domain] = email.split('@')
  if (!name || !domain) return '***'
  const prefix = name.slice(0, 2)
  return `${prefix}${'*'.repeat(Math.max(3, name.length - 2))}@${domain}`
}
