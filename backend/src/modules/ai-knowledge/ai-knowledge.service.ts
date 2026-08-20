import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common'
import {
  AiKnowledgeCategory,
  AiKnowledgeFeedbackValue,
  AiKnowledgeMaintenanceStatus,
  AiKnowledgeRoleScope,
  AiKnowledgeSensitivity,
  AiKnowledgeSource,
  AiKnowledgeStatus,
  AiKnowledgeVisibility,
  AiSpace,
  RoleCode,
  Prisma,
} from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { ClientRequestMeta } from '../auth/auth.types'
import { stableHash } from './ai-knowledge.utils'
import {
  AiKnowledgeCreateInput,
  AiKnowledgeFeedbackInput,
  AiKnowledgeHitSummary,
  AiKnowledgeListQuery,
  AiKnowledgeMaintenanceListQuery,
  AiKnowledgeMaintenanceResolveInput,
  AiKnowledgeRetrievalInput,
  AiKnowledgeRevisionCreateInput,
  AiKnowledgeRevisionRestoreInput,
  AiKnowledgeReviewInput,
} from './ai-knowledge.types'

const SENSITIVE_PATTERNS = [
  /authorization\s*:/i,
  /bearer\s+[a-z0-9._~+/=-]{12,}/i,
  /cookie\s*:/i,
  /set-cookie\s*:/i,
  /password\s*[=:：]/i,
  /api[_-]?key\s*[=:：]/i,
  /(?:access|refresh)?_?token\s*[=:：]/i,
  /(?:secret|client_secret|secret_key|private_key)\s*[=:：]/i,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/i,
  /(?:10|127|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.\d{1,3}\.\d{1,3}/,
]

const PROMPT_INJECTION_PATTERNS = [
  /忽略.*(规则|指令|系统)/,
  /ignore\s+(previous|all)\s+instructions/i,
  /system\s*prompt/i,
  /开发者指令|系统提示词|绕过\s*(平台|系统|审核|权限|规则)|越权\s*(读取|查询|查看|操作|修改|删除)\s*(平台|系统|用户|管理员|数据库|数据)/i,
]
const AI_KNOWLEDGE_AUTO_APPROVE_THRESHOLD = 0.88
const AI_KNOWLEDGE_REVIEW_THRESHOLD = 0.62
const AI_KNOWLEDGE_DUPLICATE_REVIEW_THRESHOLD = 0.72
const AI_KNOWLEDGE_DUPLICATE_STRONG_THRESHOLD = 0.86
const AI_KNOWLEDGE_EVALUATION_TIMEOUT_MS = 45_000
const DEFAULT_OPENAI_BASE_URL = 'http://localhost:5000/v1'
const DEFAULT_OPENAI_MODEL = 'hermes-agent'

type ConversationLearningSummary = ReturnType<typeof buildConversationLearningSummary>
type ConversationAiEvaluation = {
  suggestedKnowledgeType: 'KB' | 'SKILL' | 'DISCARD'
  overallScore: number
  kbScore: number
  skillScore: number
  safetyScore: number
  privacyRiskScore: number
  confidenceScore: number
  reason: string
  signals: string[]
  risks: string[]
}

type SimilarKnowledgeMatch = {
  id: string
  title: string
  category: AiKnowledgeCategory
  status: AiKnowledgeStatus
  similarity: number
  hitCount: number
  helpfulCount: number
  tags: string[]
}

type ConversationDuplicateAssessment = {
  duplicateRiskScore: number
  matches: SimilarKnowledgeMatch[]
  mergeSuggestion: string | null
}

const CATEGORY_KEYWORDS: Array<[AiKnowledgeCategory, RegExp]> = [
  [AiKnowledgeCategory.XSS, /xss|跨站|脚本/i],
  [AiKnowledgeCategory.SQL_INJECTION, /sql\s*注入|sqli|union\s+select/i],
  [AiKnowledgeCategory.SSRF, /ssrf|服务端请求伪造/i],
  [AiKnowledgeCategory.FILE_UPLOAD, /文件上传|上传漏洞|webshell/i],
  [AiKnowledgeCategory.ACCESS_CONTROL, /越权|idor|权限|访问控制/i],
  [AiKnowledgeCategory.AUTHENTICATION, /认证|登录|jwt|session/i],
  [AiKnowledgeCategory.SECURITY_LEARNING, /学习|路线|入门|教程/i],
  [AiKnowledgeCategory.AUDITOR_REVIEW, /审核|复测|驳回|待补充/i],
  [AiKnowledgeCategory.ADMIN_ANALYTICS, /周报|统计|运营|分析/i],
  [AiKnowledgeCategory.PLATFORM_USAGE, /平台|积分|商城|证书|公告/i],
]

@Injectable()
export class AiKnowledgeService {
  private readonly logger = new Logger(AiKnowledgeService.name)

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async retrieve(input: AiKnowledgeRetrievalInput): Promise<AiKnowledgeHitSummary[]> {
    const sanitized = redactSensitiveText(input.question)
    if (shouldRejectForSafety(sanitized)) return []

    const tokens = tokenizeForSearch(sanitized)
    if (tokens.length === 0) return []

    const roleScopes = getRoleScopes(input.aiSpace)
    const where: Prisma.AiKnowledgeEntryWhereInput = {
      roleScope: { in: roleScopes },
      maintenanceStatus: { in: [AiKnowledgeMaintenanceStatus.HEALTHY, AiKnowledgeMaintenanceStatus.LOW_QUALITY_REVIEW, AiKnowledgeMaintenanceStatus.DUPLICATE_REVIEW] },
      retrievalEnabled: true,
      status: { in: [AiKnowledgeStatus.APPROVED, AiKnowledgeStatus.AUTO_APPROVED] },
      sensitivity: { in: [AiKnowledgeSensitivity.PUBLIC, AiKnowledgeSensitivity.INTERNAL] },
      visibility: { in: [AiKnowledgeVisibility.PLATFORM_PUBLIC, AiKnowledgeVisibility.ROLE_ONLY] },
      abuseReportCount: 0,
      AND: [
        { OR: [{ directAnswerEnabled: true }, { agentInjectEnabled: true }] },
        {
          OR: tokens.slice(0, 8).flatMap((token) => [
            { title: { contains: token, mode: 'insensitive' as const } },
            { canonicalQuestion: { contains: token, mode: 'insensitive' as const } },
            { canonicalAnswer: { contains: token, mode: 'insensitive' as const } },
            { tags: { has: token } },
          ]),
        },
      ],
    }

    const entries = await this.prisma.aiKnowledgeEntry.findMany({
      orderBy: [{ helpfulCount: 'desc' }, { hitCount: 'desc' }, { updatedAt: 'desc' }],
      take: Math.min(input.limit ?? 3, 8),
      where,
    })

    const hits = entries
      .map((entry) => ({
        agentInjectEnabled: entry.agentInjectEnabled,
        answer: entry.canonicalAnswer,
        category: entry.category,
        directAnswerEnabled: entry.directAnswerEnabled && entry.maintenanceStatus !== AiKnowledgeMaintenanceStatus.LOW_QUALITY_REVIEW,
        id: entry.id,
        maintenanceStatus: entry.maintenanceStatus,
        retrievalEnabled: entry.retrievalEnabled,
        similarity: scoreKnowledgeHit(sanitized, tokens, entry),
        tags: entry.tags,
        title: entry.title,
      }))
      .filter((hit) => hit.similarity >= 0.18)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, input.limit ?? 3)

    const recordedHitIds = new Map<string, string>()
    if (input.recordHits !== false) {
      try {
        await Promise.all(
          hits.map(async (hit) => {
            const [, recordedHit] = await this.prisma.$transaction([
              this.prisma.aiKnowledgeEntry.update({
                data: { hitCount: { increment: 1 } },
                where: { id: hit.id },
              }),
              this.prisma.aiKnowledgeHit.create({
                data: {
                  aiSpace: input.aiSpace,
                  knowledgeId: hit.id,
                  questionHash: stableHash(sanitized),
                  questionSummary: sanitized.slice(0, 1000),
                  route: hit.similarity >= 0.55 ? 'RECALLED_DIRECT_CANDIDATE' : 'RECALLED_INJECT_CANDIDATE',
                  similarity: hit.similarity,
                  usedInResponse: false,
                  userId: input.userId,
                },
              }),
            ])
            recordedHitIds.set(hit.id, recordedHit.id)
          }),
        )
      } catch (error) {
        this.logger.warn(`AI 知识命中统计写入失败，不阻断检索结果：${error instanceof Error ? error.message : String(error)}`)
      }
    }

    return hits.map((hit) => ({ ...hit, hitId: recordedHitIds.get(hit.id) }))
  }

  async getStats() {
    const now = new Date()
    const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const [total, needsReview, sessionReviewBacklog, approved, rejected, recentHits, usedHits, directAnswers, injectedAnswers, openMaintenance, feedback, directKnowledgeHits] = await Promise.all([
      this.prisma.aiKnowledgeEntry.count(),
      this.prisma.aiKnowledgeEntry.count({ where: { status: AiKnowledgeStatus.NEEDS_REVIEW } }),
      this.prisma.aiProblemSession.count({ where: { status: { in: ['READY_REVIEW', 'RESOLVED'] } } }),
      this.prisma.aiKnowledgeEntry.count({ where: { status: { in: [AiKnowledgeStatus.APPROVED, AiKnowledgeStatus.AUTO_APPROVED] } } }),
      this.prisma.aiKnowledgeEntry.count({ where: { status: AiKnowledgeStatus.REJECTED } }),
      this.prisma.aiKnowledgeHit.count({ where: { createdAt: { gte: since24h } } }),
      this.prisma.aiKnowledgeHit.count({ where: { createdAt: { gte: since30d }, usedInResponse: true } }),
      this.prisma.aiKnowledgeHit.count({ where: { createdAt: { gte: since30d }, route: 'KNOWLEDGE_DIRECT_ANSWER', usedInResponse: true } }),
      this.prisma.aiKnowledgeHit.count({ where: { createdAt: { gte: since30d }, route: 'KNOWLEDGE_INJECTED_AGENT', usedInResponse: true } }),
      this.prisma.aiKnowledgeMaintenanceTask.count({ where: { status: 'OPEN' } }),
      this.prisma.aiKnowledgeFeedback.groupBy({ by: ['value'], _count: { _all: true }, where: { createdAt: { gte: since30d } } }),
      this.prisma.aiKnowledgeHit.findMany({
        include: { knowledge: { select: { canonicalAnswer: true } } },
        take: 10_000,
        where: { createdAt: { gte: since30d }, route: 'KNOWLEDGE_DIRECT_ANSWER', usedInResponse: true },
      }),
    ])

    const byCategory = await this.prisma.aiKnowledgeEntry.groupBy({
      _count: { _all: true },
      by: ['category'],
      orderBy: { _count: { category: 'desc' } },
    })
    const byStatus = await this.prisma.aiKnowledgeEntry.groupBy({
      _count: { _all: true },
      by: ['status'],
    })
    const feedbackCounts = Object.fromEntries(feedback.map((item) => [item.value, item._count._all]))
    const estimatedTokensSaved = directKnowledgeHits.reduce((totalTokens, hit) => totalTokens + Math.max(1, Math.ceil(hit.knowledge.canonicalAnswer.length / 2)), 0)

    return {
      totals: {
        approved,
        estimatedTokensSaved,
        injectedAnswers,
        needsReview,
        openMaintenance,
        recentHits,
        rejected,
        reviewBacklog: needsReview + sessionReviewBacklog,
        sessionReviewBacklog,
        total,
        usedHits,
        directAnswers,
      },
      feedback30d: {
        abuseReports: feedbackCounts[AiKnowledgeFeedbackValue.REPORT_ABUSE] ?? 0,
        rate: usedHits > 0 ? Number(((feedback.reduce((count, item) => count + item._count._all, 0)) / usedHits).toFixed(4)) : 0,
        helpful: feedbackCounts[AiKnowledgeFeedbackValue.HELPFUL] ?? 0,
        unhelpful: feedbackCounts[AiKnowledgeFeedbackValue.UNHELPFUL] ?? 0,
      },
      byCategory: byCategory.map((item) => ({ category: item.category, count: item._count._all })),
      byStatus: byStatus.map((item) => ({ status: item.status, count: item._count._all })),
    }
  }

  async getManagementUnread(userId: string) {
    const viewedThrough = new Date()
    const user = await this.prisma.user.findUniqueOrThrow({
      select: { aiManagementViewedAt: true },
      where: { id: userId },
    })
    const since = user.aiManagementViewedAt
    const updatedAfterView = since ? { gt: since } : undefined
    const [knowledge, sessions, skillReviews] = await Promise.all([
      this.prisma.aiKnowledgeEntry.count({
        where: {
          status: AiKnowledgeStatus.NEEDS_REVIEW,
          ...(updatedAfterView ? { updatedAt: updatedAfterView } : {}),
        },
      }),
      this.prisma.aiProblemSession.count({
        where: {
          status: { in: ['READY_REVIEW', 'RESOLVED'] },
          ...(updatedAfterView ? { updatedAt: updatedAfterView } : {}),
        },
      }),
      this.prisma.aiSkillReview.count({
        where: {
          status: 'PENDING',
          ...(updatedAfterView ? { submittedAt: updatedAfterView } : {}),
        },
      }),
    ])

    return { knowledge, sessions, skillReviews, total: knowledge + sessions + skillReviews, viewedThrough: viewedThrough.toISOString() }
  }

  async markManagementViewed(userId: string, rawViewedThrough: unknown) {
    const viewedAt = typeof rawViewedThrough === 'string' ? new Date(rawViewedThrough) : new Date(Number.NaN)
    if (!Number.isFinite(viewedAt.getTime()) || viewedAt.getTime() > Date.now() + 5_000) {
      throw new BadRequestException('无效的 AI 管理浏览截止时间')
    }
    await this.prisma.user.updateMany({
      data: { aiManagementViewedAt: viewedAt },
      where: {
        id: userId,
        OR: [{ aiManagementViewedAt: null }, { aiManagementViewedAt: { lt: viewedAt } }],
      },
    })
    return { viewedAt: viewedAt.toISOString() }
  }

  async listKnowledge(query: AiKnowledgeListQuery) {
    const where: Prisma.AiKnowledgeEntryWhereInput = {
      ...(query.category ? { category: query.category } : {}),
      ...(query.roleScope ? { roleScope: query.roleScope } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.keyword
        ? {
            OR: [
              { title: { contains: query.keyword, mode: 'insensitive' } },
              { canonicalQuestion: { contains: query.keyword, mode: 'insensitive' } },
              { canonicalAnswer: { contains: query.keyword, mode: 'insensitive' } },
            ],
          }
        : {}),
    }
    const [total, items] = await Promise.all([
      this.prisma.aiKnowledgeEntry.count({ where }),
      this.prisma.aiKnowledgeEntry.findMany({
        orderBy: { updatedAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        where,
      }),
    ])
    return { items, pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.max(1, Math.ceil(total / query.pageSize)) } }
  }

  async createKnowledge(input: AiKnowledgeCreateInput, actorId: string) {
    const question = redactSensitiveText(input.question)
    const answer = redactSensitiveText(input.answer)
    const rejectionReason = getRejectionReason(question, answer)
    if (rejectionReason) throw new BadRequestException(`知识内容未通过安全沉淀检查：${rejectionReason}`)
    const sourceHash = stableHash(`admin:${question}:${answer}`)

    try {
      const entry = await this.prisma.aiKnowledgeEntry.create({
        data: {
        answerQualityScore: 0.9,
        canonicalAnswer: answer,
        canonicalQuestion: question,
        category: input.category ?? AiKnowledgeCategory.VULNERABILITY_REPORTING,
        confidenceScore: 0.9,
        educationalValueScore: 0.85,
        generalityScore: 0.85,
        platformRelevanceScore: 0.9,
        privacyRiskScore: 0,
        reuseValueScore: 0.85,
        reviewedById: actorId,
        roleScope: input.roleScope ?? AiKnowledgeRoleScope.ALL,
        safetyScore: 0.95,
        sensitivity: input.sensitivity ?? AiKnowledgeSensitivity.INTERNAL,
        similarityKey: buildSimilarityKey(question),
        source: AiKnowledgeSource.ADMIN_CREATED,
        sourceHash,
        status: AiKnowledgeStatus.APPROVED,
        tags: input.tags ?? [],
        title: input.title,
        visibility: input.visibility === AiKnowledgeVisibility.REVIEW_REQUIRED ? AiKnowledgeVisibility.PLATFORM_PUBLIC : (input.visibility ?? AiKnowledgeVisibility.PLATFORM_PUBLIC),
      },
    })
    return entry
    } catch (error) {
      if (isUniqueConstraintError(error)) throw new ConflictException('相同知识条目已存在')
      throw error
    }
  }

  async reviewKnowledge(id: string, input: AiKnowledgeReviewInput, reviewerId: string) {
    const entry = await this.prisma.aiKnowledgeEntry.findUnique({ where: { id } })
    if (!entry) throw new NotFoundException('知识条目不存在')

    if (input.status === AiKnowledgeStatus.APPROVED) {
      const rejectionReason = getRejectionReason(entry.canonicalQuestion, entry.canonicalAnswer)
      if (rejectionReason) throw new BadRequestException(`知识内容未通过安全沉淀检查：${rejectionReason}`)
      if (entry.sensitivity !== AiKnowledgeSensitivity.PUBLIC && entry.sensitivity !== AiKnowledgeSensitivity.INTERNAL) {
        throw new BadRequestException('敏感级别为 SENSITIVE/REJECTED 的知识不能批准进入生产知识库')
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const oldSnapshot = this.buildKnowledgeSnapshot(entry)
      const updated = await tx.aiKnowledgeEntry.update({
        data: {
          reviewNote: input.note,
          reviewedAt: new Date(),
          reviewedById: reviewerId,
          archivedAt: input.status === AiKnowledgeStatus.ARCHIVED ? new Date() : entry.archivedAt,
          sensitivity: input.status === AiKnowledgeStatus.REJECTED ? AiKnowledgeSensitivity.REJECTED : entry.sensitivity,
          status: input.status,
          visibility: input.status === AiKnowledgeStatus.APPROVED ? (entry.visibility === AiKnowledgeVisibility.REVIEW_REQUIRED ? AiKnowledgeVisibility.ROLE_ONLY : entry.visibility) : AiKnowledgeVisibility.REVIEW_REQUIRED,
        },
        where: { id },
      })
      await this.createRevisionRecord(tx, {
        changeReason: input.note ?? `审核状态变更为 ${input.status}`,
        changeType: 'REVIEW',
        editorId: reviewerId,
        knowledgeId: id,
        newEntry: updated,
        oldSnapshot,
      })
      return updated
    })
  }

  async listRevisions(knowledgeId: string) {
    await this.ensureKnowledgeExists(knowledgeId)
    return this.prisma.aiKnowledgeRevision.findMany({
      orderBy: { version: 'desc' },
      where: { knowledgeId },
    })
  }

  async createRevision(id: string, input: AiKnowledgeRevisionCreateInput, editorId: string, meta: ClientRequestMeta = {}) {
    const entry = await this.prisma.aiKnowledgeEntry.findUnique({ where: { id } })
    if (!entry) throw new NotFoundException('知识条目不存在')

    const nextAnswer = input.answer ?? entry.canonicalAnswer
    const nextQuestion = input.question ?? entry.canonicalQuestion
    const rejectionReason = getRejectionReason(nextQuestion, nextAnswer)
    if (rejectionReason) throw new BadRequestException(`知识修订内容未通过安全沉淀检查：${rejectionReason}`)

    const retrievalEnabled = input.retrievalEnabled ?? entry.retrievalEnabled
    const directAnswerEnabled = retrievalEnabled ? (input.directAnswerEnabled ?? entry.directAnswerEnabled) : false
    const agentInjectEnabled = retrievalEnabled ? (input.agentInjectEnabled ?? entry.agentInjectEnabled) : false

    return this.prisma.$transaction(async (tx) => {
      const oldSnapshot = this.buildKnowledgeSnapshot(entry)
      const updated = await tx.aiKnowledgeEntry.update({
        data: {
          agentInjectEnabled,
          ...(input.answer === undefined ? {} : { canonicalAnswer: input.answer }),
          ...(input.category === undefined ? {} : { category: input.category }),
          directAnswerEnabled,
          ...(input.question === undefined ? {} : { canonicalQuestion: input.question }),
          retrievalEnabled,
          ...(input.roleScope === undefined ? {} : { roleScope: input.roleScope }),
          ...(input.sensitivity === undefined ? {} : { sensitivity: input.sensitivity }),
          ...(input.tags === undefined ? {} : { tags: input.tags }),
          ...(input.title === undefined ? {} : { title: input.title }),
          ...(input.visibility === undefined ? {} : { visibility: input.visibility }),
          reviewNote: input.changeReason,
          reviewedAt: new Date(),
          reviewedById: editorId,
        },
        where: { id },
      })
      const revision = await this.createRevisionRecord(tx, {
        changeReason: input.changeReason,
        changeType: input.changeType,
        editorId,
        knowledgeId: id,
        newEntry: updated,
        oldSnapshot,
      })
      await tx.auditLog.create({
        data: {
          action: 'CHANGE_SYSTEM_SETTING',
          actorId: editorId,
          ipAddress: meta.ipAddress,
          metadata: { changeType: input.changeType, revisionId: revision.id, version: revision.version } as Prisma.InputJsonValue,
          requestPath: meta.requestPath,
          result: 'success',
          targetId: id,
          targetType: 'AiKnowledgeEntry',
          userAgent: meta.userAgent,
        },
      })
      return { entry: updated, revision }
    })
  }

  async restoreRevision(id: string, input: AiKnowledgeRevisionRestoreInput, editorId: string, meta: ClientRequestMeta = {}) {
    const entry = await this.prisma.aiKnowledgeEntry.findUnique({ where: { id } })
    if (!entry) throw new NotFoundException('知识条目不存在')
    const target = await this.prisma.aiKnowledgeRevision.findFirst({
      where: { knowledgeId: id, ...(input.revisionId ? { id: input.revisionId } : { version: input.version }) },
    })
    if (!target) throw new NotFoundException('修订版本不存在')

    return this.prisma.$transaction(async (tx) => {
      const oldSnapshot = this.buildKnowledgeSnapshot(entry)
      const restoredData = this.buildKnowledgeUpdateFromSnapshot(target.newSnapshot)
      const updated = await tx.aiKnowledgeEntry.update({
        data: {
          ...restoredData,
          reviewNote: input.reason,
          reviewedAt: new Date(),
          reviewedById: editorId,
        },
        where: { id },
      })
      const revision = await this.createRevisionRecord(tx, {
        changeReason: input.reason,
        changeType: 'ROLLBACK',
        editorId,
        knowledgeId: id,
        newEntry: updated,
        oldSnapshot,
      })
      await tx.auditLog.create({
        data: {
          action: 'CHANGE_SYSTEM_SETTING',
          actorId: editorId,
          ipAddress: meta.ipAddress,
          metadata: { restoredRevisionId: target.id, restoredVersion: target.version, revisionId: revision.id, version: revision.version } as Prisma.InputJsonValue,
          requestPath: meta.requestPath,
          result: 'success',
          targetId: id,
          targetType: 'AiKnowledgeEntry',
          userAgent: meta.userAgent,
        },
      })
      return { entry: updated, revision, restoredFrom: target }
    })
  }

  private async ensureKnowledgeExists(id: string) {
    const exists = await this.prisma.aiKnowledgeEntry.findUnique({ select: { id: true }, where: { id } })
    if (!exists) throw new NotFoundException('知识条目不存在')
  }

  private async createRevisionRecord(
    tx: Prisma.TransactionClient,
    input: {
      changeReason: string
      changeType: string
      editorId?: string | null
      knowledgeId: string
      newEntry: Prisma.AiKnowledgeEntryGetPayload<Record<string, never>>
      oldSnapshot: Prisma.InputJsonValue
    },
  ) {
    const version = ((await tx.aiKnowledgeRevision.aggregate({ _max: { version: true }, where: { knowledgeId: input.knowledgeId } }))._max.version ?? 0) + 1
    const newSnapshot = this.buildKnowledgeSnapshot(input.newEntry)
    return tx.aiKnowledgeRevision.create({
      data: {
        canonicalAnswer: input.newEntry.canonicalAnswer,
        canonicalQuestion: input.newEntry.canonicalQuestion,
        changeReason: input.changeReason,
        changeType: input.changeType,
        diffSummary: this.buildRevisionDiffSummary(input.oldSnapshot, newSnapshot),
        editorId: input.editorId,
        editorType: input.editorId ? 'ADMIN' : 'SYSTEM',
        knowledgeId: input.knowledgeId,
        newSnapshot,
        oldSnapshot: input.oldSnapshot,
        title: input.newEntry.title,
        version,
      },
    })
  }

  private buildKnowledgeSnapshot(entry: Prisma.AiKnowledgeEntryGetPayload<Record<string, never>>): Prisma.InputJsonValue {
    return {
      agentInjectEnabled: entry.agentInjectEnabled,
      canonicalAnswer: entry.canonicalAnswer,
      canonicalQuestion: entry.canonicalQuestion,
      category: entry.category,
      directAnswerEnabled: entry.directAnswerEnabled,
      maintenanceStatus: entry.maintenanceStatus,
      retrievalEnabled: entry.retrievalEnabled,
      roleScope: entry.roleScope,
      sensitivity: entry.sensitivity,
      status: entry.status,
      tags: entry.tags,
      title: entry.title,
      visibility: entry.visibility,
    }
  }

  private buildKnowledgeUpdateFromSnapshot(snapshot: Prisma.JsonValue): Prisma.AiKnowledgeEntryUncheckedUpdateInput {
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) throw new ConflictException('修订快照格式不正确')
    const value = snapshot as Record<string, unknown>
    return {
      agentInjectEnabled: Boolean(value.agentInjectEnabled),
      canonicalAnswer: String(value.canonicalAnswer ?? ''),
      canonicalQuestion: String(value.canonicalQuestion ?? ''),
      category: String(value.category ?? AiKnowledgeCategory.VULNERABILITY_REPORTING) as AiKnowledgeCategory,
      directAnswerEnabled: Boolean(value.directAnswerEnabled),
      maintenanceStatus: String(value.maintenanceStatus ?? AiKnowledgeMaintenanceStatus.HEALTHY) as AiKnowledgeMaintenanceStatus,
      retrievalEnabled: Boolean(value.retrievalEnabled),
      roleScope: String(value.roleScope ?? AiKnowledgeRoleScope.ALL) as AiKnowledgeRoleScope,
      sensitivity: String(value.sensitivity ?? AiKnowledgeSensitivity.INTERNAL) as AiKnowledgeSensitivity,
      status: String(value.status ?? AiKnowledgeStatus.APPROVED) as AiKnowledgeStatus,
      tags: Array.isArray(value.tags) ? value.tags.map(String).slice(0, 12) : [],
      title: String(value.title ?? '未命名知识'),
      visibility: String(value.visibility ?? AiKnowledgeVisibility.ROLE_ONLY) as AiKnowledgeVisibility,
    }
  }

  private buildRevisionDiffSummary(oldSnapshot: Prisma.InputJsonValue, newSnapshot: Prisma.InputJsonValue) {
    if (!oldSnapshot || !newSnapshot || typeof oldSnapshot !== 'object' || typeof newSnapshot !== 'object' || Array.isArray(oldSnapshot) || Array.isArray(newSnapshot)) return '知识快照已更新'
    const oldValue = oldSnapshot as Record<string, unknown>
    const newValue = newSnapshot as Record<string, unknown>
    const changed = ['title', 'canonicalQuestion', 'canonicalAnswer', 'status', 'maintenanceStatus', 'retrievalEnabled', 'directAnswerEnabled', 'agentInjectEnabled']
      .filter((key) => JSON.stringify(oldValue[key]) !== JSON.stringify(newValue[key]))
    return changed.length ? `更新字段：${changed.join('、')}` : '知识快照无可见字段变化'
  }

  async addFeedback(id: string, input: AiKnowledgeFeedbackInput, userId: string, userRole: RoleCode) {
    const entry = await this.prisma.aiKnowledgeEntry.findUnique({ where: { id } })
    if (!entry) throw new NotFoundException('知识条目不存在')
    if (!canRoleAccessKnowledge(userRole, entry)) throw new ForbiddenException('无权反馈该知识条目')

    return this.prisma.$transaction(async (tx) => {
      await tx.aiKnowledgeFeedback.create({ data: { knowledgeId: id, note: input.note, userId, value: input.value } })
      const updated = await tx.aiKnowledgeEntry.update({ data: getFeedbackIncrement(input.value), where: { id } })
      if (input.value === AiKnowledgeFeedbackValue.UNHELPFUL || input.value === AiKnowledgeFeedbackValue.REPORT_ABUSE) {
        const security = input.value === AiKnowledgeFeedbackValue.REPORT_ABUSE
        await tx.aiKnowledgeMaintenanceTask.upsert({
          create: {
            dedupeKey: `feedback:${security ? 'SECURITY' : 'LOW_QUALITY'}:${id}`,
            knowledgeId: id,
            priority: security ? 'P0' : 'P1',
            reason: security ? '用户举报知识内容，已立即暂停全部召回。' : '用户点踩知识内容，已立即停止直接回答。',
            taskType: security ? 'SECURITY' : 'LOW_QUALITY',
          },
          update: { status: 'OPEN' },
          where: { dedupeKey: `feedback:${security ? 'SECURITY' : 'LOW_QUALITY'}:${id}` },
        })
      }
      return updated
    })
  }

  async listMaintenanceTasks(query: AiKnowledgeMaintenanceListQuery) {
    const where: Prisma.AiKnowledgeMaintenanceTaskWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.taskType ? { taskType: query.taskType } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.knowledgeId ? { knowledgeId: query.knowledgeId } : {}),
    }
    const [total, items] = await Promise.all([
      this.prisma.aiKnowledgeMaintenanceTask.count({ where }),
      this.prisma.aiKnowledgeMaintenanceTask.findMany({
        include: {
          knowledge: {
            select: {
              agentInjectEnabled: true,
              category: true,
              directAnswerEnabled: true,
              id: true,
              maintenanceStatus: true,
              retrievalEnabled: true,
              status: true,
              title: true,
            },
          },
        },
        orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        where,
      }),
    ])
    return {
      items,
      pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.max(1, Math.ceil(total / query.pageSize)) },
    }
  }

  async resolveMaintenanceTask(
    id: string,
    input: AiKnowledgeMaintenanceResolveInput,
    actorId: string,
    meta: ClientRequestMeta = {},
  ) {
    return this.closeMaintenanceTask(id, input, actorId, meta, 'RESOLVE')
  }

  async dismissMaintenanceTask(
    id: string,
    input: AiKnowledgeMaintenanceResolveInput,
    actorId: string,
    meta: ClientRequestMeta = {},
  ) {
    return this.closeMaintenanceTask(id, input, actorId, meta, 'DISMISS')
  }

  private async closeMaintenanceTask(
    id: string,
    input: AiKnowledgeMaintenanceResolveInput,
    actorId: string,
    meta: ClientRequestMeta,
    operation: 'RESOLVE' | 'DISMISS',
  ) {
    return this.prisma.$transaction(async (tx) => {
      const task = await tx.aiKnowledgeMaintenanceTask.findUnique({ where: { id } })
      if (!task) throw new NotFoundException('维护任务不存在')
      if (task.status !== 'OPEN') {
        throw new ConflictException(operation === 'RESOLVE' ? '只有 OPEN 状态的任务可以解决' : '只有 OPEN 状态的任务可以忽略')
      }

      const operatorReason = input.reason
      const updated = await tx.aiKnowledgeMaintenanceTask.update({
        data: {
          reason: operatorReason
            ? `${task.reason}\n${operation === 'RESOLVE' ? '决议' : '忽略原因'}：${operatorReason}`
            : task.reason,
          resolvedAt: new Date(),
          status: operation === 'RESOLVE' ? 'RESOLVED' : 'DISMISSED',
        },
        where: { id },
      })

      await tx.auditLog.create({
        data: {
          action: 'CHANGE_SYSTEM_SETTING',
          actorId,
          ipAddress: meta.ipAddress,
          metadata: {
            dedupeKey: task.dedupeKey,
            knowledgeId: task.knowledgeId,
            operation,
            operatorReason: operatorReason ?? null,
            previousStatus: task.status,
            priority: task.priority,
            taskType: task.taskType,
          } as Prisma.InputJsonValue,
          requestPath: meta.requestPath,
          result: 'success',
          targetId: task.id,
          targetType: 'AiKnowledgeMaintenanceTask',
          userAgent: meta.userAgent,
        },
      })

      return updated
    })
  }
}

function mapRoleScopeToAiSpace(roleScope: AiKnowledgeRoleScope) {
  if (roleScope === AiKnowledgeRoleScope.ADMIN) return AiSpace.ADMIN
  if (roleScope === AiKnowledgeRoleScope.AUDITOR) return AiSpace.AUDITOR
  return AiSpace.STUDENT
}

function buildTopicKey(question: string) {
  return stableHash(tokenizeForSearch(question).filter((token) => !['安装', '配置', '报错', '失败', '问题'].includes(token)).slice(0, 6).join('|') || question.slice(0, 40))
}

function buildConversationTitle(question: string) {
  const compact = question.replace(/\s+/g, ' ').replace(/[？?。.!！]+$/g, '').slice(0, 72)
  if (/pikachu|皮卡丘/i.test(compact)) return 'Pikachu 靶场安装部署排错经验'
  if (/dvwa/i.test(compact)) return 'DVWA 靶场安装部署排错经验'
  if (/vulhub/i.test(compact)) return 'Vulhub 环境配置排错经验'
  return compact || 'AI 多轮问题解决经验'
}

function shouldSummarizeConversation(turnCount: number, question: string, answer: string) {
  const text = `${question}\n${answer}`
  const solved = /成功|解决了|好了|可以了|跑起来|部署好了|安装好了|finally|works/i.test(text)
  const troubleshooting = /报错|错误|失败|不兼容|版本|依赖|环境|docker|compose|php|mysql|脚本|日志|命令|端口/i.test(text)
  return (turnCount >= 3 && troubleshooting) || (turnCount >= 2 && solved)
}

function buildConversationLearningSummary(turns: Array<{ role: string; content: string }>) {
  const fullText = turns.map((turn) => `${turn.role}: ${turn.content}`).join('\n')
  const userMessages = turns.filter((turn) => turn.role === 'user').map((turn) => turn.content)
  const assistantMessages = turns.filter((turn) => turn.role === 'assistant').map((turn) => turn.content)
  const firstQuestion = userMessages[0] ?? ''
  const lastAnswer = assistantMessages.at(-1) ?? ''
  const title = buildConversationTitle(firstQuestion)
  const environmentNotes = extractLines(fullText, /(windows|wsl|linux|ubuntu|centos|docker|compose|php\s*\d|mysql|mariadb|nginx|apache|node|npm|python|端口|版本|兼容)/i, 8)
  const pitfalls = extractLines(fullText, /(报错|错误|失败|不兼容|permission denied|denied|not found|timeout|端口占用|版本|依赖|乱码|空白页|连接失败|启动失败)/i, 10)
  const successfulSteps = extractLines(assistantMessages.join('\n'), /(执行|运行|修改|配置|安装|重启|检查|确认|设置|创建|导入|访问|启动)/i, 12)
  const failedAttempts = extractLines(userMessages.join('\n'), /(还是|又|仍然|报错|失败|不行|不能|无法|不兼容|空白|连不上)/i, 8)
  const collectedEvidence = extractLines(fullText, /(日志|截图|报错|命令输出|状态码|版本|php -v|docker ps|端口|配置文件|路径|堆栈)/i, 8)
  const requiresTooling = /脚本|批量|扫描|收集|自动|命令输出|docker ps|php -v|检查系统|日志收集|诊断/i.test(fullText)
  const resolutionSummary = [
    `问题：${firstQuestion.slice(0, 500)}`,
    environmentNotes.length ? `环境/版本要点：${environmentNotes.join('；')}` : '',
    pitfalls.length ? `踩坑点：${pitfalls.join('；')}` : '',
    successfulSteps.length ? `最终有效步骤：${successfulSteps.join('；')}` : `最终回复要点：${lastAnswer.slice(0, 1200)}`,
  ].filter(Boolean).join('\n')
  return {
    autoDecisionReason: requiresTooling
      ? '多轮排错中出现脚本/命令/环境信息收集，建议先作为 Skill 候选由管理员二次审核。'
      : '多轮排错形成了可复用安装步骤和踩坑说明，建议进入 AI 知识库待审核。',
    collectedEvidence,
    environmentNotes,
    failedAttempts,
    pitfalls,
    requiresTooling,
    resolutionSummary,
    successfulSteps,
    title,
  }
}

async function requestConversationAiEvaluation(turns: Array<{ role: string; content: string }>, summary: ConversationLearningSummary): Promise<ConversationAiEvaluation> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), AI_KNOWLEDGE_EVALUATION_TIMEOUT_MS)
  const prompt = buildConversationEvaluationPrompt(turns, summary)
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const apiKey = getOpenAiApiKey()
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`

  try {
    const response = await fetch(new URL('chat/completions', getOpenAiBaseUrl()), {
      body: JSON.stringify({
        messages: [
          { role: 'system', content: '你是 CQUPT-SRC 的 AI 知识沉淀评分器。只输出严格 JSON，不要输出解释文本。' },
          { role: 'user', content: prompt },
        ],
        model: getOpenAiModel(),
        temperature: 0.1,
      }),
      headers,
      method: 'POST',
      signal: controller.signal,
    })
    const body = await readResponseBody(response)
    if (!response.ok) throw new Error(`AI评分接口失败：${response.status}`)
    const content = extractOpenAiContent(body)
    return parseConversationAiEvaluation(content)
  } finally {
    clearTimeout(timeout)
  }
}

function buildConversationEvaluationPrompt(turns: Array<{ role: string; content: string }>, summary: ConversationLearningSummary) {
  const compactTurns = turns
    .slice(-24)
    .map((turn) => `${turn.role}: ${turn.content.slice(0, 1200)}`)
    .join('\n---\n')
  return `请评估下面这段已脱敏的多轮 AI 助手会话是否适合沉淀。\n\n判定边界：\n1. KB：可复用的经验答案、安装排错、平台使用、漏洞报告写作、安全学习建议。\n2. SKILL：稳定流程/方法论，包含脚本、命令收集信息、批量诊断、多步骤工具化操作，先进入 Skill 候选，不允许自动安装。\n3. DISCARD：包含隐私/凭证/真实资产/越权/未解决/仅闲聊/复用价值低。\n\n评分 0-1：overallScore、kbScore、skillScore、safetyScore、privacyRiskScore、confidenceScore。privacyRiskScore 越高越危险。\n自动沉淀只允许：KB 且 overall>=${AI_KNOWLEDGE_AUTO_APPROVE_THRESHOLD} 且 kbScore>=0.82 且 safety>=0.86 且 privacyRisk<=0.16 且 confidence>=0.76。\n\n规则摘要：\n${JSON.stringify(summary, null, 2)}\n\n会话：\n${compactTurns}\n\n只返回 JSON：\n{\"suggestedKnowledgeType\":\"KB|SKILL|DISCARD\",\"overallScore\":0.0,\"kbScore\":0.0,\"skillScore\":0.0,\"safetyScore\":0.0,\"privacyRiskScore\":0.0,\"confidenceScore\":0.0,\"reason\":\"一句中文原因\",\"signals\":[\"证据\"],\"risks\":[\"风险\"]}`
}

function buildHeuristicConversationEvaluation(turns: Array<{ role: string; content: string }>, summary: ConversationLearningSummary): ConversationAiEvaluation {
  const fullText = turns.map((turn) => `${turn.role}: ${turn.content}`).join('\n')
  const hasSolvedSignal = /成功|解决了|好了|可以了|跑起来|部署好了|安装好了|works|fixed/i.test(fullText)
  const hasTroubleshooting = /报错|错误|失败|不兼容|版本|依赖|环境|docker|compose|php|mysql|端口|日志/i.test(fullText)
  const hasTooling = summary.requiresTooling || /脚本|批量|收集|自动化|扫描|诊断|命令输出|docker ps|php -v|日志收集/i.test(fullText)
  const hasSafetyRisk = shouldRejectForSafety(fullText)
  const evidenceScore = clampScore((summary.successfulSteps.length * 0.04) + (summary.pitfalls.length * 0.03) + (summary.environmentNotes.length * 0.025) + (summary.collectedEvidence.length * 0.02))
  const base = 0.48 + evidenceScore + (hasSolvedSignal ? 0.18 : 0) + (hasTroubleshooting ? 0.1 : 0)
  const privacyRiskScore = hasSafetyRisk ? 0.82 : clampScore(SENSITIVE_PATTERNS.filter((pattern) => pattern.test(fullText)).length * 0.24 + PROMPT_INJECTION_PATTERNS.filter((pattern) => pattern.test(fullText)).length * 0.3 + 0.06)
  const safetyScore = clampScore(0.94 - privacyRiskScore * 0.72)
  const kbScore = clampScore(base + (hasTooling ? -0.08 : 0.06))
  const skillScore = clampScore(base + (hasTooling ? 0.18 : -0.14))
  const suggestedKnowledgeType = privacyRiskScore > 0.45 || !hasTroubleshooting ? 'DISCARD' : hasTooling && skillScore >= kbScore ? 'SKILL' : 'KB'
  const overallScore = clampScore(Math.max(kbScore, skillScore) * 0.68 + safetyScore * 0.22 + (1 - privacyRiskScore) * 0.1)
  return {
    confidenceScore: clampScore(0.62 + evidenceScore * 0.32 + (hasSolvedSignal ? 0.08 : 0)),
    kbScore,
    overallScore,
    privacyRiskScore,
    reason: suggestedKnowledgeType === 'SKILL'
      ? '规则评分认为该会话包含可复用流程和命令/脚本/诊断信息，更适合进入 Skill 候选池。'
      : suggestedKnowledgeType === 'KB'
        ? '规则评分认为该会话已有明确问题、踩坑和有效步骤，适合沉淀为知识库。'
        : '规则评分认为该会话存在安全风险、未解决或复用价值不足，需人工判断。',
    risks: hasSafetyRisk ? ['检测到敏感信息或 prompt injection 风险'] : [],
    safetyScore,
    signals: [hasSolvedSignal ? '出现解决成功信号' : '', hasTroubleshooting ? '出现排错/环境信号' : '', hasTooling ? '出现工具化流程信号' : ''].filter(Boolean),
    skillScore,
    suggestedKnowledgeType,
  }
}

function mergeConversationEvaluations(heuristic: ConversationAiEvaluation, ai: ConversationAiEvaluation): ConversationAiEvaluation {
  const privacyRiskScore = Math.max(heuristic.privacyRiskScore, ai.privacyRiskScore)
  const safetyScore = Math.min(heuristic.safetyScore, ai.safetyScore)
  const suggestedKnowledgeType = privacyRiskScore > 0.42 || safetyScore < 0.68
    ? 'DISCARD'
    : ai.suggestedKnowledgeType === 'SKILL' || heuristic.suggestedKnowledgeType === 'SKILL'
      ? 'SKILL'
      : ai.suggestedKnowledgeType === 'KB' || heuristic.suggestedKnowledgeType === 'KB'
        ? 'KB'
        : 'DISCARD'
  return {
    confidenceScore: clampScore(ai.confidenceScore * 0.7 + heuristic.confidenceScore * 0.3),
    kbScore: clampScore(ai.kbScore * 0.7 + heuristic.kbScore * 0.3),
    overallScore: clampScore(ai.overallScore * 0.7 + heuristic.overallScore * 0.3),
    privacyRiskScore,
    reason: `AI评分：${ai.reason}；规则校验：${heuristic.reason}`,
    risks: [...new Set([...ai.risks, ...heuristic.risks])].slice(0, 8),
    safetyScore,
    signals: [...new Set([...ai.signals, ...heuristic.signals])].slice(0, 8),
    skillScore: clampScore(ai.skillScore * 0.7 + heuristic.skillScore * 0.3),
    suggestedKnowledgeType,
  }
}

function parseConversationAiEvaluation(content: string): ConversationAiEvaluation {
  const jsonText = extractJsonObject(content)
  const raw = JSON.parse(jsonText) as Partial<ConversationAiEvaluation>
  const type = raw.suggestedKnowledgeType === 'SKILL' || raw.suggestedKnowledgeType === 'DISCARD' ? raw.suggestedKnowledgeType : 'KB'
  return {
    confidenceScore: clampScore(Number(raw.confidenceScore)),
    kbScore: clampScore(Number(raw.kbScore)),
    overallScore: clampScore(Number(raw.overallScore)),
    privacyRiskScore: clampScore(Number(raw.privacyRiskScore)),
    reason: typeof raw.reason === 'string' ? raw.reason.slice(0, 800) : 'AI 已完成知识沉淀评分。',
    risks: Array.isArray(raw.risks) ? raw.risks.map(String).slice(0, 8) : [],
    safetyScore: clampScore(Number(raw.safetyScore)),
    signals: Array.isArray(raw.signals) ? raw.signals.map(String).slice(0, 8) : [],
    skillScore: clampScore(Number(raw.skillScore)),
    suggestedKnowledgeType: type,
  }
}

function buildMergeSuggestion(matches: SimilarKnowledgeMatch[], duplicateRiskScore: number) {
  if (matches.length === 0) return null
  const top = matches[0]
  if (duplicateRiskScore >= AI_KNOWLEDGE_DUPLICATE_STRONG_THRESHOLD) {
    return `高相似知识“${top.title}”（${Math.round(top.similarity * 100)}%）已存在，建议管理员优先合并踩坑点/环境差异，不要直接新增重复条目。`
  }
  if (duplicateRiskScore >= AI_KNOWLEDGE_DUPLICATE_REVIEW_THRESHOLD) {
    return `发现相似知识“${top.title}”（${Math.round(top.similarity * 100)}%），建议人工审核是否补充到既有条目或作为独立变体保留。`
  }
  return `发现 ${matches.length} 条弱相似知识，可作为审核参考。`
}

function shouldAutoApproveKnowledge(evaluation: ConversationAiEvaluation) {
  return evaluation.suggestedKnowledgeType === 'KB'
    && evaluation.overallScore >= AI_KNOWLEDGE_AUTO_APPROVE_THRESHOLD
    && evaluation.kbScore >= 0.82
    && evaluation.safetyScore >= 0.86
    && evaluation.privacyRiskScore <= 0.16
    && evaluation.confidenceScore >= 0.76
}

function shouldAutoRouteSkillCandidate(evaluation: ConversationAiEvaluation) {
  return evaluation.suggestedKnowledgeType === 'SKILL'
    && evaluation.overallScore >= 0.84
    && evaluation.skillScore >= 0.82
    && evaluation.safetyScore >= 0.82
    && evaluation.privacyRiskScore <= 0.18
    && evaluation.confidenceScore >= 0.72
}

function clampScore(value: number) {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0
}

function extractLines(text: string, pattern: RegExp, limit: number) {
  const lines = text
    .split(/\n+/)
    .map((line) => line.replace(/^[-*\d.\s>]+/, '').trim())
    .filter((line) => line.length >= 8 && line.length <= 260 && pattern.test(line))
  return [...new Set(lines)].slice(0, limit)
}

function renderConversationKnowledgeAnswer(conversation: {
  autoDecisionReason?: string | null
  collectedEvidence: string[]
  environmentNotes: string[]
  failedAttempts: string[]
  pitfalls: string[]
  resolutionSummary?: string | null
  successfulSteps: string[]
  suggestedKnowledgeType: string
}) {
  const section = (title: string, items: string[]) => items.length ? `\n## ${title}\n${items.map((item) => `- ${item}`).join('\n')}` : ''
  return `# 多轮问题解决沉淀\n\n${conversation.resolutionSummary ?? '本条目来自多轮 AI 助手排错会话，经管理员审核后沉淀。'}${section('最终有效步骤', conversation.successfulSteps)}${section('踩坑与不兼容点', conversation.pitfalls)}${section('环境/版本要点', conversation.environmentNotes)}${section('失败尝试', conversation.failedAttempts)}${section('证据/信息收集', conversation.collectedEvidence)}\n\n## 沉淀建议\n- 建议类型：${conversation.suggestedKnowledgeType}\n- 原因：${conversation.autoDecisionReason ?? '管理员审核通过'}\n\n## 安全边界\n- 内容已脱敏，不包含真实凭证、Cookie、Token 或私有资产。\n- 如涉及靶场部署，仅用于授权学习环境，不适用于未授权攻击真实目标。`
}

function canRoleAccessKnowledge(userRole: RoleCode, entry: { roleScope: AiKnowledgeRoleScope; sensitivity: AiKnowledgeSensitivity; status: AiKnowledgeStatus; visibility: AiKnowledgeVisibility }) {
  if (entry.status !== AiKnowledgeStatus.APPROVED && entry.status !== AiKnowledgeStatus.AUTO_APPROVED) return false
  if (entry.sensitivity !== AiKnowledgeSensitivity.PUBLIC && entry.sensitivity !== AiKnowledgeSensitivity.INTERNAL) return false
  if (entry.visibility !== AiKnowledgeVisibility.PLATFORM_PUBLIC && entry.visibility !== AiKnowledgeVisibility.ROLE_ONLY) return false
  if (entry.roleScope === AiKnowledgeRoleScope.ALL) return true
  return entry.roleScope === userRole
}

function getRoleScopes(aiSpace: AiSpace) {
  const roleScope = mapAiSpaceToRoleScope(aiSpace)
  return [roleScope, AiKnowledgeRoleScope.ALL]
}

function mapAiSpaceToRoleScope(aiSpace: AiSpace) {
  if (aiSpace === AiSpace.AUDITOR) return AiKnowledgeRoleScope.AUDITOR
  if (aiSpace === AiSpace.ADMIN) return AiKnowledgeRoleScope.ADMIN
  return AiKnowledgeRoleScope.STUDENT
}

function inferCategory(text: string) {
  for (const [category, pattern] of CATEGORY_KEYWORDS) {
    if (pattern.test(text)) return category
  }
  return AiKnowledgeCategory.VULNERABILITY_REPORTING
}

function inferTags(text: string) {
  const tags = new Set<string>()
  const lower = text.toLowerCase()
  for (const [category, pattern] of CATEGORY_KEYWORDS) {
    if (pattern.test(lower)) tags.add(category.toLowerCase())
  }
  for (const token of tokenizeForSearch(text).slice(0, 8)) tags.add(token)
  return [...tags].slice(0, 12)
}

function tokenizeForSearch(text: string) {
  const normalized = text.toLowerCase().replace(/[，。！？、；：,.!?;:()（）\[\]{}]/g, ' ')
  const latin = normalized.match(/[a-z0-9_-]{2,}/g) ?? []
  const chinese = normalized.match(/[\u4e00-\u9fff]{2,}/g) ?? []
  const chineseBigrams = chinese.flatMap((word) => [...word].map((_, index, chars) => chars.slice(index, index + 2).join('')).filter((item) => item.length === 2))
  return [...new Set([...latin, ...chinese, ...chineseBigrams].filter((token) => !isStopToken(token)))].slice(0, 30)
}

function isStopToken(token: string) {
  return ['怎么', '如何', '什么', '这个', '一个', '可以', '需要', '漏洞', '报告', '平台'].includes(token)
}

function scoreKnowledgeHit(question: string, tokens: string[], entry: { title: string; canonicalQuestion: string; canonicalAnswer: string; tags: string[] }) {
  const corpus = `${entry.title}\n${entry.canonicalQuestion}\n${entry.canonicalAnswer}\n${entry.tags.join(' ')}`.toLowerCase()
  const matched = tokens.filter((token) => corpus.includes(token)).length
  const titleBoost = tokens.some((token) => entry.title.toLowerCase().includes(token)) ? 0.15 : 0
  const exactBoost = corpus.includes(question.toLowerCase().slice(0, 80)) ? 0.2 : 0
  return Math.min(1, matched / Math.max(tokens.length, 1) + titleBoost + exactBoost)
}

function redactSensitiveText(text: string) {
  return text
    .replace(/https?:\/\/localhost\s*:\s*\[TARGET_HOST\]/gi, 'http://localhost')
    .replace(/(?:GET|POST|PUT|DELETE|PATCH)\s+\/[^\s]*\s+HTTP\/1\.[01][\s\S]*?(?=\n\n|$)/gi, '[PRIVATE_REQUEST]')
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/gi, '[PRIVATE_ATTACHMENT]')
    .replace(/authorization\s*:\s*[^\n\r]+/gi, 'Authorization: [REDACTED]')
    .replace(/(?:set-cookie|cookie)\s*:\s*[^\n\r]+/gi, 'Cookie: [REDACTED]')
    .replace(/bearer\s+[a-z0-9._~+/=-]{12,}/gi, 'Bearer [REDACTED]')
    .replace(/(password|api[_-]?key|secret|client_secret|secret_key|private_key|token|access_token|refresh_token|session[_-]?id)\s*([=:：])\s*\S+/gi, '$1$2 [REDACTED]')
    .replace(/postgres(?:ql)?:\/\/[^\s"'<>，。]+/gi, '[DATABASE_URL]')
    .replace(/https?:\/\/(?!localhost\b|127\.0\.0\.1\b|example\.(?:com|org|net)\b)[^\s"'<>，。]+/gi, '[TARGET_URL]')
    .replace(/(^|[\r\n])host\s*:\s*(?!localhost\b|127\.0\.0\.1\b|\[TARGET_HOST\])[^\n\r，。]+/gi, '$1Host: [TARGET_HOST]')
    .replace(/(?:10|127|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.\d{1,3}\.\d{1,3}/g, '[REDACTED_IP]')
    .replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, (email) => maskEmail(email))
    .replace(/(?:\+?86[-\s]?)?1[3-9]\d{9}\b/g, (phone) => `${phone.slice(0, 3)}****${phone.slice(-4)}`)
    .replace(/(?:[A-Za-z]:\\|\/home\/|\/Users\/|\/var\/www\/|\/opt\/)[^\s"'<>，。]+/g, '[LOCAL_PATH]')
    .trim()
}

function shouldRejectForSafety(text: string) {
  const inspect = normalizeTextForSafetyCheck(text)
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(inspect)) || PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(inspect))
}

function getRejectionReason(question: string, answer: string) {
  const text = normalizeTextForSafetyCheck(`${redactSensitiveText(question)}\n${redactSensitiveText(answer)}`)
  if (SENSITIVE_PATTERNS.some((pattern) => pattern.test(text))) return '包含敏感凭证或未脱敏资产'
  if (PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(text))) return '疑似 prompt injection'
  if (answer.length < 80) return '回答过短，复用价值不足'
  return null
}

function normalizeTextForSafetyCheck(text: string) {
  return text
    .replace(/https?:\/\/localhost\s*:\s*\[TARGET_HOST\]/gi, '')
    .replace(/authorization\s*:\s*\[REDACTED\]/gi, '')
    .replace(/(?:set-cookie|cookie)\s*:\s*\[REDACTED\]/gi, '')
    .replace(/bearer\s+\[REDACTED\]/gi, '')
    .replace(/(password|api[_-]?key|secret|client_secret|secret_key|private_key|token|access_token|refresh_token|session[_-]?id)\s*[=:：]\s*\[REDACTED\]/gi, '')
    .replace(/host\s*:\s*\[TARGET_HOST\]/gi, '')
    .replace(/\[(REDACTED|TARGET_URL|TARGET_HOST|DATABASE_URL|LOCAL_PATH|PRIVATE_REQUEST|PRIVATE_ATTACHMENT|REDACTED_IP)\]/gi, '')
}

function maskEmail(email: string) {
  const [name, domain] = email.split('@')
  if (!name || !domain) return '***@***'
  return `${name.slice(0, 1)}***@${domain}`
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

async function readResponseBody(response: Response) {
  const contentType = response.headers.get('content-type') ?? ''
  return contentType.includes('application/json') ? response.json() : response.text()
}

function extractOpenAiContent(body: unknown) {
  const choices = body && typeof body === 'object' ? (body as { choices?: unknown }).choices : null
  if (!Array.isArray(choices)) return ''
  const first = choices[0] as { message?: { content?: unknown }; text?: unknown } | undefined
  return typeof first?.message?.content === 'string' ? first.message.content : typeof first?.text === 'string' ? first.text : ''
}

function extractJsonObject(content: string) {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]
  const candidate = (fenced ?? content).trim()
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('AI评分未返回JSON对象')
  return candidate.slice(start, end + 1)
}

function buildSimilarityKey(question: string) {
  return stableHash(tokenizeForSearch(question).slice(0, 12).join('|'))
}

function buildTitle(question: string, category: AiKnowledgeCategory) {
  const compact = question.replace(/\s+/g, ' ').slice(0, 60)
  return compact || `${category} 知识条目`
}

function getFeedbackIncrement(value: AiKnowledgeFeedbackValue): Prisma.AiKnowledgeEntryUpdateInput {
  if (value === AiKnowledgeFeedbackValue.HELPFUL) return { helpfulCount: { increment: 1 } }
  if (value === AiKnowledgeFeedbackValue.UNHELPFUL) return {
    directAnswerEnabled: false,
    maintenanceStatus: AiKnowledgeMaintenanceStatus.LOW_QUALITY_REVIEW,
    unhelpfulCount: { increment: 1 },
  }
  return {
    abuseReportCount: { increment: 1 },
    agentInjectEnabled: false,
    directAnswerEnabled: false,
    maintenanceStatus: AiKnowledgeMaintenanceStatus.SECURITY_SUSPENDED,
    retrievalEnabled: false,
    status: AiKnowledgeStatus.NEEDS_REVIEW,
  }
}

function isUniqueConstraintError(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'P2002'
}
