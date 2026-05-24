import { ForbiddenException, Inject, Injectable } from '@nestjs/common'
import { LearningResourceKind, MallProductStatus, Prisma, RoleCode, VulnerabilityStatus } from '@prisma/client'
import { AuthenticatedRequestUser } from '../auth/auth.types'
import { DashboardService } from '../dashboard/dashboard.service'
import { LearningService } from '../learning/learning.service'
import { PointsMallService } from '../points-mall/points-mall.service'
import { PrismaService } from '../prisma/prisma.service'
import { VulnerabilitiesService } from '../vulnerabilities/vulnerabilities.service'
import { AnnouncementsService } from '../announcements/announcements.service'
import { AuditLogsService } from '../audit-logs/audit-logs.service'
import { AiToolCall, AiToolDefinition, UserContextSnapshot } from './ai.types'
import { getToolDefinition, isToolAllowed } from './ai.tools.registry'

// ══════════════════════════════════════════════════════════════
// 每个 tool 的结果结构（返回给 Agent 前会 JSON.stringify）
// ══════════════════════════════════════════════════════════════

type ToolExecutor = (
  args: Record<string, unknown>,
  userId: string,
  user: AuthenticatedRequestUser,
) => Promise<unknown>

@Injectable()
export class AiToolsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(VulnerabilitiesService) private readonly vulnerabilities: VulnerabilitiesService,
    @Inject(PointsMallService) private readonly pointsMall: PointsMallService,
    @Inject(LearningService) private readonly learning: LearningService,
    @Inject(DashboardService) private readonly dashboard: DashboardService,
    @Inject(AnnouncementsService) private readonly announcements: AnnouncementsService,
    @Inject(AuditLogsService) private readonly auditLogs: AuditLogsService,
  ) {}

  /** 执行单个 tool call，返回 JSON string */
  async executeTool(
    toolCall: AiToolCall,
    user: AuthenticatedRequestUser,
  ): Promise<string> {
    const { name, arguments: args } = toolCall

    // ── 安全守卫 ──
    if (!isToolAllowed(name, user.role)) {
      throw new ForbiddenException(`Tool "${name}" 不允许角色 ${user.role} 调用`)
    }

    // 强制覆盖 userId — 不信任 Agent 传入的值
    const safeArgs = { ...args, userId: user.id }

    const executor = this.getExecutor(name)
    if (!executor) {
      return JSON.stringify({ error: `未知工具: ${name}` })
    }

    try {
      const result = await executor(safeArgs, user.id, user)
      // 对敏感字段做脱敏
      return JSON.stringify(sanitizeToolResult(result, name))
    } catch (error) {
      // 不泄露内部错误给 Agent
      const message = error instanceof Error ? error.message : '工具执行失败'
      return JSON.stringify({ error: message })
    }
  }

  /** 构建初始用户上下文（注入 system prompt） */
  async buildUserContext(user: AuthenticatedRequestUser): Promise<UserContextSnapshot> {
    const [points, vulnReport, vulnSummary] = await Promise.all([
      this.pointsMall.getPointSummary(user),
      this.vulnerabilities.listMyReports(user),
      this.dashboard.getUserDashboard(user),
    ])

    // 漏洞摘要：最多 10 条，优先 NEEDS_SUPPLEMENT
    const recentVulns = vulnReport.items.slice(0, 10)

    // 学习建议：优先注入靶场，避免用户明确要靶场时被普通工具资料挤占上下文。
    const learningResult = await this.learning.listVisibleResources()
    const learningItems = selectLearningSuggestions(learningResult.items, 12)

    // 商城建议：展示所有可见商品（含积分不够的），让 Agent 全面了解平台商品。
    // listVisibleProducts 每轮请求实时查库，管理员新增/修改商品后下一轮 AI 对话即可看到。
    const mallResult = await this.pointsMall.listVisibleProducts(user)
    const mallItems = mallResult.items

    return {
      learningSuggestions: learningItems.map((item) => ({
        category: item.category,
        description: item.description ?? null,
        id: item.id,
        kind: item.kind,
        title: item.title,
      })),
      mallSuggestions: mallItems.map((item) => ({
        canRedeem: item.canRedeem ?? false,
        category: item.category ?? '实体奖励',
        description: item.description || null,
        id: item.id,
        imageUrl: item.imageUrl && item.imageUrl.length > 0 ? item.imageUrl : null,
        name: item.name,
        perUserLimit: item.perUserLimit ?? 1,
        pointsCost: item.pointsCost,
        remainingAfterRedeem: points.balance - item.pointsCost,
        stock: item.stock,
      })),
      points: {
        balance: points.balance,
        earned: points.earned,
        pendingRedemptions: points.pendingRedemptions,
        spent: points.spent,
      },
      vulnerabilities: {
        confirmed: vulnSummary.confirmedCount,
        needsSupplement: vulnReport.stats.needSupplement,
        pending: vulnReport.stats.pending,
        recent: recentVulns.map((v) => ({
          finalSeverity: v.finalSeverity ?? null,
          hasCertificate: false,
          id: v.id,
          needsSupplement: v.status === '待补充',
          reportNo: v.reportNo,
          selfSeverity: v.selfSeverity,
          status: v.status,
          submittedAt: v.submittedAt?.toISOString() ?? null,
          title: v.title,
        })),
        total: vulnReport.stats.total,
      },
    }
  }

  // ════════════════════════════════════════════════════════════
  // Private: executor lookup
  // ════════════════════════════════════════════════════════════

  private getExecutor(name: string): ToolExecutor | undefined {
    const executors: Record<string, ToolExecutor> = {
      get_audit_log_summary: this.execGetAuditLogSummary,
      get_assigned_reports: this.execGetAssignedReports,
      get_my_vulnerabilities: this.execGetMyVulnerabilities,
      get_platform_stats: this.execGetPlatformStats,
      get_point_balance: this.execGetPointBalance,
      get_redeem_eligibility: this.execGetRedeemEligibility,
      get_review_queue_stats: this.execGetReviewQueueStats,
      get_user_summary: this.execGetUserSummary,
      search_learning_resources: this.execSearchLearningResources,
      search_mall_products: this.execSearchMallProducts,
    }
    return executors[name]
  }

  // ════════════════════════════════════════════════════════════
  // Layer 1: 学生域执行器
  // ════════════════════════════════════════════════════════════

  private execGetUserSummary: ToolExecutor = async (_args, _userId, user) => {
    const [points, vulnReport, vulnSummary] = await Promise.all([
      this.pointsMall.getPointSummary(user),
      this.vulnerabilities.listMyReports(user),
      this.dashboard.getUserDashboard(user),
    ])

    return {
      needsSupplementCount: vulnReport.stats.needSupplement,
      pendingCount: vulnReport.stats.pending,
      points: {
        balance: points.balance,
        earned: points.earned,
        spent: points.spent,
      },
      recentVulnerabilities: vulnReport.items.slice(0, 5).map((v) => ({
        reportNo: v.reportNo,
        status: v.status,
        title: v.title,
      })),
      totalVulnerabilities: vulnReport.stats.total,
    }
  }

  private execGetMyVulnerabilities: ToolExecutor = async (args, _userId, user) => {
    const statusFilter = typeof args.status === 'string' ? args.status : undefined

    const result = await this.vulnerabilities.listMyReports(user)

    let items = result.items
    if (statusFilter) {
      const statusLabel = mapStatusToLabel(statusFilter)
      items = items.filter((item) => item.status === statusLabel)
    }

    return {
      items: items.map((v) => ({
        finalSeverity: v.finalSeverity ?? null,
        id: v.id,
        needsSupplement: v.status === '待补充',
        reportNo: v.reportNo,
        selfSeverity: v.selfSeverity,
        status: v.status,
        submittedAt: v.submittedAt?.toISOString() ?? null,
        title: v.title,
        vulnerabilityType: v.vulnerabilityType,
      })),
      stats: result.stats,
    }
  }

  private execGetPointBalance: ToolExecutor = async (_args, _userId, user) => {
    const points = await this.pointsMall.getPointSummary(user)
    return {
      balance: points.balance,
      earned: points.earned,
      pendingRedemptions: points.pendingRedemptions,
      spent: points.spent,
    }
  }

  private execGetRedeemEligibility: ToolExecutor = async (args, _userId, user) => {
    const keyword = typeof args.keyword === 'string' ? args.keyword.trim() : ''

    const result = await this.pointsMall.listVisibleProducts(user)
    const points = await this.pointsMall.getPointSummary(user)

    let products = result.items
    if (keyword) {
      const lower = keyword.toLowerCase()
      products = products.filter(
        (p) => p.name.toLowerCase().includes(lower) || (p.description ?? '').toLowerCase().includes(lower),
      )
    }

    return {
      products: products.map((p) => ({
        canRedeem: p.canRedeem ?? false,
        category: p.category,
        id: p.id,
        name: p.name,
        perUserLimit: p.perUserLimit ?? 1,
        pointsCost: p.pointsCost,
        remainingAfterRedeem: points.balance - p.pointsCost,
        stock: p.stock,
      })),
      totalBalance: products.length > 0 ? products[0].pointsCost : 0, // 近似值
    }
  }

  private execSearchLearningResources: ToolExecutor = async (args, _userId, _user) => {
    const keyword = typeof args.keyword === 'string' ? args.keyword.trim().toLowerCase() : ''
    const category = typeof args.category === 'string' ? args.category.trim() : ''
    const kind = typeof args.kind === 'string' ? (args.kind as LearningResourceKind) : undefined

    const result = await this.learning.listVisibleResources()

    let items = result.items
    if (keyword) {
      items = items.filter(
        (r) =>
          r.title.toLowerCase().includes(keyword) ||
          (r.description ?? '').toLowerCase().includes(keyword) ||
          r.category.toLowerCase().includes(keyword),
      )
    }
    if (category) {
      items = items.filter((r) => r.category === category)
    }
    if (kind) {
      items = items.filter((r) => r.kind === kind)
    }

    return {
      items: items.slice(0, 8).map((r) => ({
        category: r.category,
        description: r.description ?? null,
        id: r.id,
        kind: r.kind,
        title: r.title,
      })),
      total: items.length,
    }
  }

  private execSearchMallProducts: ToolExecutor = async (args, _userId, user) => {
    const keyword = typeof args.keyword === 'string' ? args.keyword.trim().toLowerCase() : ''
    const category = typeof args.category === 'string' ? args.category.trim() : ''

    const result = await this.pointsMall.listVisibleProducts(user)
    const points = await this.pointsMall.getPointSummary(user)

    let items = result.items
    if (keyword) {
      items = items.filter(
        (p) =>
          p.name.toLowerCase().includes(keyword) ||
          (p.description ?? '').toLowerCase().includes(keyword),
      )
    }
    if (category) {
      items = items.filter((p) => p.category === category)
    }

    return {
      items: items.slice(0, 8).map((p) => ({
        canRedeem: p.canRedeem ?? false,
        category: p.category,
        id: p.id,
        name: p.name,
        perUserLimit: p.perUserLimit ?? 1,
        pointsCost: p.pointsCost,
        remainingAfterRedeem: points.balance - p.pointsCost,
        stock: p.stock,
      })),
      total: items.length,
    }
  }

  // ════════════════════════════════════════════════════════════
  // Layer 2: 审核员域执行器
  // ════════════════════════════════════════════════════════════

  private execGetAssignedReports: ToolExecutor = async (args, _userId, _user) => {
    const statusFilter = typeof args.status === 'string' ? args.status : undefined

    const assignments = await this.prisma.reviewAssignment.findMany({
      where: {
        auditorId: _userId,
        closedAt: null,
      },
      include: {
        report: {
          select: {
            assetName: true,
            id: true,
            reportNo: true,
            selfSeverity: true,
            status: true,
            submittedAt: true,
            title: true,
            vulnerabilityType: true,
          },
        },
      },
      orderBy: { assignedAt: 'desc' },
      take: 50,
    })

    let reports = assignments.map((a) => ({
      assetName: a.report.assetName,
      id: a.report.id,
      reportNo: a.report.reportNo,
      selfSeverity: a.report.selfSeverity,
      status: a.report.status,
      submittedAt: a.report.submittedAt?.toISOString() ?? null,
      title: a.report.title,
      vulnerabilityType: a.report.vulnerabilityType,
    }))

    if (statusFilter) {
      reports = reports.filter((r) => r.status === statusFilter)
    }

    return {
      items: reports,
      total: reports.length,
    }
  }

  private execGetReviewQueueStats: ToolExecutor = async (_args, _userId, _user) => {
    const stats = await this.dashboard.getAuditorDashboard()
    return {
      pendingArchive: stats.pendingArchive,
      pendingCerts: stats.pendingCerts,
      pendingInitReview: stats.pendingInitReview,
      pendingRetest: stats.pendingRetest,
    }
  }

  // ════════════════════════════════════════════════════════════
  // Layer 3: 管理员域执行器
  // ════════════════════════════════════════════════════════════

  private execGetPlatformStats: ToolExecutor = async (_args, _userId, _user) => {
    const stats = await this.dashboard.getAdminDashboard()

    // 高危漏洞分布
    const severityDistribution = await this.prisma.vulnerabilityReport.groupBy({
      by: ['finalSeverity'],
      where: { deletedAt: null },
      _count: { id: true },
    })

    return {
      pendingAccessUsers: stats.pendingAccessUsers,
      pendingCerts: stats.pendingCerts,
      pendingRedemptions: stats.pendingRedemptions,
      pendingVulnerabilities: stats.pendingVulnerabilities,
      severityDistribution: severityDistribution.map((s) => ({
        count: s._count.id,
        severity: s.finalSeverity ?? 'UNRATED',
      })),
      totalActiveUsers: stats.totalActiveUsers,
      totalVulnerabilities: stats.totalVulnerabilities,
    }
  }

  private execGetAuditLogSummary: ToolExecutor = async (args, _userId, _user) => {
    const hours = typeof args.hours === 'number' ? Math.min(args.hours, 168) : 24
    const since = new Date(Date.now() - hours * 60 * 60 * 1000)

    const logs = await this.prisma.auditLog.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      select: {
        action: true,
        createdAt: true,
        result: true,
        targetType: true,
      },
      take: 100,
    })

    const actionCounts: Record<string, number> = {}
    const failedActions: Array<{ action: string; time: string }> = []

    for (const log of logs) {
      actionCounts[log.action] = (actionCounts[log.action] ?? 0) + 1
      if (log.result !== 'success') {
        failedActions.push({ action: log.action, time: log.createdAt.toISOString() })
      }
    }

    return {
      actionDistribution: actionCounts,
      failedActions: failedActions.slice(0, 10),
      periodHours: hours,
      totalEvents: logs.length,
    }
  }
}

// ══════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════

const STATUS_LABEL_MAP: Record<string, string> = {
  CERTIFIED: '已发证',
  CONFIRMED: '已确认',
  FIXING: '修复中',
  NEEDS_SUPPLEMENT: '待补充',
  PENDING_REVIEW: '审核中',
  REJECTED: '已驳回',
  SUBMITTED: '已提交',
}

function mapStatusToLabel(status: string): string {
  return STATUS_LABEL_MAP[status] ?? status
}

/** 按 key 多样性采样前 n 条（不重复 key） */
function sampleDiverse<T>(items: T[], n: number, keyFn: (item: T) => string): T[] {
  const seen = new Set<string>()
  const result: T[] = []
  for (const item of items) {
    const key = keyFn(item)
    if (!seen.has(key)) {
      seen.add(key)
      result.push(item)
      if (result.length >= n) break
    }
  }
  return result
}

function selectLearningSuggestions<T extends { id: string; category: string; kind: LearningResourceKind }>(items: T[], n: number): T[] {
  const ranges = sampleDiverse(items.filter((item) => item.kind === LearningResourceKind.RANGE), Math.ceil(n * 0.75), (item) => item.category)
  const selectedIds = new Set(ranges.map((item) => item.id))
  const resources = sampleDiverse(
    items.filter((item) => item.kind === LearningResourceKind.RESOURCE && !selectedIds.has(item.id)),
    n - ranges.length,
    (item) => item.category,
  )
  return [...ranges, ...resources].slice(0, n)
}

/** 对 tool 结果脱敏（屏蔽 email 等字段） */
function sanitizeToolResult(result: unknown, _toolName: string): unknown {
  if (!result || typeof result !== 'object') return result

  const sanitize = (obj: Record<string, unknown>): Record<string, unknown> => {
    const cleaned: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      if (key === 'email' || key === 'unifiedCode' || key === 'passwordHash') {
        cleaned[key] = '[REDACTED]'
      } else if (Array.isArray(value)) {
        cleaned[key] = value.map((item) =>
          typeof item === 'object' && item !== null ? sanitize(item as Record<string, unknown>) : item,
        )
      } else if (typeof value === 'object' && value !== null) {
        cleaned[key] = sanitize(value as Record<string, unknown>)
      } else {
        cleaned[key] = value
      }
    }
    return cleaned
  }

  return sanitize(result as Record<string, unknown>)
}
