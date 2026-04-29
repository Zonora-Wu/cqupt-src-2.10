import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common'
import { AuditAction, VulnerabilityStatus } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { AuthenticatedRequestUser, ClientRequestMeta } from '../auth/auth.types'
import { NormalizedCreateVulnerabilityInput } from './vulnerability.types'

@Injectable()
export class VulnerabilitiesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async createSubmittedReport(
    user: AuthenticatedRequestUser,
    input: NormalizedCreateVulnerabilityInput,
    meta: ClientRequestMeta,
  ) {
    await this.assertCanSubmit(user.id)

    const now = new Date()
    const reportNo = await this.generateReportNo()

    const report = await this.prisma.$transaction(async (tx) => {
      const created = await tx.vulnerabilityReport.create({
        data: {
          reportNo,
          submitterId: user.id,
          title: input.title,
          assetName: input.assetName,
          assetUrl: input.assetUrl,
          ownerUnit: input.ownerUnit,
          vulnerabilityType: input.vulnerabilityType,
          selfSeverity: input.selfSeverity,
          status: VulnerabilityStatus.SUBMITTED,
          reproductionSteps: input.reproductionSteps,
          impactAssessment: input.impactAssessment,
          repairSuggestion: input.repairSuggestion,
          requestPacket: input.requestPacket,
          testBoundary: input.testBoundary,
          submittedAt: now,
        },
      })

      await tx.vulnerabilityEvent.create({
        data: {
          reportId: created.id,
          actorId: user.id,
          action: 'SUBMIT_VULNERABILITY',
          fromStatus: VulnerabilityStatus.DRAFT,
          toStatus: VulnerabilityStatus.SUBMITTED,
          note: '用户提交漏洞报告，等待审核员处理。',
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        },
      })

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: AuditAction.SUBMIT_VULNERABILITY,
          targetType: 'VulnerabilityReport',
          targetId: created.id,
          result: 'success',
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
          requestPath: meta.requestPath,
          metadata: {
            reportNo,
            selfSeverity: input.selfSeverity,
            vulnerabilityType: input.vulnerabilityType,
          },
        },
      })

      return created
    })

    return {
      id: report.id,
      reportNo: report.reportNo,
      status: report.status,
      submittedAt: report.submittedAt,
      title: report.title,
    }
  }

  private async assertCanSubmit(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        examAttempts: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        responsibilitySigns: {
          include: {
            agreement: true,
          },
          orderBy: { signedAt: 'desc' },
        },
      },
    })

    if (!user) {
      throw new ForbiddenException('用户不存在')
    }

    if (!user.emailVerifiedAt) {
      throw new ForbiddenException('请先完成邮箱验证')
    }

    const hasActiveAgreementSignature = user.responsibilitySigns.some((signature) => signature.agreement.active)
    if (!hasActiveAgreementSignature) {
      throw new ForbiddenException('请先签署当前版本责任书')
    }

    const examRequired = await this.isSecurityExamRequired()
    if (examRequired && !user.examAttempts.some((attempt) => attempt.passed)) {
      throw new ForbiddenException('请先通过安全准入考试')
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

    return false
  }

  private async generateReportNo() {
    for (let index = 0; index < 5; index += 1) {
      const now = new Date()
      const datePart = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0'),
      ].join('')
      const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase()
      const reportNo = `CQUPT-SRC-${datePart}-${randomPart}`
      const exists = await this.prisma.vulnerabilityReport.findUnique({ where: { reportNo } })

      if (!exists) {
        return reportNo
      }
    }

    throw new BadRequestException('报告编号生成失败，请稍后重试')
  }
}
