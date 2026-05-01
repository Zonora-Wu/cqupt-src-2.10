import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import {
  AuditAction,
  PointDirection,
  ReviewDecision,
  VulnerabilitySeverity,
  VulnerabilityStatus,
} from '@prisma/client'
import { AccessPolicyService } from '../access/access-policy.service'
import { PrismaService } from '../prisma/prisma.service'
import { AuthenticatedRequestUser, ClientRequestMeta } from '../auth/auth.types'
import {
  AdminVulnerabilityDetailResponse,
  AdminVulnerabilityListResponse,
  MyVulnerabilityListResponse,
  NormalizedCreateVulnerabilityInput,
  NormalizedRetestInput,
  NormalizedReviewVulnerabilityInput,
  RetestQueueResponse,
  RetestResponse,
  ReviewQueueResponse,
} from './vulnerability.types'

@Injectable()
export class VulnerabilitiesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AccessPolicyService) private readonly accessPolicy: AccessPolicyService,
  ) {}

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

  async listRetestQueue(): Promise<RetestQueueResponse> {
    const statuses = [
      VulnerabilityStatus.FIXING,
      VulnerabilityStatus.PENDING_RETEST,
      VulnerabilityStatus.ARCHIVED,
    ]

    const reports = await this.prisma.vulnerabilityReport.findMany({
      where: {
        deletedAt: null,
        status: { in: statuses },
      },
      include: {
        submitter: { select: { name: true, email: true } },
        events: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { action: true, note: true },
        },
        retests: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { result: true, note: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })

    const items = reports.map((r) => {
      const lastRetest = r.retests[0]
      return {
        archivedAt: r.archivedAt,
        assetName: r.assetName,
        assetUrl: r.assetUrl,
        finalSeverity: r.finalSeverity ? formatSeverity(r.finalSeverity) : null,
        id: r.id,
        lastFixNote: r.events[0]?.note ?? null,
        lastRetestNote: lastRetest?.note ?? null,
        ownerUnit: r.ownerUnit,
        reportNo: r.reportNo,
        status: formatAdminStatus(r.status, true),
        submitter: { email: r.submitter.email, name: r.submitter.name },
        title: r.title,
        updatedAt: r.updatedAt,
      }
    })

    return {
      items,
      stats: {
        archived: reports.filter(
          (r) => r.status === VulnerabilityStatus.ARCHIVED,
        ).length,
        pendingRetest: reports.filter(
          (r) =>
            r.status === VulnerabilityStatus.FIXING ||
            r.status === VulnerabilityStatus.PENDING_RETEST,
        ).length,
      },
    }
  }

  async retestReport(
    reportId: string,
    input: NormalizedRetestInput,
    user: AuthenticatedRequestUser,
    meta: ClientRequestMeta,
  ): Promise<RetestResponse> {
    const allowedStatuses = [
      VulnerabilityStatus.FIXING,
      VulnerabilityStatus.PENDING_RETEST,
      VulnerabilityStatus.CONFIRMED,
    ]

    const report = await this.prisma.vulnerabilityReport.findFirst({
      where: { deletedAt: null, id: reportId },
    })

    if (!report) {
      throw new NotFoundException('漏洞报告不存在')
    }

    if (!allowedStatuses.includes(report.status as typeof allowedStatuses[number])) {
      throw new BadRequestException(
        `当前状态（${formatAdminStatus(report.status, true)}）不允许执行复测操作`,
      )
    }

    const nextStatus = getRetestNextStatus(input.decision, report.status)
    const now = new Date()

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.vulnerabilityReport.update({
        where: { id: report.id },
        data: {
          status: nextStatus,
          archivedAt: nextStatus === VulnerabilityStatus.ARCHIVED ? now : report.archivedAt,
        },
      })

      await tx.retestRecord.create({
        data: {
          reportId: report.id,
          testerId: user.id,
          result:
            input.decision === 'RETEST_PASS'
              ? ReviewDecision.RETEST_PASS
              : input.decision === 'RETURN_TO_FIX'
                ? ReviewDecision.RETURN_TO_FIX
                : ReviewDecision.ARCHIVE,
          note: input.note,
        },
      })

      await tx.vulnerabilityEvent.create({
        data: {
          action: input.decision,
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
          metadata: { decision: input.decision, reportNo: report.reportNo },
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
      id: updated.id,
      reportNo: updated.reportNo,
      status: formatAdminStatus(updated.status, true),
      updatedAt: updated.updatedAt,
    }
  }

  async markFixing(
    reportId: string,
    note: string,
    user: AuthenticatedRequestUser,
    meta: ClientRequestMeta,
  ): Promise<RetestResponse> {
    const report = await this.prisma.vulnerabilityReport.findFirst({
      where: { deletedAt: null, id: reportId },
    })

    if (!report) {
      throw new NotFoundException('漏洞报告不存在')
    }

    const allowedForFixing = [
      VulnerabilityStatus.CONFIRMED,
      VulnerabilityStatus.FIXING,
    ]

    if (!allowedForFixing.includes(report.status as typeof allowedForFixing[number])) {
      throw new BadRequestException(
        `当前状态（${formatAdminStatus(report.status, true)}）不可推入修复中`,
      )
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.vulnerabilityReport.update({
        where: { id: report.id },
        data: { status: VulnerabilityStatus.PENDING_RETEST },
      })

      await tx.vulnerabilityEvent.create({
        data: {
          action: 'MARK_PENDING_RETEST',
          actorId: user.id,
          fromStatus: report.status,
          ipAddress: meta.ipAddress,
          note,
          reportId: report.id,
          toStatus: VulnerabilityStatus.PENDING_RETEST,
          userAgent: meta.userAgent,
        },
      })

      await tx.auditLog.create({
        data: {
          action: AuditAction.REVIEW_VULNERABILITY,
          actorId: user.id,
          ipAddress: meta.ipAddress,
          metadata: { decision: 'MARK_PENDING_RETEST', reportNo: report.reportNo },
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
      id: updated.id,
      reportNo: updated.reportNo,
      status: formatAdminStatus(updated.status, true),
      updatedAt: updated.updatedAt,
    }
  }

  async createSubmittedReport(
    user: AuthenticatedRequestUser,
    input: NormalizedCreateVulnerabilityInput,
    meta: ClientRequestMeta,
  ) {
    await this.accessPolicy.assertCanSubmitVulnerability(user.id)

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

  async listAllVulnerabilities(): Promise<AdminVulnerabilityListResponse> {
    const reports = await this.prisma.vulnerabilityReport.findMany({
      where: { deletedAt: null, status: { not: VulnerabilityStatus.DRAFT } },
      include: {
        attachments: { where: { deletedAt: null }, select: { id: true } },
        events: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { action: true, createdAt: true, note: true },
        },
        pointEntries: { select: { direction: true, points: true } },
        submitter: { select: { id: true, email: true, name: true, unifiedCode: true } },
        assignment: {
          select: { auditor: { select: { id: true, email: true, name: true } } },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 500,
    })

    const items = reports.map((report) => ({
      id: report.id,
      reportNo: report.reportNo,
      title: report.title,
      selfSeverity: formatSeverity(report.selfSeverity),
      finalSeverity: report.finalSeverity ? formatSeverity(report.finalSeverity) : null,
      status: formatAdminStatus(report.status, !!report.assignment),
      assetName: report.assetName,
      ownerUnit: report.ownerUnit,
      submitterName: report.submitter.name,
      reviewerName: report.assignment?.auditor.name ?? null,
      points: sumPoints(report.pointEntries),
      submittedAt: report.submittedAt,
      updatedAt: report.updatedAt,
      attachmentCount: report.attachments.length,
      lastEvent: report.events[0] ?? null,
    }))

    return {
      items,
      stats: {
        total: reports.length,
        submitted: reports.filter((r) => r.status === VulnerabilityStatus.SUBMITTED).length,
        pendingReview: reports.filter((r) => r.status === VulnerabilityStatus.PENDING_REVIEW).length,
        needSupplement: reports.filter((r) => r.status === VulnerabilityStatus.NEEDS_SUPPLEMENT).length,
        confirmed: reports.filter((r) => r.status === VulnerabilityStatus.CONFIRMED).length,
        fixing: reports.filter((r) => r.status === VulnerabilityStatus.FIXING).length,
        pendingRetest: reports.filter((r) => r.status === VulnerabilityStatus.PENDING_RETEST).length,
        rejected: reports.filter((r) => r.status === VulnerabilityStatus.REJECTED).length,
        archived: reports.filter(
          (r) => r.status === VulnerabilityStatus.ARCHIVED || r.status === VulnerabilityStatus.CERTIFIED,
        ).length,
      },
    }
  }

  async getVulnerabilityById(reportId: string): Promise<AdminVulnerabilityDetailResponse> {
    const report = await this.prisma.vulnerabilityReport.findFirst({
      where: { deletedAt: null, id: reportId },
      include: {
        attachments: {
          where: { deletedAt: null },
          orderBy: { uploadedAt: 'desc' },
          select: { id: true, originalName: true, sizeBytes: true, uploadedAt: true },
        },
        events: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            action: true,
            actor: { select: { id: true, name: true } },
            fromStatus: true,
            toStatus: true,
            note: true,
            createdAt: true,
          },
        },
        pointEntries: { select: { direction: true, points: true } },
        submitter: { select: { id: true, email: true, name: true, unifiedCode: true } },
        assignment: {
          select: { auditor: { select: { id: true, email: true, name: true } } },
        },
      },
    })

    if (!report) {
      throw new NotFoundException('漏洞报告不存在')
    }

    return {
      id: report.id,
      reportNo: report.reportNo,
      title: report.title,
      selfSeverity: formatSeverity(report.selfSeverity),
      finalSeverity: report.finalSeverity ? formatSeverity(report.finalSeverity) : null,
      status: formatAdminStatus(report.status, !!report.assignment),
      assetName: report.assetName,
      assetUrl: report.assetUrl,
      ownerUnit: report.ownerUnit,
      vulnerabilityType: report.vulnerabilityType,
      reproductionSteps: report.reproductionSteps,
      impactAssessment: report.impactAssessment,
      repairSuggestion: report.repairSuggestion,
      requestPacket: report.requestPacket,
      testBoundary: report.testBoundary,
      submitter: report.submitter,
      reviewer: report.assignment?.auditor ?? null,
      points: sumPoints(report.pointEntries),
      submittedAt: report.submittedAt,
      confirmedAt: report.confirmedAt,
      updatedAt: report.updatedAt,
      attachments: report.attachments,
      events: report.events.map((event) => ({
        id: event.id,
        action: formatEventAction(event.action),
        actorName: event.actor?.name ?? null,
        fromStatus: event.fromStatus ? formatAdminStatus(event.fromStatus, false) : null,
        toStatus: event.toStatus ? formatAdminStatus(event.toStatus, false) : null,
        note: event.note,
        createdAt: event.createdAt,
      })),
    }
  }

  private async generateReportNo() {
    for (let i = 0; i < 5; i++) {
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

function getRetestNextStatus(decision: NormalizedRetestInput['decision'], currentStatus: VulnerabilityStatus) {
  if (decision === 'ARCHIVE') return VulnerabilityStatus.ARCHIVED
  if (decision === 'RETEST_PASS') return VulnerabilityStatus.ARCHIVED
  if (decision === 'RETURN_TO_FIX') return VulnerabilityStatus.FIXING
  throw new BadRequestException('不支持的复测结论')

  // suppress TS unreachable warning
  void currentStatus
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

function formatAdminStatus(status: VulnerabilityStatus, hasAssignment: boolean): string {
  const statusMap: Record<VulnerabilityStatus, string> = {
    DRAFT: '草稿',
    SUBMITTED: hasAssignment ? '待审核' : '待分派',
    PENDING_REVIEW: '审核中',
    NEEDS_SUPPLEMENT: '待补充',
    CONFIRMED: '已确认',
    FIXING: '修复中',
    PENDING_RETEST: '待复测',
    ARCHIVED: '已归档',
    CERTIFIED: '已归档',
    REJECTED: '已驳回',
  }

  return statusMap[status]
}

function formatEventAction(action: string): string {
  const actionMap: Record<string, string> = {
    SUBMIT_VULNERABILITY: '提交报告',
    REVIEW_CONFIRM: '审核确认',
    REVIEW_NEEDS_SUPPLEMENT: '要求补充材料',
    REVIEW_REJECT: '驳回报告',
    RETEST_PASS: '复测通过',
    RETEST_FAIL: '复测未通过',
    ARCHIVE: '归档',
    ASSIGN_REVIEWER: '分派审核员',
    CLOSE: '关闭',
  }

  return actionMap[action] ?? action
}
