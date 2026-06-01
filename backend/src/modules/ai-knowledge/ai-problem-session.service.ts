import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { createHash } from 'crypto'
import {
  AiKnowledgeCategory,
  AiKnowledgeRoleScope,
  AiKnowledgeSensitivity,
  AiKnowledgeSource,
  AiKnowledgeStatus,
  AiKnowledgeVisibility,
  AiProblemSessionStatus,
  AiSpace,
  Prisma,
} from '@prisma/client'
import { AuthenticatedRequestUser } from '../auth/auth.types'
import { PrismaService } from '../prisma/prisma.service'

type AiProblemSessionMode = 'student' | 'auditor' | 'admin'

type CreateProblemSessionInput = {
  initialQuestion?: string
  mode?: AiProblemSessionMode
}

type ResolveProblemSessionInput = {
  note?: string
}

type ReviewProblemSessionInput = {
  note?: string
  status: 'APPROVED_TO_KB' | 'SKILL_CANDIDATE' | 'DISCARDED'
}

type ProblemSessionSummary = {
  problem: string
  environment: string[]
  successfulSteps: string[]
  failedAttempts: string[]
  pitfalls: string[]
  applicableScope: string[]
  nonApplicableScope: string[]
  resolution: string
  scores: {
    confidence: number
    poisoningRisk: number
    privacy: number
    quality: number
    reuse: number
    safety: number
  }
  scoreDetails: {
    modelSuggested: boolean
    ruleFlags: string[]
    scoringVersion: string
  }
  recommendation: 'KB' | 'SKILL' | 'DISCARD'
  rejectionReason?: string
  similarKnowledgeMatches: Array<{
    id: string
    similarity: number
    status: AiKnowledgeStatus
    title: string
  }>
  mergeSuggestion?: string
}

const CONTINUABLE_STATUSES = new Set<AiProblemSessionStatus>([
  AiProblemSessionStatus.ACTIVE,
  AiProblemSessionStatus.AWAITING_RESOLUTION,
])

const DUPLICATE_REVIEW_THRESHOLD = 0.72

@Injectable()
export class AiProblemSessionService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(input: CreateProblemSessionInput, user: AuthenticatedRequestUser) {
    const mode = normalizeMode(input.mode)
    const initialQuestion = redactSensitiveText(input.initialQuestion?.trim() || '新问题会话')
    const existing = await this.prisma.aiProblemSession.findFirst({
      orderBy: { updatedAt: 'desc' },
      where: {
        mode,
        status: AiProblemSessionStatus.ACTIVE,
        userId: user.id,
      },
    })
    if (existing) return serializeProblemSession(existing)

    const session = await this.prisma.aiProblemSession.create({
      data: {
        aiSpace: getAiSpace(mode),
        initialQuestion,
        mode,
        title: buildProblemSessionTitle(initialQuestion),
        topicKey: buildTopicKey(initialQuestion),
        userId: user.id,
      },
    })
    return serializeProblemSession(session)
  }

  async getActive(user: AuthenticatedRequestUser, mode: AiProblemSessionMode = 'student') {
    const normalizedMode = normalizeMode(mode)
    const session = await this.prisma.aiProblemSession.findFirst({
      orderBy: { updatedAt: 'desc' },
      where: {
        mode: normalizedMode,
        status: { in: [AiProblemSessionStatus.ACTIVE, AiProblemSessionStatus.AWAITING_RESOLUTION] },
        userId: user.id,
      },
    })
    return session ? serializeProblemSession(session) : null
  }

  async getHistory(user: AuthenticatedRequestUser, limit = 30) {
    const sessions = await this.prisma.aiProblemSession.findMany({
      orderBy: { updatedAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 100),
      where: { userId: user.id },
    })
    return sessions.map(serializeProblemSession)
  }

  async listReviewQueue(query: { page: number; pageSize: number; status?: AiProblemSessionStatus }) {
    const where: Prisma.AiProblemSessionWhereInput = {
      status: query.status ?? { in: [AiProblemSessionStatus.READY_REVIEW, AiProblemSessionStatus.RESOLVED, AiProblemSessionStatus.SKILL_CANDIDATE] },
    }
    const [total, items] = await Promise.all([
      this.prisma.aiProblemSession.count({ where }),
      this.prisma.aiProblemSession.findMany({
        include: { turns: { orderBy: { createdAt: 'asc' }, take: 40 } },
        orderBy: { updatedAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        where,
      }),
    ])
    return { items: items.map(serializeProblemSession), pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.max(1, Math.ceil(total / query.pageSize)) } }
  }

  async getById(id: string, user: AuthenticatedRequestUser) {
    const session = await this.getOwnedSession(id, user.id, true)
    return serializeProblemSession(session)
  }

  async heartbeat(id: string, user: AuthenticatedRequestUser) {
    await this.assertOwnedSession(id, user.id)
    const session = await this.prisma.aiProblemSession.update({
      data: { lastActiveAt: new Date() },
      where: { id },
    })
    return serializeProblemSession(session)
  }

  async leave(id: string, user: AuthenticatedRequestUser) {
    await this.assertOwnedSession(id, user.id)
    const session = await this.prisma.aiProblemSession.update({
      data: {
        lastActiveAt: new Date(),
        leftAt: new Date(),
        status: AiProblemSessionStatus.AWAITING_RESOLUTION,
      },
      where: { id },
    })
    return serializeProblemSession(session)
  }

  async resolve(id: string, input: ResolveProblemSessionInput, user: AuthenticatedRequestUser) {
    await this.assertOwnedSession(id, user.id)
    const note = input.note ? redactSensitiveText(input.note).slice(0, 2000) : undefined
    await this.prisma.aiProblemSession.update({
      data: {
        closedAt: new Date(),
        lastActiveAt: new Date(),
        resolvedAt: new Date(),
        resolutionByUser: true,
        status: AiProblemSessionStatus.RESOLVED,
        userOutcomeNote: note,
      },
      where: { id },
    })
    return this.summarizeResolvedSession(id)
  }

  async discard(id: string, user: AuthenticatedRequestUser) {
    await this.assertOwnedSession(id, user.id)
    const session = await this.prisma.aiProblemSession.update({
      data: {
        closedAt: new Date(),
        lastActiveAt: new Date(),
        resolutionByUser: false,
        status: AiProblemSessionStatus.DISCARDED,
      },
      where: { id },
    })
    return serializeProblemSession(session)
  }

  async summarizeResolvedSession(id: string) {
    const session = await this.prisma.aiProblemSession.findUnique({
      include: { turns: { orderBy: { createdAt: 'asc' }, take: 100 } },
      where: { id },
    })
    if (!session) throw new NotFoundException('问题会话不存在')
    const summarizableStatuses = new Set<AiProblemSessionStatus>([
      AiProblemSessionStatus.RESOLVED,
      AiProblemSessionStatus.READY_REVIEW,
      AiProblemSessionStatus.SKILL_CANDIDATE,
    ])
    if (!summarizableStatuses.has(session.status)) {
      throw new BadRequestException('只有用户确认已解决的问题会话可以总结')
    }
    if (!session.resolutionByUser) {
      throw new BadRequestException('未由用户确认解决的问题会话不能进入知识沉淀')
    }
    if (session.turns.length < 2) {
      throw new BadRequestException('问题会话轮次不足，不能总结')
    }

    const summary = await this.buildResolvedSessionSummary(session)
    validateProblemSessionSummary(summary)
    const topicKey = buildTopicKey(summary.problem)
    const cluster = await this.updateKnowledgeCluster(session, summary, topicKey)
    const updated = await this.prisma.aiProblemSession.update({
      data: {
        clusterId: cluster?.id,
        duplicateRiskScore: summary.similarKnowledgeMatches[0]?.similarity ?? 0,
        summaryJson: summary as unknown as Prisma.InputJsonValue,
        title: buildProblemSessionTitle(summary.problem),
        topicKey,
        status: AiProblemSessionStatus.READY_REVIEW,
      },
      include: { turns: { orderBy: { createdAt: 'asc' }, take: 100 } },
      where: { id },
    })
    return serializeProblemSession(updated)
  }

  async reviewResolvedSession(id: string, input: ReviewProblemSessionInput, reviewerId: string) {
    const session = await this.prisma.aiProblemSession.findUnique({
      include: { turns: { orderBy: { createdAt: 'asc' }, take: 100 } },
      where: { id },
    })
    if (!session) throw new NotFoundException('问题会话不存在')
    if (!session.resolutionByUser) throw new BadRequestException('未确认解决的问题会话不能审核沉淀')

    if (input.status === 'DISCARDED') {
      const discarded = await this.prisma.aiProblemSession.update({
        data: { closedAt: new Date(), status: AiProblemSessionStatus.DISCARDED },
        include: { turns: { orderBy: { createdAt: 'asc' }, take: 100 } },
        where: { id },
      })
      return serializeProblemSession(discarded)
    }

    if (!session.summaryJson) await this.summarizeResolvedSession(id)
    const fresh = await this.prisma.aiProblemSession.findUnique({ include: { turns: { orderBy: { createdAt: 'asc' }, take: 100 } }, where: { id } })
    if (!fresh) throw new NotFoundException('问题会话不存在')
    const summary = parseProblemSessionSummary(fresh.summaryJson)

    if (input.status === 'SKILL_CANDIDATE') {
      const marked = await this.prisma.aiProblemSession.update({
        data: {
          summaryJson: { ...(summary as object), reviewNote: input.note, reviewedById: reviewerId } as Prisma.InputJsonValue,
          status: AiProblemSessionStatus.SKILL_CANDIDATE,
        },
        include: { turns: { orderBy: { createdAt: 'asc' }, take: 100 } },
        where: { id },
      })
      return serializeProblemSession(marked)
    }

    if (summary.recommendation === 'DISCARD' || summary.rejectionReason) {
      throw new BadRequestException(`该会话不适合沉淀：${summary.rejectionReason ?? '评分不足或复用价值不足'}`)
    }

    const knowledge = await this.createKnowledgeEntryFromProblemSession(fresh, summary, reviewerId, input.note)
    const approved = await this.prisma.aiProblemSession.update({
      data: {
        closedAt: new Date(),
        knowledgeEntryId: knowledge.id,
        status: AiProblemSessionStatus.APPROVED_TO_KB,
      },
      include: { turns: { orderBy: { createdAt: 'asc' }, take: 100 } },
      where: { id },
    })
    return serializeProblemSession(approved)
  }

  async recordChatTurnPair(input: {
    answer: string
    hasAttachment: boolean
    question: string
    sessionId?: string
    user: AuthenticatedRequestUser
  }) {
    if (!input.sessionId) return null
    const session = await this.getOwnedSession(input.sessionId, input.user.id)
    if (!CONTINUABLE_STATUSES.has(session.status)) {
      throw new BadRequestException('当前问题会话已结束，请开启新的对话')
    }

    const question = redactSensitiveText(input.question).slice(0, 6000)
    const answer = redactSensitiveText(input.answer).slice(0, 8000)
    const titleUpdate = session.initialQuestion === '新问题会话' || !session.title
      ? {
          initialQuestion: question,
          title: buildProblemSessionTitle(question),
          topicKey: buildTopicKey(question),
        }
      : {}

    const [userTurn, assistantTurn] = await this.prisma.$transaction(async (tx) => {
      const createdUserTurn = await tx.aiProblemSessionTurn.create({
        data: {
          contentHash: stableHash(`${session.id}:user:${question}:${Date.now()}`),
          hasAttachment: input.hasAttachment,
          role: 'user',
          sanitizedText: question,
          sessionId: session.id,
        },
      })
      const createdAssistantTurn = await tx.aiProblemSessionTurn.create({
        data: {
          contentHash: stableHash(`${session.id}:assistant:${answer}:${Date.now()}`),
          role: 'assistant',
          sanitizedText: answer,
          sessionId: session.id,
        },
      })
      await tx.aiProblemSession.update({
        data: {
          ...titleUpdate,
          lastActiveAt: new Date(),
          status: AiProblemSessionStatus.ACTIVE,
          tokenEstimate: { increment: estimateTokens(question) + estimateTokens(answer) },
          turnCount: { increment: 2 },
        },
        where: { id: session.id },
      })
      return [createdUserTurn, createdAssistantTurn]
    })

    return {
      assistantTurnId: assistantTurn.id,
      sessionId: session.id,
      userTurnId: userTurn.id,
    }
  }

  private async assertOwnedSession(id: string, userId: string) {
    await this.getOwnedSession(id, userId)
  }

  private async getOwnedSession(id: string, userId: string, includeTurns = false) {
    const session = await this.prisma.aiProblemSession.findUnique({
      include: includeTurns ? { turns: { orderBy: { createdAt: 'asc' }, take: 100 } } : undefined,
      where: { id },
    })
    if (!session) throw new NotFoundException('问题会话不存在')
    if (session.userId !== userId) throw new ForbiddenException('无权访问该问题会话')
    return session
  }

  private async buildResolvedSessionSummary(session: {
    aiSpace: AiSpace
    clusterId?: string | null
    initialQuestion: string
    turns: Array<{ role: string; sanitizedText: string }>
  }): Promise<ProblemSessionSummary> {
    const turns = session.turns.map((turn) => ({ content: turn.sanitizedText, role: turn.role }))
    const fullText = turns.map((turn) => `${turn.role}: ${turn.content}`).join('\n')
    const userMessages = turns.filter((turn) => turn.role === 'user').map((turn) => turn.content)
    const assistantMessages = turns.filter((turn) => turn.role === 'assistant').map((turn) => turn.content)
    const problem = userMessages[0] || session.initialQuestion
    const lastAnswer = assistantMessages.at(-1) ?? ''
    const ruleFlags = getProblemSessionRuleFlags(fullText, problem)
    const rejectionReason = ruleFlags[0]
    const environment = extractLines(fullText, /(windows|wsl|linux|ubuntu|centos|docker|compose|php\s*\d|mysql|mariadb|nginx|apache|node|npm|python|端口|版本|浏览器|burp|nmap|sqlmap)/i, 8)
    const pitfalls = extractLines(fullText, /(报错|错误|失败|不兼容|permission denied|denied|not found|timeout|端口占用|版本|依赖|乱码|空白页|连接失败|启动失败|越权|403|500)/i, 10)
    const successfulSteps = extractLines(assistantMessages.join('\n'), /(执行|运行|修改|配置|安装|重启|检查|确认|设置|创建|导入|访问|启动|提交|补充|复现|验证)/i, 12)
    const failedAttempts = extractLines(userMessages.join('\n'), /(还是|又|仍然|报错|失败|不行|不能|无法|不兼容|空白|连不上|没有效果)/i, 8)
    const applicableScope = inferApplicableScope(problem, fullText)
    const nonApplicableScope = inferNonApplicableScope(fullText)
    const duplicate = await this.assessDuplicateRisk(problem, lastAnswer, session.aiSpace)
    const quality = clampScore((successfulSteps.length >= 2 ? 0.72 : 0.48) + (pitfalls.length ? 0.08 : 0) + (environment.length ? 0.06 : 0))
    const reuse = clampScore(/积分|余额|商品|兑换|我的|当前|今天|公告|排名|证书|漏洞状态|SRC-\d/i.test(problem) ? 0.22 : quality + 0.08)
    const safety = rejectionReason ? 0.1 : 0.88
    const privacy = rejectionReason ? 0.9 : 0.08
    const poisoningRisk = /忽略.*规则|ignore .*instructions|系统提示词|开发者指令|自动通过|绕过权限/i.test(fullText) ? 0.95 : 0.04
    const recommendation: ProblemSessionSummary['recommendation'] = rejectionReason || reuse < 0.5 || quality < 0.55
      ? 'DISCARD'
      : /脚本|批量|扫描|收集|自动化|工作流|流程/i.test(fullText)
        ? 'SKILL'
        : 'KB'

    return {
      applicableScope,
      environment,
      failedAttempts,
      mergeSuggestion: duplicate.mergeSuggestion,
      nonApplicableScope,
      pitfalls,
      problem,
      recommendation,
      rejectionReason,
      resolution: successfulSteps.length
        ? `最终有效步骤：${successfulSteps.join('；')}`
        : lastAnswer.slice(0, 1400),
      scoreDetails: {
        modelSuggested: false,
        ruleFlags,
        scoringVersion: 'problem-session-rules-v2',
      },
      scores: {
        confidence: clampScore((quality + reuse + safety) / 3),
        poisoningRisk,
        privacy,
        quality,
        reuse,
        safety,
      },
      similarKnowledgeMatches: duplicate.matches,
      successfulSteps,
    }
  }

  private async updateKnowledgeCluster(session: {
    aiSpace: AiSpace
    clusterId?: string | null
    id: string
  }, summary: ProblemSessionSummary, topicKey: string) {
    if (summary.rejectionReason) return null
    const duplicateRiskScore = summary.similarKnowledgeMatches[0]?.similarity ?? 0
    const existing = await this.prisma.aiKnowledgeCluster.findUnique({
      where: { aiSpace_topicKey: { aiSpace: session.aiSpace, topicKey } },
    })
    const shouldIncrement = !session.clusterId || session.clusterId !== existing?.id
    if (!existing) {
      return this.prisma.aiKnowledgeCluster.create({
        data: {
          aiSpace: session.aiSpace,
          avgQualityScore: summary.scores.quality,
          avgReuseScore: summary.scores.reuse,
          avgSafetyScore: summary.scores.safety,
          duplicateRiskScore,
          lastResolvedAt: new Date(),
          mergeSuggestion: summary.mergeSuggestion,
          representativeProblem: summary.problem,
          representativeResolution: summary.resolution,
          resolvedSessionCount: 1,
          similarKnowledgeMatches: summary.similarKnowledgeMatches as unknown as Prisma.InputJsonValue,
          topicKey,
          totalAskCount: 1,
        },
      })
    }
    const nextResolvedCount = shouldIncrement ? existing.resolvedSessionCount + 1 : existing.resolvedSessionCount
    const nextTotalAskCount = shouldIncrement ? existing.totalAskCount + 1 : existing.totalAskCount
    const average = (current: number, incoming: number) => shouldIncrement
      ? clampScore(((current * existing.resolvedSessionCount) + incoming) / Math.max(nextResolvedCount, 1))
      : incoming
    return this.prisma.aiKnowledgeCluster.update({
      data: {
        avgQualityScore: average(existing.avgQualityScore, summary.scores.quality),
        avgReuseScore: average(existing.avgReuseScore, summary.scores.reuse),
        avgSafetyScore: average(existing.avgSafetyScore, summary.scores.safety),
        duplicateRiskScore,
        lastResolvedAt: new Date(),
        mergeSuggestion: summary.mergeSuggestion,
        representativeProblem: summary.problem,
        representativeResolution: summary.resolution,
        resolvedSessionCount: nextResolvedCount,
        similarKnowledgeMatches: summary.similarKnowledgeMatches as unknown as Prisma.InputJsonValue,
        totalAskCount: nextTotalAskCount,
      },
      where: { id: existing.id },
    })
  }

  private async assessDuplicateRisk(problem: string, answer: string, aiSpace: AiSpace) {
    const tokens = tokenizeForSearch(`${problem}\n${answer}`)
    if (!tokens.length) return { matches: [], mergeSuggestion: undefined }
    const roleScope = mapAiSpaceToRoleScope(aiSpace)
    const entries = await this.prisma.aiKnowledgeEntry.findMany({
      orderBy: [{ helpfulCount: 'desc' }, { hitCount: 'desc' }, { updatedAt: 'desc' }],
      take: 12,
      where: {
        roleScope: { in: [roleScope, AiKnowledgeRoleScope.ALL] },
        sensitivity: { in: [AiKnowledgeSensitivity.PUBLIC, AiKnowledgeSensitivity.INTERNAL] },
        status: { in: [AiKnowledgeStatus.APPROVED, AiKnowledgeStatus.AUTO_APPROVED, AiKnowledgeStatus.PROMOTED_TO_SKILL, AiKnowledgeStatus.NEEDS_REVIEW] },
        OR: tokens.slice(0, 8).flatMap((token) => [
          { title: { contains: token, mode: 'insensitive' as const } },
          { canonicalQuestion: { contains: token, mode: 'insensitive' as const } },
          { canonicalAnswer: { contains: token, mode: 'insensitive' as const } },
          { tags: { has: token } },
        ]),
      },
    })
    const matches = entries
      .map((entry) => ({
        id: entry.id,
        similarity: scoreTextSimilarity(`${problem}\n${answer}`, tokens, `${entry.title}\n${entry.canonicalQuestion}\n${entry.canonicalAnswer}`),
        status: entry.status,
        title: entry.title,
      }))
      .filter((match) => match.similarity >= 0.42)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5)
    const top = matches[0]?.similarity ?? 0
    return {
      matches,
      mergeSuggestion: top >= DUPLICATE_REVIEW_THRESHOLD ? `发现相似知识，重复风险 ${Math.round(top * 100)}%，建议人工合并或补充差异点。` : undefined,
    }
  }

  private async createKnowledgeEntryFromProblemSession(session: {
    aiSpace: AiSpace
    id: string
    userId: string | null
  }, summary: ProblemSessionSummary, reviewerId: string, reviewNote?: string) {
    const question = redactSensitiveText(summary.problem)
    const answer = redactSensitiveText(renderProblemSessionKnowledgeAnswer(summary))
    const rejectionReason = getProblemSessionRejectionReason(`${question}\n${answer}`)
    if (rejectionReason) throw new BadRequestException(`会话总结未通过安全沉淀检查：${rejectionReason}`)
    const sourceHash = stableHash(`problem-session:${session.id}:${stableHash(answer)}`)
    const category = inferCategory(`${question}\n${answer}`)
    const roleScope = mapAiSpaceToRoleScope(session.aiSpace)

    try {
      return await this.prisma.aiKnowledgeEntry.create({
        data: {
          answerQualityScore: summary.scores.quality,
          canonicalAnswer: answer,
          canonicalQuestion: question,
          category,
          confidenceScore: summary.scores.confidence,
          educationalValueScore: 0.82,
          generalityScore: summary.scores.reuse,
          platformRelevanceScore: 0.82,
          privacyRiskScore: summary.scores.privacy,
          reuseValueScore: summary.scores.reuse,
          reviewedAt: new Date(),
          reviewedById: reviewerId,
          reviewNote,
          roleScope,
          safetyScore: summary.scores.safety,
          sanitizedInputHash: stableHash(question),
          sensitivity: AiKnowledgeSensitivity.INTERNAL,
          similarityKey: buildTopicKey(question),
          source: AiKnowledgeSource.USER_CHAT,
          sourceHash,
          sourceUserId: session.userId ?? undefined,
          status: AiKnowledgeStatus.APPROVED,
          summary: summary.resolution,
          tags: tokenizeForSearch(`${question}\n${answer}`).slice(0, 8),
          title: buildProblemSessionTitle(question),
          visibility: AiKnowledgeVisibility.ROLE_ONLY,
        },
      })
    } catch (error) {
      if (isUniqueConstraintError(error)) throw new BadRequestException('相同问题会话知识已存在')
      throw error
    }
  }
}

function serializeProblemSession<T extends {
  clusterId: string | null
  closedAt: Date | null
  createdAt: Date
  duplicateRiskScore: number
  id: string
  initialQuestion: string
  knowledgeEntryId: string | null
  lastActiveAt: Date
  leftAt: Date | null
  mode: string
  resolvedAt: Date | null
  startedAt: Date
  status: AiProblemSessionStatus
  summaryJson: Prisma.JsonValue | null
  title: string | null
  turnCount: number
  updatedAt: Date
  userOutcomeNote: string | null
  turns?: Array<{ createdAt: Date; id: string; role: string; sanitizedText: string }>
}>(session: T) {
  return {
    closedAt: session.closedAt?.toISOString() ?? null,
    clusterId: session.clusterId,
    createdAt: session.createdAt.toISOString(),
    duplicateRiskScore: session.duplicateRiskScore,
    id: session.id,
    initialQuestion: session.initialQuestion,
    knowledgeEntryId: session.knowledgeEntryId,
    lastActiveAt: session.lastActiveAt.toISOString(),
    leftAt: session.leftAt?.toISOString() ?? null,
    mode: session.mode,
    resolvedAt: session.resolvedAt?.toISOString() ?? null,
    shouldAskResolution: session.status === AiProblemSessionStatus.AWAITING_RESOLUTION,
    startedAt: session.startedAt.toISOString(),
    status: session.status,
    summaryJson: session.summaryJson,
    title: session.title,
    turnCount: session.turnCount,
    turns: session.turns?.map((turn) => ({
      content: turn.sanitizedText,
      createdAt: turn.createdAt.toISOString(),
      id: turn.id,
      role: turn.role,
    })),
    updatedAt: session.updatedAt.toISOString(),
    userOutcomeNote: session.userOutcomeNote,
  }
}

function normalizeMode(mode: AiProblemSessionMode | undefined): AiProblemSessionMode {
  if (mode === 'auditor' || mode === 'admin') return mode
  return 'student'
}

function getAiSpace(mode: AiProblemSessionMode) {
  if (mode === 'auditor') return AiSpace.AUDITOR
  if (mode === 'admin') return AiSpace.ADMIN
  return AiSpace.STUDENT
}

function buildProblemSessionTitle(question: string) {
  const compact = question.replace(/\s+/g, ' ').replace(/[？?。.!！]+$/g, '').slice(0, 72)
  return compact || '新问题会话'
}

function buildTopicKey(question: string) {
  return stableHash(question.toLowerCase().replace(/\s+/g, ' ').slice(0, 120))
}

function estimateTokens(text: string) {
  return Math.max(1, Math.ceil(text.length / 2))
}

function stableHash(text: string) {
  return createHash('sha256').update(text).digest('hex')
}

function parseProblemSessionSummary(value: Prisma.JsonValue | null): ProblemSessionSummary {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException('问题会话总结不存在或格式不正确')
  }
  const summary = value as unknown as ProblemSessionSummary
  if (!summary.problem || !summary.resolution || !summary.scores) {
    throw new BadRequestException('问题会话总结字段不完整')
  }
  return summary
}

function validateProblemSessionSummary(summary: ProblemSessionSummary) {
  const requiredArrays: Array<keyof Pick<ProblemSessionSummary, 'applicableScope' | 'environment' | 'failedAttempts' | 'nonApplicableScope' | 'pitfalls' | 'similarKnowledgeMatches' | 'successfulSteps'>> = [
    'applicableScope',
    'environment',
    'failedAttempts',
    'nonApplicableScope',
    'pitfalls',
    'similarKnowledgeMatches',
    'successfulSteps',
  ]
  if (!summary.problem || !summary.resolution || !summary.recommendation || !summary.scores) {
    throw new BadRequestException('问题会话总结字段不完整')
  }
  if (!summary.scoreDetails?.scoringVersion || !Array.isArray(summary.scoreDetails.ruleFlags)) {
    throw new BadRequestException('问题会话评分详情字段不完整')
  }
  if (requiredArrays.some((key) => !Array.isArray(summary[key]))) {
    throw new BadRequestException('问题会话总结数组字段不完整')
  }
  const scores = summary.scores
  const scoreKeys: Array<keyof ProblemSessionSummary['scores']> = ['confidence', 'poisoningRisk', 'privacy', 'quality', 'reuse', 'safety']
  if (scoreKeys.some((key) => typeof scores[key] !== 'number' || scores[key] < 0 || scores[key] > 1)) {
    throw new BadRequestException('问题会话总结评分字段不正确')
  }
  const serialized = JSON.stringify(summary)
  const sensitiveReason = getProblemSessionRejectionReason(serialized)
  if (sensitiveReason) {
    throw new BadRequestException(`问题会话总结含敏感内容：${sensitiveReason}`)
  }
}

function renderProblemSessionKnowledgeAnswer(summary: ProblemSessionSummary) {
  return [
    summary.resolution,
    summary.environment.length ? `\n环境/前提：\n${summary.environment.map((item) => `- ${item}`).join('\n')}` : '',
    summary.successfulSteps.length ? `\n有效步骤：\n${summary.successfulSteps.map((item, index) => `${index + 1}. ${item}`).join('\n')}` : '',
    summary.pitfalls.length ? `\n踩坑点：\n${summary.pitfalls.map((item) => `- ${item}`).join('\n')}` : '',
    summary.failedAttempts.length ? `\n不推荐或无效尝试：\n${summary.failedAttempts.map((item) => `- ${item}`).join('\n')}` : '',
    summary.applicableScope.length ? `\n适用范围：${summary.applicableScope.join('；')}` : '',
    summary.nonApplicableScope.length ? `\n不适用范围：${summary.nonApplicableScope.join('；')}` : '',
  ].filter(Boolean).join('\n')
}

function getProblemSessionRejectionReason(text: string) {
  if (/authorization\s*:|bearer\s+[a-z0-9._~+/=-]{12,}|cookie\s*:|set-cookie\s*:/i.test(text)) return '包含 Token、Cookie 或 Authorization 信息'
  if (/(password|api[_-]?key|secret|private_key)\s*[=:：]\s*\S+/i.test(text)) return '包含密码、密钥或私钥信息'
  if (/(?:10|127|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.\d{1,3}\.\d{1,3}/.test(text)) return '包含内网或真实资产地址'
  if (/https?:\/\/(?!localhost\b|127\.0\.0\.1\b|example\.(?:com|org|net)\b)[^\s"'<>，。]+/i.test(text)) return '包含真实资产 URL'
  if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(text)) return '包含邮箱等个人身份信息'
  if (/(?:\+?86[-\s]?)?1[3-9]\d{9}\b/.test(text)) return '包含手机号等个人身份信息'
  if (/(?:GET|POST|PUT|DELETE|PATCH)\s+\/[^\s]*\s+HTTP\/1\.[01]|Host:\s*[^\s]+|-----BEGIN [A-Z ]+PRIVATE KEY-----/i.test(text)) return '包含原始请求包或私密附件内容'
  if (/忽略.*(规则|指令|系统)|ignore\s+(previous|all)\s+instructions|system\s*prompt|开发者指令|系统提示词|越权|绕过.*(权限|规则)/i.test(text)) return '疑似 prompt injection 或越权指令'
  return undefined
}

function getProblemSessionRuleFlags(fullText: string, problem: string) {
  return [
    getProblemSessionRejectionReason(fullText),
    getNonReusableProblemReason(problem),
  ].filter((reason): reason is string => Boolean(reason))
}

function getNonReusableProblemReason(problem: string) {
  const normalized = problem.trim()
  if (/^(你好|您好|谢谢|在吗|hello|hi)[。！？!?\s]*$/i.test(normalized)) return '寒暄内容无沉淀价值'
  if (/(我的|我有|当前|账户|账号|个人).{0,12}(积分|余额|商品|兑换|漏洞|证书|公告|排名|状态)|SRC-\d|今天|现在|实时/.test(normalized)) {
    return '实时个人业务数据不进入长期知识库'
  }
  return undefined
}

function extractLines(text: string, pattern: RegExp, limit: number) {
  const seen = new Set<string>()
  return text
    .split(/\n+/)
    .map((line) => line.replace(/^(user|assistant):\s*/i, '').trim())
    .filter((line) => line.length >= 8 && line.length <= 240 && pattern.test(line))
    .filter((line) => {
      const key = line.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, limit)
}

function inferApplicableScope(problem: string, fullText: string) {
  const scope = []
  if (/漏洞|报告|提交|复现|修复|src/i.test(`${problem}\n${fullText}`)) scope.push('漏洞报告、复现材料、修复建议等 SRC 平台通用问题')
  if (/docker|compose|靶场|dvwa|pikachu|vulhub/i.test(fullText)) scope.push('靶场或本地安全测试环境排错')
  if (/学习|路线|入门|课程/i.test(fullText)) scope.push('安全学习路径和资料选择')
  return scope.length ? scope : ['同类平台使用或安全学习问题']
}

function inferNonApplicableScope(fullText: string) {
  const scope = ['涉及实时个人数据的问题需要重新查询平台数据，不能只依赖知识库']
  if (/附件|pdf|图片|截图|原文/i.test(fullText)) scope.push('依赖附件原文或截图细节的问题需要重新读取附件')
  return scope
}

function tokenizeForSearch(text: string) {
  return Array.from(new Set((text.toLowerCase().match(/[\p{Script=Han}]{2,}|[a-z0-9_+-]{2,}/gu) ?? [])
    .filter((token) => !['这个', '问题', '如何', '怎么', '请问', '一下', '可以', '需要'].includes(token))))
}

function scoreTextSimilarity(source: string, sourceTokens: string[], target: string) {
  const targetLower = target.toLowerCase()
  const sourceLower = source.toLowerCase()
  const sourceQuestion = sourceLower.split('\n')[0]?.trim() ?? ''
  const hits = sourceTokens.filter((token) => targetLower.includes(token)).length
  const tokenScore = sourceTokens.length ? hits / sourceTokens.length : 0
  const questionTokens = tokenizeForSearch(sourceQuestion)
  const questionHits = questionTokens.filter((token) => targetLower.includes(token)).length
  const questionTokenScore = questionTokens.length ? questionHits / questionTokens.length : 0
  const containmentScore = targetLower.includes(sourceLower.slice(0, 60)) ? 0.25 : 0
  const questionScore = sourceQuestion.length >= 12 && targetLower.includes(sourceQuestion.slice(0, 60)) ? 0.25 : 0
  return clampScore(Math.max(tokenScore * 0.75 + containmentScore + questionScore, questionTokenScore * 0.9))
}

function inferCategory(text: string) {
  if (/xss|跨站|脚本/i.test(text)) return AiKnowledgeCategory.XSS
  if (/sql\s*注入|sqli|union\s+select/i.test(text)) return AiKnowledgeCategory.SQL_INJECTION
  if (/ssrf|服务端请求伪造/i.test(text)) return AiKnowledgeCategory.SSRF
  if (/文件上传|上传漏洞|webshell/i.test(text)) return AiKnowledgeCategory.FILE_UPLOAD
  if (/越权|idor|权限|访问控制/i.test(text)) return AiKnowledgeCategory.ACCESS_CONTROL
  if (/认证|登录|jwt|session/i.test(text)) return AiKnowledgeCategory.AUTHENTICATION
  if (/学习|路线|入门|教程/i.test(text)) return AiKnowledgeCategory.SECURITY_LEARNING
  if (/积分|商城|证书|公告|平台/i.test(text)) return AiKnowledgeCategory.PLATFORM_USAGE
  return AiKnowledgeCategory.VULNERABILITY_REPORTING
}

function mapAiSpaceToRoleScope(aiSpace: AiSpace) {
  if (aiSpace === AiSpace.AUDITOR) return AiKnowledgeRoleScope.AUDITOR
  if (aiSpace === AiSpace.ADMIN) return AiKnowledgeRoleScope.ADMIN
  return AiKnowledgeRoleScope.STUDENT
}

function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, Number(value.toFixed(4))))
}

function isUniqueConstraintError(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'P2002'
}

function redactSensitiveText(text: string) {
  return text
    .replace(/authorization\s*:\s*[^\n\r]+/gi, 'Authorization: [REDACTED]')
    .replace(/cookie\s*:\s*[^\n\r]+/gi, 'Cookie: [REDACTED]')
    .replace(/bearer\s+[a-z0-9._~+/=-]{12,}/gi, 'Bearer [REDACTED]')
    .replace(/(password|api[_-]?key|token)\s*([=:：])\s*\S+/gi, '$1$2 [REDACTED]')
    .replace(/https?:\/\/(?!localhost\b|127\.0\.0\.1\b|example\.(?:com|org|net)\b)[^\s"'<>，。]+/gi, '[TARGET_URL]')
    .replace(/([a-z0-9._%+-])[a-z0-9._%+-]*(@[a-z0-9.-]+\.[a-z]{2,})/gi, '$1***$2')
    .replace(/\b((?:\+?86[-\s]?)?1[3-9]\d{2})\d{4}(\d{4})\b/g, '$1****$2')
    .replace(/((?:GET|POST|PUT|DELETE|PATCH)\s+\/[^\s]*\s+HTTP\/1\.[01][\s\S]{0,1200}?)(?=\n\n|$)/gi, '[PRIVATE_REQUEST]')
    .replace(/-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]+?-----END [A-Z ]+PRIVATE KEY-----/g, '[PRIVATE_ATTACHMENT]')
    .replace(/\b(?:10|127|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.\d{1,3}\.\d{1,3}\b/g, '[REDACTED_IP]')
    .trim()
}
