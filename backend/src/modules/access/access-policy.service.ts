import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { createHash, randomBytes } from 'node:crypto'
import { AuditAction, RoleCode, UserStatus } from '@prisma/client'
import { AuthenticatedRequestUser, ClientRequestMeta } from '../auth/auth.types'
import { PrismaService } from '../prisma/prisma.service'
import { PublishResponsibilityAgreementInput, SignResponsibilityAgreementInput, SubmitSecurityExamInput } from './access.types'

@Injectable()
export class AccessPolicyService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async assertCanSubmitVulnerability(userId: string) {
    const status = await this.getAccessStatusByUserId(userId)

    if (!status.canSubmitVulnerability) {
      throw new ForbiddenException(status.missingRequirements[0] ?? '当前账号暂不可提交漏洞')
    }
  }

  async getAccessStatus(user: AuthenticatedRequestUser) {
    return this.getAccessStatusByUserId(user.id)
  }

  async getCurrentResponsibilityAgreement() {
    const agreement = await this.prisma.responsibilityAgreement.findFirst({
      where: { active: true },
      orderBy: { publishedAt: 'desc' },
    })

    if (!agreement) {
      return null
    }

    return {
      content: agreement.content,
      id: agreement.id,
      publishedAt: agreement.publishedAt,
      title: agreement.title,
      version: agreement.version,
    }
  }

  async publishResponsibilityAgreement(
    user: AuthenticatedRequestUser,
    input: PublishResponsibilityAgreementInput,
    meta: ClientRequestMeta,
  ) {
    const publishedAt = new Date()
    const version = `v${publishedAt.toISOString().slice(0, 10).replaceAll('-', '.')}-${randomBytes(3).toString('hex')}`
    const contentHash = createHash('sha256').update(`${input.title}\n${input.content}`).digest('hex')

    const agreement = await this.prisma.$transaction(async (tx) => {
      await tx.responsibilityAgreement.updateMany({
        data: { active: false },
        where: { active: true },
      })
      const created = await tx.responsibilityAgreement.create({
        data: {
          active: true,
          content: input.content,
          contentHash,
          publishedAt,
          title: input.title,
          version,
        },
      })
      await tx.auditLog.create({
        data: {
          action: AuditAction.CHANGE_SYSTEM_SETTING,
          actorId: user.id,
          ipAddress: meta.ipAddress,
          metadata: {
            action: 'publish_responsibility_agreement',
            contentHash,
            previousVersionsDeactivated: true,
            version,
          },
          requestPath: meta.requestPath,
          result: 'success',
          targetId: created.id,
          targetType: 'ResponsibilityAgreement',
          userAgent: meta.userAgent,
        },
      })
      return created
    })

    return {
      content: agreement.content,
      id: agreement.id,
      publishedAt: agreement.publishedAt,
      title: agreement.title,
      version: agreement.version,
    }
  }

  async signCurrentResponsibilityAgreement(
    user: AuthenticatedRequestUser,
    input: SignResponsibilityAgreementInput,
    meta: ClientRequestMeta,
  ) {
    const agreement = await this.prisma.responsibilityAgreement.findFirst({
      where: { active: true },
      orderBy: { publishedAt: 'desc' },
    })

    if (!agreement) {
      throw new NotFoundException('当前没有可签署的责任书')
    }

    const signature = await this.prisma.$transaction(async (tx) => {
      const signed = await tx.responsibilitySignature.upsert({
        where: {
          userId_agreementId: {
            agreementId: agreement.id,
            userId: user.id,
          },
        },
        create: {
          agreementId: agreement.id,
          deviceFingerprint: input.deviceFingerprint,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
          userId: user.id,
        },
        update: {
          deviceFingerprint: input.deviceFingerprint,
          ipAddress: meta.ipAddress,
          signedAt: new Date(),
          userAgent: meta.userAgent,
        },
      })

      await tx.auditLog.create({
        data: {
          action: AuditAction.MANAGE_USER,
          actorId: user.id,
          ipAddress: meta.ipAddress,
          metadata: {
            action: 'sign_responsibility_agreement',
            agreementId: agreement.id,
            deviceFingerprintProvided: Boolean(input.deviceFingerprint),
            version: agreement.version,
          },
          requestPath: meta.requestPath,
          result: 'success',
          targetId: signed.id,
          targetType: 'ResponsibilitySignature',
          userAgent: meta.userAgent,
        },
      })

      return signed
    })

    return {
      agreementId: agreement.id,
      signedAt: signature.signedAt,
      title: agreement.title,
      version: agreement.version,
    }
  }

  async submitSecurityExam(_user: AuthenticatedRequestUser, _input: SubmitSecurityExamInput, _meta: ClientRequestMeta) {
    throw new ForbiddenException('安全答题必须通过随机题卷提交，不能直接记录分数')
  }

  private async getAccessStatusByUserId(userId: string) {
    const [user, activeAgreement, examRequired, examThreshold] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          examAttempts: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
          responsibilitySigns: {
            include: { agreement: true },
            orderBy: { signedAt: 'desc' },
          },
          role: true,
        },
      }),
      this.prisma.responsibilityAgreement.findFirst({
        where: { active: true },
        orderBy: { publishedAt: 'desc' },
      }),
      this.isSecurityExamRequired(),
      this.getSecurityExamThreshold(),
    ])

    if (!user) {
      throw new ForbiddenException('用户不存在')
    }

    const roleAllowed = user.role.code === RoleCode.STUDENT
    const accountActive = user.status === UserStatus.ACTIVE
    const emailVerified = Boolean(user.emailVerifiedAt)
    const profileCompleted = isProfileComplete(user)
    const activeAgreementSignature = activeAgreement
      ? user.responsibilitySigns.find((signature) => signature.agreementId === activeAgreement.id)
      : null
    const securityExamPassed = user.examAttempts.some((attempt) => attempt.passed)
    const missingRequirements: string[] = []

    if (!roleAllowed) missingRequirements.push('仅学生用户可以提交漏洞')
    if (!accountActive) missingRequirements.push('账号当前不可用')
    if (!emailVerified) missingRequirements.push('请先完成邮箱验证')
    if (!profileCompleted) missingRequirements.push('请先完善学院、身份和学号信息')
    if (!activeAgreement) missingRequirements.push('平台尚未发布当前责任书')
    if (activeAgreement && !activeAgreementSignature) missingRequirements.push('请先签署当前版本责任书')
    if (examRequired && !securityExamPassed) missingRequirements.push('请先通过安全准入考试')

    return {
      activeAgreement: activeAgreement
        ? {
            id: activeAgreement.id,
            publishedAt: activeAgreement.publishedAt,
            signedAt: activeAgreementSignature?.signedAt ?? null,
            title: activeAgreement.title,
            version: activeAgreement.version,
          }
        : null,
      accountActive,
      authorizationLevel: user.authorizationLevel,
      canSubmitVulnerability: missingRequirements.length === 0,
      emailVerified,
      examThreshold,
      missingRequirements,
      profileCompleted,
      responsibilityAgreementRequired: true,
      responsibilitySigned: Boolean(activeAgreementSignature),
      role: user.role.code,
      roleAllowed,
      securityExamPassed,
      securityExamRequired: examRequired,
    }
  }

  private async isSecurityExamRequired() {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: 'security.exam.required' },
    })

    if (setting?.value === true) {
      return true
    }

    if (typeof setting?.value === 'object' && setting.value && 'enabled' in setting.value) {
      return Boolean((setting.value as { enabled?: unknown }).enabled)
    }

    return true
  }

  private async getSecurityExamThreshold() {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: 'security.exam.threshold' },
    })

    if (typeof setting?.value === 'number' && Number.isFinite(setting.value)) {
      return clampThreshold(setting.value)
    }

    if (typeof setting?.value === 'object' && setting.value && 'threshold' in setting.value) {
      return clampThreshold(Number((setting.value as { threshold?: unknown }).threshold))
    }

    return 80
  }
}

function clampThreshold(value: number) {
  if (!Number.isFinite(value)) return 80
  return Math.min(100, Math.max(0, Math.round(value)))
}

function isProfileComplete(user: { college: string | null; identityText: string | null; studentNo: string | null }) {
  const identityText = user.identityText?.trim() ?? ''
  return Boolean(user.college?.trim() && identityText && (isTeacherIdentity(identityText) || user.studentNo?.trim()))
}

function isTeacherIdentity(identityText: string) {
  return identityText === '教师' || identityText === '信息化办老师'
}
