import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import {
  AuditAction,
  PointDirection,
  ReviewDecision,
  VulnerabilitySeverity,
  VulnerabilityStatus,
} from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { AuthenticatedRequestUser, ClientRequestMeta } from '../auth/auth.types'
import {
  MyVulnerabilityListResponse,
  NormalizedCreateVulnerabilityInput,
  NormalizedReviewVulnerabilityInput,
  ReviewQueueResponse,
} from './vulnerability.types'

@Injectable()
export class VulnerabilitiesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listReviewQueue(): Promise<ReviewQueueResponse> {
    const reports = await this.prisma.vulnerabilityReport.findMany({
      where: {
        deletedAt: null,
        status: {
          not: VulnerabilityStatus.DRAFT,
        },
      },
      include: {
        attachments: {
          where: { deletedAt: null },
          orderBy: { uploadedAt: 'desc' },
          select: {
            id: true,
            originalName: true,
            sizeBytes: true,
            uploadedAt: true,
          },
        },
        events: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            action: true,
            createdAt: true,
            note: true,
          },
        },
        pointEntries: {
          select: {
            direction: true,
            points: true,
          },
        },
        submitter: {
          select: {
            email: true,
            name: true,
            unifiedCode: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    })

    const items = reports.map((report) => ({
      assetName: report.assetName,
      assetUrl: report.assetUrl,
      attachments: report.attachments,
      finalSeverity: report.finalSeverity ? formatSeverity(report.finalSeverity) : null,
      id: report.id,
      impactAssessment: report.impactAssessment,
      lastEvent: report.events[0] ?? null,
      ownerUnit: report.ownerUnit,
      points: sumPoints(report.pointEntries),
      repairSuggestion: report.repairSuggestion,
      reportNo: report.reportNo,
      requestPacket: report.requestPacket,
      reproductionSteps: report.reproductionSteps,
      selfSeverity: formatSeverity(report.selfSeverity),
      status: formatReviewStatus(report.status),
      submittedAt: report.submittedAt,
      submitter: report.submitter,
      testBoundary: report.testBoundary,
      title: report.title,
      updatedAt: report.updatedAt,
      vulnerabilityType: report.vulnerabilityType,
    }))

    return {
      items,
      stats: {
        confirmed: reports.filter((report) => isConfirmedStatus(report.status)).length,
        needSupplement: reports.filter((report) => report.status === VulnerabilityStatus.NEEDS_SUPPLEMENT).length,
        pendingReview: reports.filter((report) => report.status === VulnerabilityStatus.PENDING_REVIEW).length,
        submitted: reports.filter((report) => report.status === VulnerabilityStatus.SUBMITTED).length,
        total: reports.length,
      },
    }
  }

  async listMyReports(user: AuthenticatedRequestUser): Promise<MyVulnerabilityListResponse> {
    const reports = await this.prisma.vulnerabilityReport.findMany({
      where: {
        deletedAt: null,
        submitterId: user.id,
      },
      include: {
        attachments: {
          where: { deletedAt: null },
          orderBy: { uploadedAt: 'desc' },
          select: {
            id: true,
            originalName: true,
            sizeBytes: true,
            uploadedAt: true,
          },
        },
        events: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            action: true,
            createdAt: true,
            note: true,
          },
        },
        pointEntries: {
          select: {
            direction: true,
            points: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    })

    const items = reports.map((report) => ({
      assetName: report.assetName,
      attachments: report.attachments,
      finalSeverity: report.finalSeverity ? formatSeverity(report.finalSeverity) : null,
      id: report.id,
      lastEvent: report.events[0] ?? null,
      ownerUnit: report.ownerUnit,
      points: report.pointEntries.reduce((total, entry) => {
        if (entry.direction === PointDirection.OUT) return total - entry.points
        return total + entry.points
      }, 0),
      reportNo: report.reportNo,
      selfSeverity: formatSeverity(report.selfSeverity),
      status: formatStatus(report.status),
      submittedAt: report.submittedAt,
      title: report.title,
      updatedAt: report.updatedAt,
      vulnerabilityType: report.vulnerabilityType,
    }))

    return {
      items,
      stats: {
        confirmed: reports.filter((report) => isConfirmedStatus(report.status)).length,
        needSupplement: reports.filter((report) => report.status === VulnerabilityStatus.NEEDS_SUPPLEMENT).length,
        pending: reports.filter((report) => isPendingStatus(report.status)).length,
        total: reports.length,
      },
    }
  }

  async reviewReport(
    reportId: string,
    input: NormalizedReviewVulnerabilityInput,
    user: AuthenticatedRequestUser,
    meta: ClientRequestMeta,
  ) {
    const report = await this.prisma.vulnerabilityReport.findFirst({
      where: {
        deletedAt: null,
        id: reportId,
      },
      include: {
        submitter: {
          select: {
            id: true,
          },
        },
      },
    })

    if (!report) {
      throw new NotFoundException('漏洞报告不存在')
    }

    if (report.status === VulnerabilityStatus.DRAFT) {
      throw new BadRequestException('草稿状态不能审核')
    }

    const nextStatus = getNextStatus(input.decision)
    const finalSeverity = input.decision === ReviewDecision.CONFIRM ? input.finalSeverity : undefined
    const points = input.decision === ReviewDecision.CONFIRM ? input.points ?? defaultPoints(finalSeverity) : undefined
    const now = new Date()

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.vulnerabilityReport.update({
        where: { id: report.id },
        data: {
          confirmedAt: nextStatus === VulnerabilityStatus.CONFIRMED ? now : report.confirmedAt,
          finalSeverity,
          status: nextStatus,
        },
      })

      await tx.reviewAssignment.upsert({
        where: { reportId: report.id },
        create: {
          auditorId: user.id,
          closedAt: nextStatus === VulnerabilityStatus.CONFIRMED || nextStatus === VulnerabilityStatus.REJECTED ? now : null,
          reportId: report.id,
        },
        update: {
          auditorId: user.id,
          closedAt: nextStatus === VulnerabilityStatus.CONFIRMED || nextStatus === VulnerabilityStatus.REJECTED ? now : null,
        },
      })

      await tx.reviewComment.create({
        data: {
          authorId: user.id,
          content: input.note,
          decision: input.decision,
          reportId: report.id,
        },
      })

      if (points !== undefined && points > 0) {
        const currentBalance = await getCurrentPointBalance(tx, report.submitter.id)
        await tx.pointLedgerEntry.create({
          data: {
            balanceAfter: currentBalance + points,
            direction: PointDirection.IN,
            note: `漏洞 ${report.reportNo} 审核确认为 ${formatSeverity(finalSeverity ?? report.selfSeverity)}`,
            operatorId: user.id,
            points,
            reason: '漏洞审核奖励',
            reportId: report.id,
            userId: report.submitter.id,
          },
        })
      }

      await tx.vulnerabilityEvent.create({
        data: {
          action: `REVIEW_${input.decision}`,
          actorId: user.id,
          fromStatus: report.status,
          ipAddress: meta.ipAddress,
          note: input.note,
          reportId: report.id,
          toStatus: nextStatus,
          userAgent: meta.userAgent,
        },
      })

      await tx.auditLog.create({
        data: {
          action: AuditAction.REVIEW_VULNERABILITY,
          actorId: user.id,
          ipAddress: meta.ipAddress,
          metadata: {
            decision: input.decision,
            finalSeverity,
            points,
            reportNo: report.reportNo,
          },
          requestPath: meta.requestPath,
          result: 'success',
          targetId: report.id,
          targetType: 'VulnerabilityReport',
          userAgent: meta.userAgent,
        },
      })

      return next
    })

    return {
      finalSeverity: updated.finalSeverity ? formatSeverity(updated.finalSeverity) : null,
      id: updated.id,
      points: points ?? 0,
      reportNo: updated.reportNo,
      status: formatReviewStatus(updated.status),
      updatedAt: updated.updatedAt,
    }
  }

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

type PointEntryForSum = {
  direction: PointDirection
  points: number
}

function sumPoints(entries: PointEntryForSum[]) {
  return entries.reduce((total, entry) => {
    if (entry.direction === PointDirection.OUT) return total - entry.points
    return total + entry.points
  }, 0)
}

async function getCurrentPointBalance(
  tx: Pick<PrismaService, 'pointLedgerEntry'>,
  userId: string,
) {
  const latestEntry = await tx.pointLedgerEntry.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { balanceAfter: true },
  })

  return latestEntry?.balanceAfter ?? 0
}

function getNextStatus(decision: ReviewDecision) {
  if (decision === ReviewDecision.CONFIRM) return VulnerabilityStatus.CONFIRMED
  if (decision === ReviewDecision.NEEDS_SUPPLEMENT) return VulnerabilityStatus.NEEDS_SUPPLEMENT
  if (decision === ReviewDecision.REJECT) return VulnerabilityStatus.REJECTED
  throw new BadRequestException('暂不支持该审核结论')
}

function defaultPoints(severity: VulnerabilitySeverity | undefined) {
  if (severity === VulnerabilitySeverity.CRITICAL) return 800
  if (severity === VulnerabilitySeverity.HIGH) return 500
  if (severity === VulnerabilitySeverity.MEDIUM) return 260
  if (severity === VulnerabilitySeverity.LOW) return 80
  if (severity === VulnerabilitySeverity.INFO) return 20
  return 0
}

function formatSeverity(severity: VulnerabilitySeverity) {
  const labelMap: Record<VulnerabilitySeverity, string> = {
    CRITICAL: '严重',
    HIGH: '高危',
    INFO: '信息',
    LOW: '低危',
    MEDIUM: '中危',
  }

  return labelMap[severity]
}

function formatStatus(status: VulnerabilityStatus) {
  const labelMap: Record<VulnerabilityStatus, string> = {
    ARCHIVED: '已归档',
    CERTIFIED: '已归档',
    CONFIRMED: '已确认',
    DRAFT: '草稿',
    FIXING: '修复中',
    NEEDS_SUPPLEMENT: '待补充',
    PENDING_RETEST: '修复中',
    PENDING_REVIEW: '审核中',
    REJECTED: '已归档',
    SUBMITTED: '待审核',
  }

  return labelMap[status]
}

function formatReviewStatus(status: VulnerabilityStatus) {
  const labelMap: Record<VulnerabilityStatus, string> = {
    ARCHIVED: '已确认',
    CERTIFIED: '已确认',
    CONFIRMED: '已确认',
    DRAFT: '待初审',
    FIXING: '已确认',
    NEEDS_SUPPLEMENT: '待补充',
    PENDING_RETEST: '已确认',
    PENDING_REVIEW: '审核中',
    REJECTED: '已驳回',
    SUBMITTED: '待初审',
  }

  return labelMap[status]
}

function isConfirmedStatus(status: VulnerabilityStatus) {
  const statuses: VulnerabilityStatus[] = [
    VulnerabilityStatus.CONFIRMED,
    VulnerabilityStatus.FIXING,
    VulnerabilityStatus.PENDING_RETEST,
    VulnerabilityStatus.ARCHIVED,
    VulnerabilityStatus.CERTIFIED,
  ]

  return statuses.includes(status)
}

function isPendingStatus(status: VulnerabilityStatus) {
  const statuses: VulnerabilityStatus[] = [
    VulnerabilityStatus.SUBMITTED,
    VulnerabilityStatus.PENDING_REVIEW,
    VulnerabilityStatus.FIXING,
    VulnerabilityStatus.PENDING_RETEST,
  ]

  return statuses.includes(status)
}
