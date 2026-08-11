import { Inject, Injectable } from '@nestjs/common'
import {
  AiCallPurpose,
  AiSpace,
  AnnouncementStatus,
  AuditAction,
  CertificateStatus,
  LearningResourceKind,
  MallProductStatus,
  MallRedemptionStatus,
  Prisma,
  RoleCode,
  UserStatus,
  VulnerabilitySeverity,
  VulnerabilityStatus,
} from '@prisma/client'
import { AuthenticatedRequestUser } from '../auth/auth.types'
import { getAuditRiskLevel, mapAuditLogItem } from '../audit-logs/audit-log-mapper'
import { PrismaService } from '../prisma/prisma.service'

const ADMIN_DASHBOARD_AI_SETTING_KEY = 'admin_dashboard_ai_insight'
const DEFAULT_OPENAI_BASE_URL = 'http://localhost:5000/v1'
const DEFAULT_OPENAI_MODEL = 'hermes-agent'
const DEFAULT_OPENAI_TIMEOUT_MS = 120_000

// ---- 用户仪表盘 ----
export type UserDashboardStats = {
  certCount: number
  confirmedCount: number
  currentPoints: number
  progress: {
    latestReport: {
      id: string
      reportNo: string
      status: VulnerabilityStatus
      statusLabel: string
      title: string
      updatedAt: Date
    } | null
    nextAction: {
      description: string
      label: string
      route: string
    }
    requiredActionCount: number
    supplementCount: number
  }
  submitCount: number
}

function buildUserDashboardNextAction(
  latestSupplementReport: { id: string; reportNo: string; title: string } | null,
  latestReport: { id: string; reportNo: string; status: VulnerabilityStatus; title: string } | null,
) {
  if (latestSupplementReport) {
    return {
      description: `${latestSupplementReport.reportNo} 等待补充材料`,
      label: '补充漏洞材料',
      route: `/user/vulnerabilities?reportId=${encodeURIComponent(latestSupplementReport.id)}`,
    }
  }

  if (
    latestReport
    && latestReport.status !== VulnerabilityStatus.ARCHIVED
    && latestReport.status !== VulnerabilityStatus.CERTIFIED
    && latestReport.status !== VulnerabilityStatus.REJECTED
  ) {
    return {
      description: `${latestReport.reportNo} 当前${formatUserDashboardStatus(latestReport.status)}`,
      label: '查看最新进展',
      route: `/user/vulnerabilities?reportId=${encodeURIComponent(latestReport.id)}`,
    }
  }

  return {
    description: latestReport ? '当前没有需要处理的漏洞' : '提交后可在首页跟踪审核进度',
    label: '提交新漏洞',
    route: '/user/submit',
  }
}

function formatUserDashboardStatus(status: VulnerabilityStatus) {
  const labels: Record<VulnerabilityStatus, string> = {
    ARCHIVED: '已归档',
    CERTIFIED: '已签发证书',
    CONFIRMED: '已确认',
    DRAFT: '草稿',
    FIXING: '修复中',
    NEEDS_SUPPLEMENT: '待补充',
    PENDING_RETEST: '待复测',
    PENDING_REVIEW: '审核中',
    REJECTED: '已驳回',
    SUBMITTED: '待审核',
  }
  return labels[status]
}

export type UserDashboardAiInsight = {
  findings: string[]
  generatedAt: string
  model: string
  source: 'hermes'
  summary: string
}

// ---- 审核员仪表盘 ----
export type AuditorDashboardStats = {
  pendingArchive: number
  pendingCerts: number
  pendingInitReview: number
  pendingRetest: number
  priorityReports: Array<{
    assetName: string
    id: string
    ownerUnit: string | null
    reportNo: string
    severity: string
    status: string
    title: string
    updatedAt: Date
  }>
  recentActions: Array<{
    actionLabel: string
    createdAt: Date
    id: string
    resultLabel: string
    summary: string
    targetLabel: string
  }>
}

export type AdminDashboardAiInsight = {
  actions: Array<{
    label: string
    owner: string
    priority: 'high' | 'medium' | 'low'
  }>
  findings: string[]
  generatedAt: string
  model: string
  recommendations: string[]
  riskLevel: 'high' | 'medium' | 'low'
  source: 'hermes' | 'heuristic'
  status: 'fresh' | 'degraded'
  summary: string
}

export type AdminDashboardStats = {
  activityTrend: Array<{
    aiCalls: number
    date: string
    learning: number
    logins: number
    vulnerabilities: number
  }>
  aiInsight: AdminDashboardAiInsight
  operations: Array<{
    count: number
    label: string
    route: string
    severity: 'high' | 'medium' | 'low'
    title: string
  }>
  overview: {
    aiCalls: number
    auditToday: number
    completedRedemptions: number
    highRiskAudit: number
    highRiskVulnerabilities: number
    issuedCerts: number
    newUsers: number
    pendingAccessUsers: number
    pendingCerts: number
    pendingRedemptions: number
    pendingRetest: number
    pendingVulnerabilities: number
    totalActiveUsers: number
    totalVulnerabilities: number
  }
  pendingAccessUsers: number
  pendingCerts: number
  pendingRedemptions: number
  pendingVulnerabilities: number
  period: {
    end: string
    key: '7d'
    label: string
    start: string
  }
  platform: {
    activeAnnouncements: number
    activeLearningResources: number
    activeMallProducts: number
    learningRanges: number
  }
  recentVulnerabilities: Array<{
    assetName: string
    id: string
    ownerUnit: string | null
    reportNo: string
    reviewerName: string | null
    severity: string
    status: string
    submittedAt: string | null
    submitterName: string
    title: string
    updatedAt: string
  }>
  recentAuditLogs: ReturnType<typeof mapAuditLogItem>[]
  severityDistribution: Array<{
    count: number
    label: string
    level: 'critical' | 'high' | 'medium' | 'low' | 'info'
  }>
  totalActiveUsers: number
  totalVulnerabilities: number
  vulnerabilityFlow: Array<{
    count: number
    label: string
    status: string
  }>
}

export type RequestMeta = {
  ipAddress?: string
  userAgent?: string
}

type DashboardSnapshot = Awaited<ReturnType<DashboardService['buildAdminDashboardSnapshot']>>

@Injectable()
export class DashboardService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getUserDashboard(user: AuthenticatedRequestUser): Promise<UserDashboardStats> {
    const [submitCount, confirmedCount, certCount, supplementCount, latestReport, latestSupplementReport] = await Promise.all([
      this.prisma.vulnerabilityReport.count({
        where: {
          deletedAt: null,
          submitterId: user.id,
          status: { notIn: [VulnerabilityStatus.DRAFT] },
        },
      }),
      this.prisma.vulnerabilityReport.count({
        where: {
          deletedAt: null,
          submitterId: user.id,
          status: {
            in: [
              VulnerabilityStatus.CONFIRMED,
              VulnerabilityStatus.FIXING,
              VulnerabilityStatus.PENDING_RETEST,
              VulnerabilityStatus.ARCHIVED,
              VulnerabilityStatus.CERTIFIED,
            ],
          },
        },
      }),
      this.prisma.certificate.count({
        where: {
          recipientId: user.id,
          status: { in: [CertificateStatus.ISSUED] },
        },
      }),
      this.prisma.vulnerabilityReport.count({
        where: {
          deletedAt: null,
          status: VulnerabilityStatus.NEEDS_SUPPLEMENT,
          submitterId: user.id,
        },
      }),
      this.prisma.vulnerabilityReport.findFirst({
        where: {
          deletedAt: null,
          status: { not: VulnerabilityStatus.DRAFT },
          submitterId: user.id,
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        select: { id: true, reportNo: true, status: true, title: true, updatedAt: true },
      }),
      this.prisma.vulnerabilityReport.findFirst({
        where: {
          deletedAt: null,
          status: VulnerabilityStatus.NEEDS_SUPPLEMENT,
          submitterId: user.id,
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        select: { id: true, reportNo: true, title: true },
      }),
    ])

    const latestEntry = await this.prisma.pointLedgerEntry.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: { balanceAfter: true },
    })

    return {
      certCount,
      confirmedCount,
      currentPoints: latestEntry?.balanceAfter ?? 0,
      progress: {
        latestReport: latestReport ? {
          ...latestReport,
          statusLabel: formatUserDashboardStatus(latestReport.status),
        } : null,
        nextAction: buildUserDashboardNextAction(latestSupplementReport, latestReport),
        requiredActionCount: supplementCount,
        supplementCount,
      },
      submitCount,
    }
  }

  async refreshUserDashboardAiInsight(user: AuthenticatedRequestUser, meta: RequestMeta = {}): Promise<UserDashboardAiInsight> {
    const snapshot = await this.buildUserDashboardAiSnapshot(user.id)
    const startedAt = Date.now()
    const insight = await this.requestHermesUserDashboardInsight(snapshot)

    await Promise.all([
      this.prisma.aiCallLog.create({
        data: {
          aiSpace: AiSpace.STUDENT,
          ipAddress: meta.ipAddress,
          modelName: insight.model,
          outputSummary: insight.summary,
          purpose: AiCallPurpose.AUDIT_ANALYSIS,
          sanitizedInputSummary: JSON.stringify(snapshot),
          userAgent: meta.userAgent,
          userId: user.id,
        },
      }),
      this.prisma.auditLog.create({
        data: {
          action: AuditAction.CALL_AI,
          actorId: user.id,
          ipAddress: meta.ipAddress,
          metadata: { dataScope: '30d aggregated vulnerability status and point totals only', durationMs: Date.now() - startedAt, model: insight.model },
          requestPath: '/dashboard/user/ai-insight/run',
          result: 'success',
          targetType: 'USER_DASHBOARD_AI_INSIGHT',
          userAgent: meta.userAgent,
        },
      }),
    ])

    return insight
  }

  private async buildUserDashboardAiSnapshot(userId: string) {
    const periodEnd = new Date()
    const periodStart = startOfDay(addDays(periodEnd, -29))
    const reportWhere = { deletedAt: null, submitterId: userId, submittedAt: { gte: periodStart, lte: periodEnd } }
    const [reportStatuses, latestPoints, earned, redeemed] = await Promise.all([
      this.prisma.vulnerabilityReport.groupBy({ by: ['status'], _count: { _all: true }, where: reportWhere }),
      this.prisma.pointLedgerEntry.findFirst({ orderBy: { createdAt: 'desc' }, select: { balanceAfter: true }, where: { userId } }),
      this.prisma.pointLedgerEntry.aggregate({ _sum: { points: true }, where: { createdAt: { gte: periodStart, lte: periodEnd }, direction: 'IN', userId } }),
      this.prisma.pointLedgerEntry.aggregate({ _sum: { points: true }, where: { createdAt: { gte: periodStart, lte: periodEnd }, direction: 'OUT', userId } }),
    ])

    const statusCounts = Object.fromEntries(reportStatuses.map((item) => [item.status, item._count._all]))
    return {
      period: { end: periodEnd.toISOString(), label: '近 30 天', start: periodStart.toISOString() },
      points: {
        currentBalance: latestPoints?.balanceAfter ?? 0,
        earnedInPeriod: earned._sum.points ?? 0,
        redeemedInPeriod: Math.abs(redeemed._sum.points ?? 0),
      },
      vulnerability: {
        confirmedCount: sumStatusCounts(statusCounts, [VulnerabilityStatus.CONFIRMED, VulnerabilityStatus.FIXING, VulnerabilityStatus.PENDING_RETEST, VulnerabilityStatus.ARCHIVED, VulnerabilityStatus.CERTIFIED]),
        pendingSupplementCount: statusCounts[VulnerabilityStatus.NEEDS_SUPPLEMENT] ?? 0,
        reviewingCount: sumStatusCounts(statusCounts, [VulnerabilityStatus.SUBMITTED, VulnerabilityStatus.PENDING_REVIEW]),
        submittedCount: reportStatuses.reduce((total, item) => total + item._count._all, 0),
      },
    }
  }

  private async requestHermesUserDashboardInsight(snapshot: Awaited<ReturnType<DashboardService['buildUserDashboardAiSnapshot']>>): Promise<UserDashboardAiInsight> {
    const apiKey = getOpenAiApiKey()
    if (!apiKey) throw new Error('Hermes API key not configured')

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), getRequestTimeoutMs())
    try {
      const response = await fetch(new URL('chat/completions', getOpenAiBaseUrl()), {
        body: JSON.stringify({
          messages: [
            { content: '你是高校 SRC 平台的个人安全实践分析助手。只返回严格 JSON，不要 Markdown。只使用输入聚合数据，不推断身份、能力、排名或敏感属性；不编造漏洞细节。字段：summary,findings。summary 80 字以内；findings 为 1 到 3 条客观分析，每条 80 字以内。', role: 'system' },
            { content: JSON.stringify(snapshot), role: 'user' },
          ],
          model: getOpenAiModel(),
          temperature: 0.2,
        }),
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        method: 'POST',
        signal: controller.signal,
      })
      if (!response.ok) throw new Error(`Hermes request failed: ${response.status}`)
      const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }>; model?: string }
      const value = parseJsonObject(payload.choices?.[0]?.message?.content ?? '')
      const record = value as Record<string, unknown> | null
      if (!record || typeof record.summary !== 'string' || !record.summary.trim()) throw new Error('Hermes 返回内容无法解析')
      const findings = Array.isArray(record.findings)
        ? record.findings.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim().slice(0, 80)).slice(0, 3)
        : []
      return { findings, generatedAt: new Date().toISOString(), model: payload.model ?? getOpenAiModel(), source: 'hermes', summary: record.summary.trim().slice(0, 80) }
    } finally {
      clearTimeout(timeout)
    }
  }

  async getAuditorDashboard(user: AuthenticatedRequestUser): Promise<AuditorDashboardStats> {
    const [pendingInitReview, pendingRetest, pendingArchiveGroup, pendingCerts, priorityReports, recentActions] = await Promise.all([
      this.prisma.vulnerabilityReport.count({
        where: {
          deletedAt: null,
          status: {
            in: [VulnerabilityStatus.SUBMITTED, VulnerabilityStatus.PENDING_REVIEW],
          },
        },
      }),
      this.prisma.vulnerabilityReport.count({
        where: {
          deletedAt: null,
          status: VulnerabilityStatus.PENDING_RETEST,
        },
      }),
      this.prisma.vulnerabilityReport.count({
        where: {
          deletedAt: null,
          status: {
            in: [VulnerabilityStatus.CONFIRMED, VulnerabilityStatus.FIXING],
          },
        },
      }),
      this.prisma.vulnerabilityReport.count({
        where: {
          deletedAt: null,
          status: { in: [VulnerabilityStatus.ARCHIVED] },
          certificate: {
            is: null,
          },
        },
      }),
      this.prisma.vulnerabilityReport.findMany({
        where: {
          deletedAt: null,
          status: { in: [VulnerabilityStatus.SUBMITTED, VulnerabilityStatus.PENDING_REVIEW] },
        },
        orderBy: [{ submittedAt: 'asc' }, { updatedAt: 'asc' }],
        select: {
          assetName: true,
          id: true,
          ownerUnit: true,
          reportNo: true,
          selfSeverity: true,
          status: true,
          title: true,
          updatedAt: true,
        },
        take: 3,
      }),
      this.prisma.auditLog.findMany({
        where: {
          actorId: user.id,
          action: {
            in: [
              AuditAction.REVIEW_VULNERABILITY,
              AuditAction.CHANGE_VULNERABILITY_STATUS,
              AuditAction.ISSUE_CERTIFICATE,
              AuditAction.REVOKE_CERTIFICATE,
              AuditAction.VIEW_SENSITIVE_ATTACHMENT,
            ],
          },
        },
        include: { actor: { include: { role: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ])

    return {
      pendingArchive: pendingArchiveGroup,
      pendingCerts,
      pendingInitReview,
      pendingRetest,
      priorityReports: priorityReports.map((report) => ({
        assetName: report.assetName,
        id: report.id,
        ownerUnit: report.ownerUnit,
        reportNo: report.reportNo,
        severity: report.selfSeverity,
        status: report.status,
        title: report.title,
        updatedAt: report.updatedAt,
      })),
      recentActions: recentActions.map((action) => {
        const mapped = mapAuditLogItem(action)
        return {
          actionLabel: mapped.actionLabel,
          createdAt: mapped.createdAt,
          id: mapped.id,
          resultLabel: mapped.resultLabel,
          summary: mapped.summary,
          targetLabel: mapped.targetLabel,
        }
      }),
    }
  }

  async getAdminDashboard(): Promise<AdminDashboardStats> {
    const snapshot = await this.buildAdminDashboardSnapshot()
    const aiInsight = await this.getStoredAiInsight(snapshot)
    return this.toAdminDashboardStats(snapshot, aiInsight)
  }

  async refreshAdminDashboardAiInsight(
    user: AuthenticatedRequestUser,
    meta: RequestMeta = {},
  ): Promise<AdminDashboardAiInsight> {
    const snapshot = await this.buildAdminDashboardSnapshot()
    const model = getOpenAiModel()
    const startedAt = Date.now()
    let insight: AdminDashboardAiInsight
    let result = 'success'

    try {
      insight = await this.requestHermesDashboardInsight(snapshot)
    } catch (error) {
      result = 'degraded'
      insight = buildFallbackInsight(snapshot, getErrorMessage(error))
    }

    await Promise.all([
      this.prisma.systemSetting.upsert({
        create: {
          description: '管理员首页 Hermes 平台分析结果',
          key: ADMIN_DASHBOARD_AI_SETTING_KEY,
          updatedById: user.id,
          value: insight as unknown as Prisma.InputJsonValue,
        },
        update: {
          updatedById: user.id,
          value: insight as unknown as Prisma.InputJsonValue,
        },
        where: { key: ADMIN_DASHBOARD_AI_SETTING_KEY },
      }),
      this.prisma.aiCallLog.create({
        data: {
          aiSpace: AiSpace.ADMIN,
          ipAddress: meta.ipAddress,
          modelName: model,
          outputSummary: insight.summary.slice(0, 1000),
          purpose: AiCallPurpose.AUDIT_ANALYSIS,
          requiresHumanConfirm: false,
          sanitizedInputSummary: JSON.stringify({
            auditToday: snapshot.overview.auditToday,
            highRiskAudit: snapshot.overview.highRiskAudit,
            highRiskVulnerabilities: snapshot.overview.highRiskVulnerabilities,
            pendingVulnerabilities: snapshot.overview.pendingVulnerabilities,
            period: snapshot.period,
          }).slice(0, 2000),
          tokensUsed: null,
          userAgent: meta.userAgent,
          userId: user.id,
        },
      }),
      this.prisma.auditLog.create({
        data: {
          action: AuditAction.CALL_AI,
          actorId: user.id,
          ipAddress: meta.ipAddress,
          metadata: {
            durationMs: Date.now() - startedAt,
            model,
            source: insight.source,
          },
          requestPath: '/dashboard/admin/ai-insight/run',
          result,
          targetId: ADMIN_DASHBOARD_AI_SETTING_KEY,
          targetType: 'DASHBOARD_AI_INSIGHT',
          userAgent: meta.userAgent,
        },
      }),
    ])

    return insight
  }

  private async buildAdminDashboardSnapshot() {
    const now = new Date()
    const periodStart = startOfDay(addDays(now, -6))
    const todayStart = startOfDay(now)
    const period = {
      end: now.toISOString(),
      key: '7d' as const,
      label: '近 7 天',
      start: periodStart.toISOString(),
    }

    const recentAuditQuery = this.prisma.auditLog.findMany({
      include: { actor: { include: { role: true } } },
      orderBy: { createdAt: 'desc' },
      take: 6,
    })

    const [
      pendingVulnerabilities,
      pendingCerts,
      pendingAccessUsers,
      totalActiveUsers,
      newUsers,
      totalVulnerabilities,
      pendingRetest,
      issuedCerts,
      pendingRedemptions,
      completedRedemptions,
      auditToday,
      aiCalls,
      activeAnnouncements,
      activeLearningResources,
      learningRanges,
      activeMallProducts,
      recentVulnerabilities,
      recentAuditLogs,
      auditLogsForRisk,
      vulnerabilitiesForSeverity,
    ] = await Promise.all([
      this.prisma.vulnerabilityReport.count({
        where: {
          deletedAt: null,
          status: {
            in: [VulnerabilityStatus.SUBMITTED, VulnerabilityStatus.PENDING_REVIEW],
          },
        },
      }),
      this.prisma.certificate.count({
        where: { status: CertificateStatus.PENDING },
      }),
      this.prisma.user.count({
        where: { status: UserStatus.PENDING, role: { code: RoleCode.STUDENT } },
      }),
      this.prisma.user.count({
        where: { deletedAt: null, status: UserStatus.ACTIVE },
      }),
      this.prisma.user.count({
        where: { createdAt: { gte: periodStart }, deletedAt: null },
      }),
      this.prisma.vulnerabilityReport.count({
        where: { deletedAt: null },
      }),
      this.prisma.vulnerabilityReport.count({
        where: { deletedAt: null, status: VulnerabilityStatus.PENDING_RETEST },
      }),
      this.prisma.certificate.count({
        where: { status: CertificateStatus.ISSUED },
      }),
      this.prisma.mallRedemption.count({
        where: { status: MallRedemptionStatus.PENDING_PICKUP },
      }),
      this.prisma.mallRedemption.count({
        where: { completedAt: { gte: periodStart }, status: MallRedemptionStatus.COMPLETED },
      }),
      this.prisma.auditLog.count({
        where: { createdAt: { gte: todayStart } },
      }),
      this.prisma.aiCallLog.count({
        where: { createdAt: { gte: periodStart } },
      }),
      this.prisma.announcement.count({
        where: { deletedAt: null, status: AnnouncementStatus.PUBLISHED },
      }),
      this.prisma.learningResource.count({
        where: { active: true, deletedAt: null, kind: LearningResourceKind.RESOURCE },
      }),
      this.prisma.learningResource.count({
        where: { active: true, deletedAt: null, kind: LearningResourceKind.RANGE },
      }),
      this.prisma.mallProduct.count({
        where: { deletedAt: null, status: MallProductStatus.ACTIVE },
      }),
      this.prisma.vulnerabilityReport.findMany({
        include: {
          assignment: { select: { auditor: { select: { name: true } } } },
          submitter: { select: { name: true } },
        },
        orderBy: [{ submittedAt: 'desc' }, { updatedAt: 'desc' }],
        take: 10,
        where: {
          deletedAt: null,
          status: { not: VulnerabilityStatus.DRAFT },
          submittedAt: { not: null },
        },
      }),
      recentAuditQuery,
      this.prisma.auditLog.findMany({
        select: { action: true, result: true },
        where: { createdAt: { gte: periodStart } },
      }),
      this.prisma.vulnerabilityReport.findMany({
        select: { finalSeverity: true, selfSeverity: true },
        where: { deletedAt: null },
      }),
    ])

    const [vulnerabilityFlow, activityTrend] = await Promise.all([
      this.buildVulnerabilityFlow(),
      this.buildActivityTrend(periodStart, now),
    ])

    const mappedRecentAuditLogs = recentAuditLogs.map(mapAuditLogItem)
    const highRiskAudit = auditLogsForRisk.filter((log) => getAuditRiskLevel(log.action, log.result) === 'HIGH').length
    const severityDistribution = buildSeverityDistribution(vulnerabilitiesForSeverity)
    const highRiskVulnerabilities = severityDistribution
      .filter((item) => item.level === 'critical' || item.level === 'high')
      .reduce((sum, item) => sum + item.count, 0)

    const overview = {
      aiCalls,
      auditToday,
      completedRedemptions,
      highRiskAudit,
      highRiskVulnerabilities,
      issuedCerts,
      newUsers,
      pendingAccessUsers,
      pendingCerts,
      pendingRedemptions,
      pendingRetest,
      pendingVulnerabilities,
      totalActiveUsers,
      totalVulnerabilities,
    }

    return {
      activityTrend,
      overview,
      period,
      platform: {
        activeAnnouncements,
        activeLearningResources,
        activeMallProducts,
        learningRanges,
      },
      recentVulnerabilities: recentVulnerabilities.map((report) => ({
        assetName: report.assetName,
        id: report.id,
        ownerUnit: report.ownerUnit,
        reportNo: report.reportNo,
        reviewerName: report.assignment?.auditor.name ?? null,
        severity: formatSeverityLabel(report.finalSeverity ?? report.selfSeverity),
        status: formatVulnerabilityStatusLabel(report.status),
        submittedAt: report.submittedAt?.toISOString() ?? null,
        submitterName: report.submitter.name,
        title: report.title,
        updatedAt: report.updatedAt.toISOString(),
      })),
      recentAuditLogs: mappedRecentAuditLogs,
      severityDistribution,
      vulnerabilityFlow,
    }
  }

  private async buildVulnerabilityFlow() {
    const statuses: Array<{ label: string; status: VulnerabilityStatus }> = [
      { label: '已提交', status: VulnerabilityStatus.SUBMITTED },
      { label: '审核中', status: VulnerabilityStatus.PENDING_REVIEW },
      { label: '需补充', status: VulnerabilityStatus.NEEDS_SUPPLEMENT },
      { label: '已确认', status: VulnerabilityStatus.CONFIRMED },
      { label: '修复中', status: VulnerabilityStatus.FIXING },
      { label: '待复测', status: VulnerabilityStatus.PENDING_RETEST },
      { label: '已归档', status: VulnerabilityStatus.ARCHIVED },
      { label: '已发证', status: VulnerabilityStatus.CERTIFIED },
      { label: '已驳回', status: VulnerabilityStatus.REJECTED },
    ]

    const counts = await Promise.all(
      statuses.map((item) =>
        this.prisma.vulnerabilityReport.count({
          where: { deletedAt: null, status: item.status },
        }),
      ),
    )

    return statuses.map((item, index) => ({
      count: counts[index] ?? 0,
      label: item.label,
      status: item.status,
    }))
  }

  private async buildActivityTrend(periodStart: Date, now: Date) {
    const days = Array.from({ length: 7 }, (_, index) => startOfDay(addDays(periodStart, index)))

    return Promise.all(
      days.map(async (dayStart) => {
        const dayEnd = addDays(dayStart, 1)
        const [logins, vulnerabilities, learning, aiCalls] = await Promise.all([
          this.prisma.auditLog.count({
            where: { action: AuditAction.LOGIN, createdAt: { gte: dayStart, lt: dayEnd } },
          }),
          this.prisma.vulnerabilityReport.count({
            where: {
              deletedAt: null,
              submittedAt: { gte: dayStart, lt: dayEnd },
            },
          }),
          this.prisma.auditLog.count({
            where: {
              action: AuditAction.MANAGE_LEARNING_RESOURCE,
              metadata: {
                path: ['action'],
                equals: 'download',
              },
              createdAt: { gte: dayStart, lt: dayEnd },
            },
          }),
          this.prisma.aiCallLog.count({
            where: { createdAt: { gte: dayStart, lt: dayEnd } },
          }),
        ])

        return {
          aiCalls,
          date: formatDate(dayStart),
          learning,
          logins,
          vulnerabilities,
        }
      }),
    )
  }

  private async getStoredAiInsight(snapshot: DashboardSnapshot) {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: ADMIN_DASHBOARD_AI_SETTING_KEY },
    })

    return normalizeInsight(setting?.value, snapshot) ?? buildFallbackInsight(snapshot)
  }

  private toAdminDashboardStats(
    snapshot: DashboardSnapshot,
    aiInsight: AdminDashboardAiInsight,
  ): AdminDashboardStats {
    const operations = [
      {
        count: snapshot.overview.pendingVulnerabilities,
        label: '待初审 / 待审核',
        route: '/admin/vulnerabilities',
        severity: snapshot.overview.pendingVulnerabilities > 0 ? ('high' as const) : ('low' as const),
        title: '漏洞审核积压',
      },
      {
        count: snapshot.overview.pendingRetest,
        label: '等待复测确认',
        route: '/admin/vulnerabilities',
        severity: snapshot.overview.pendingRetest > 0 ? ('medium' as const) : ('low' as const),
        title: '修复复测队列',
      },
      {
        count: snapshot.overview.pendingCerts,
        label: '证书待签发',
        route: '/admin/certificates',
        severity: snapshot.overview.pendingCerts > 0 ? ('medium' as const) : ('low' as const),
        title: '证书签发',
      },
      {
        count: snapshot.overview.pendingAccessUsers,
        label: '用户待准入',
        route: '/admin/users',
        severity: snapshot.overview.pendingAccessUsers > 0 ? ('medium' as const) : ('low' as const),
        title: '用户准入',
      },
      {
        count: snapshot.overview.pendingRedemptions,
        label: '积分兑换待领取',
        route: '/admin/mall',
        severity: snapshot.overview.pendingRedemptions > 0 ? ('medium' as const) : ('low' as const),
        title: '积分商城履约',
      },
      {
        count: snapshot.overview.highRiskAudit,
        label: '最近高风险操作',
        route: '/admin/audit-logs',
        severity: snapshot.overview.highRiskAudit > 0 ? ('high' as const) : ('low' as const),
        title: '审计风险',
      },
    ]

    return {
      ...snapshot,
      aiInsight,
      operations,
      pendingAccessUsers: snapshot.overview.pendingAccessUsers,
      pendingCerts: snapshot.overview.pendingCerts,
      pendingRedemptions: snapshot.overview.pendingRedemptions,
      pendingVulnerabilities: snapshot.overview.pendingVulnerabilities,
      totalActiveUsers: snapshot.overview.totalActiveUsers,
      totalVulnerabilities: snapshot.overview.totalVulnerabilities,
    }
  }

  private async requestHermesDashboardInsight(snapshot: DashboardSnapshot) {
    const apiKey = getOpenAiApiKey()
    if (!apiKey) {
      throw new Error('Hermes API key not configured')
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), getRequestTimeoutMs())
    const response = await fetch(new URL('chat/completions', getOpenAiBaseUrl()), {
      body: JSON.stringify({
        messages: [
          {
            content:
              '你是高校 SRC 平台的后台运营分析助手。只返回严格 JSON，不要 Markdown。字段：summary,riskLevel,findings,recommendations,actions。riskLevel 为 high/medium/low。actions 数组元素含 label,owner,priority。',
            role: 'system',
          },
          {
            content: JSON.stringify(toAiSnapshot(snapshot)),
            role: 'user',
          },
        ],
        model: getOpenAiModel(),
        temperature: 0.2,
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout))

    if (!response.ok) {
      throw new Error(`Hermes request failed: ${response.status}`)
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>
      model?: string
    }
    const content = payload.choices?.[0]?.message?.content ?? ''
    return normalizeInsight(parseJsonObject(content), snapshot, payload.model ?? getOpenAiModel(), 'hermes')
      ?? buildFallbackInsight(snapshot, 'Hermes 返回内容无法解析')
  }
}

function buildSeverityDistribution(
  reports: Array<{ finalSeverity: VulnerabilitySeverity | null; selfSeverity: VulnerabilitySeverity }>,
) {
  const counts: Record<VulnerabilitySeverity, number> = {
    CRITICAL: 0,
    HIGH: 0,
    INFO: 0,
    LOW: 0,
    MEDIUM: 0,
  }

  reports.forEach((report) => {
    counts[report.finalSeverity ?? report.selfSeverity] += 1
  })

  return [
    { count: counts.CRITICAL, label: '严重', level: 'critical' as const },
    { count: counts.HIGH, label: '高危', level: 'high' as const },
    { count: counts.MEDIUM, label: '中危', level: 'medium' as const },
    { count: counts.LOW, label: '低危', level: 'low' as const },
    { count: counts.INFO, label: '提示', level: 'info' as const },
  ]
}

function sumStatusCounts(counts: Record<string, number>, statuses: VulnerabilityStatus[]) {
  return statuses.reduce((total, status) => total + (counts[status] ?? 0), 0)
}

function buildFallbackInsight(snapshot: DashboardSnapshot, degradedReason?: string): AdminDashboardAiInsight {
  const { overview } = snapshot
  const findings = [
    `当前待审核漏洞 ${overview.pendingVulnerabilities} 个，待复测 ${overview.pendingRetest} 个。`,
    `严重/高危漏洞 ${overview.highRiskVulnerabilities} 个，今日审计事件 ${overview.auditToday} 条。`,
    `证书待签发 ${overview.pendingCerts} 张，积分兑换待处理 ${overview.pendingRedemptions} 单。`,
  ]

  const riskLevel =
    overview.highRiskVulnerabilities > 0 || overview.highRiskAudit > 0
      ? 'high'
      : overview.pendingVulnerabilities + overview.pendingRetest + overview.pendingCerts > 0
        ? 'medium'
        : 'low'

  return {
    actions: [
      { label: '先处理严重/高危漏洞与待复测队列', owner: '漏洞审核组', priority: riskLevel === 'high' ? 'high' : 'medium' },
      { label: '清理待签发证书和待领取兑换单', owner: '平台管理员', priority: 'medium' },
      { label: '复核最近高风险审计操作', owner: '安全运营', priority: overview.highRiskAudit > 0 ? 'high' : 'low' },
    ],
    findings,
    generatedAt: new Date().toISOString(),
    model: getOpenAiModel(),
    recommendations: [
      '按高危漏洞、待复测、待签发证书的顺序安排当日处理。',
      '对登录失败和敏感权限调整保持审计抽查。',
      '定期把学习资源、公告和商城履约数据纳入运营复盘。',
    ],
    riskLevel,
    source: 'heuristic',
    status: degradedReason ? 'degraded' : 'fresh',
    summary: degradedReason
      ? `Hermes 暂不可用，已使用平台规则生成建议：${degradedReason}`
      : '基于当前平台数据生成运营建议。',
  }
}

function normalizeInsight(
  value: unknown,
  snapshot: DashboardSnapshot,
  model = getOpenAiModel(),
  source: AdminDashboardAiInsight['source'] = 'heuristic',
) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>

  return {
    actions: normalizeActions(record.actions),
    findings: normalizeStringList(record.findings, buildFallbackInsight(snapshot).findings),
    generatedAt: typeof record.generatedAt === 'string' ? record.generatedAt : new Date().toISOString(),
    model: typeof record.model === 'string' ? record.model : model,
    recommendations: normalizeStringList(record.recommendations, buildFallbackInsight(snapshot).recommendations),
    riskLevel: normalizeRiskLevel(record.riskLevel),
    source: record.source === 'hermes' || record.source === 'heuristic' ? record.source : source,
    status: record.status === 'degraded' ? 'degraded' : 'fresh',
    summary: typeof record.summary === 'string' && record.summary.trim() ? record.summary.trim().slice(0, 500) : '暂无摘要。',
  } satisfies AdminDashboardAiInsight
}

function normalizeActions(value: unknown): AdminDashboardAiInsight['actions'] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const record = item as Record<string, unknown>
      const label = typeof record.label === 'string' ? record.label.trim() : ''
      if (!label) return null
      return {
        label: label.slice(0, 120),
        owner: typeof record.owner === 'string' && record.owner.trim() ? record.owner.trim().slice(0, 40) : '平台管理员',
        priority: normalizePriority(record.priority),
      }
    })
    .filter((item): item is AdminDashboardAiInsight['actions'][number] => Boolean(item))
    .slice(0, 4)
}

function normalizeStringList(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback
  const items = value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim().slice(0, 160))
    .slice(0, 4)

  return items.length > 0 ? items : fallback
}

function normalizePriority(value: unknown): 'high' | 'medium' | 'low' {
  if (value === 'high' || value === 'medium' || value === 'low') return value
  return 'medium'
}

function normalizeRiskLevel(value: unknown): 'high' | 'medium' | 'low' {
  if (value === 'high' || value === 'medium' || value === 'low') return value
  return 'medium'
}

function parseJsonObject(content: string) {
  const normalized = content.trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim()
  const start = normalized.indexOf('{')
  const end = normalized.lastIndexOf('}')
  if (start < 0 || end < start) return null

  try {
    return JSON.parse(normalized.slice(start, end + 1)) as unknown
  } catch {
    return null
  }
}

function toAiSnapshot(snapshot: DashboardSnapshot) {
  return {
    activityTrend: snapshot.activityTrend,
    overview: snapshot.overview,
    period: snapshot.period,
    platform: snapshot.platform,
    recentAuditLogs: snapshot.recentAuditLogs.map((log) => ({
      action: log.actionLabel,
      module: log.moduleLabel,
      result: log.resultLabel,
      risk: log.riskLabel,
      summary: log.summary,
    })),
    severityDistribution: snapshot.severityDistribution,
    vulnerabilityFlow: snapshot.vulnerabilityFlow,
  }
}

function startOfDay(date: Date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function formatDate(date: Date) {
  return date.toISOString().slice(5, 10)
}

function getOpenAiBaseUrl() {
  const baseUrl = process.env.OPENAI_BASE_URL || process.env.HERMES_AGENT_BASE_URL || DEFAULT_OPENAI_BASE_URL
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
}

function getOpenAiApiKey() {
  return process.env.OPENAI_API_KEY || process.env.HERMES_AGENT_API_KEY || ''
}

function getOpenAiModel() {
  return process.env.OPENAI_MODEL || process.env.HERMES_AGENT_MODEL || DEFAULT_OPENAI_MODEL
}

function getRequestTimeoutMs() {
  const raw = process.env.OPENAI_REQUEST_TIMEOUT_MS || process.env.HERMES_AGENT_TIMEOUT_MS
  const parsed = raw ? Number(raw) : Number.NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_OPENAI_TIMEOUT_MS
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '未知错误'
}

function formatSeverityLabel(severity: VulnerabilitySeverity) {
  const map: Record<VulnerabilitySeverity, string> = {
    CRITICAL: '严重',
    HIGH: '高危',
    INFO: '信息',
    LOW: '低危',
    MEDIUM: '中危',
  }
  return map[severity] ?? severity
}

function formatVulnerabilityStatusLabel(status: VulnerabilityStatus) {
  const map: Record<VulnerabilityStatus, string> = {
    ARCHIVED: '已归档',
    CERTIFIED: '已发证',
    CONFIRMED: '已确认',
    DRAFT: '草稿',
    FIXING: '修复中',
    NEEDS_SUPPLEMENT: '待补充',
    PENDING_RETEST: '待复测',
    PENDING_REVIEW: '审核中',
    REJECTED: '已驳回',
    SUBMITTED: '待审核',
  }
  return map[status] ?? status
}
