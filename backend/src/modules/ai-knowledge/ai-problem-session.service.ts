import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { createHash } from 'crypto'
import {
  AiKnowledgeFeedbackValue,
  AiKnowledgeCategory,
  AiKnowledgeMaintenanceStatus,
  AiKnowledgeRoleScope,
  AiKnowledgeSensitivity,
  AiKnowledgeSource,
  AiKnowledgeStatus,
  AiKnowledgeVisibility,
  AiProblemSessionStatus,
  AiSpace,
  AuditAction,
  Prisma,
} from '@prisma/client'
import { AuthenticatedRequestUser } from '../auth/auth.types'
import { PrismaService } from '../prisma/prisma.service'

type AiProblemSessionMode = 'student' | 'auditor' | 'admin'

type CreateProblemSessionInput = {
  forceNew?: boolean
  initialQuestion?: string
  mode?: AiProblemSessionMode
}

type ResolveProblemSessionInput = {
  note?: string
}

type ReviewProblemSessionInput = {
  note?: string
  status: 'APPROVED_TO_KB' | 'DISCARDED'
}

type TurnFeedbackInput = {
  rating: 'UP' | 'DOWN' | 'REPORT' | 'CLEARED'
  reasonCode?: string
  reasonText?: string
}

type ProblemSessionSummary = {
  problem: string
  canonicalKey?: string
  canonicalProblemJson?: CanonicalProblem
  clusterDecision?: ClusterDecisionEvidence
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
    feedback: { down: number; report: number; up: number }
    modelSuggested: boolean
    ruleFlags: string[]
    scoringVersion: string
  }
  recommendation: 'KB' | 'DISCARD'
  rejectionReason?: string
  similarKnowledgeMatches: Array<{
    id: string
    similarity: number
    status: AiKnowledgeStatus
    title: string
  }>
  mergeSuggestion?: string
}

type CanonicalProblem = {
  domain: string
  intent: string
  entities: string[]
  scenario: string
  symptom: string
  environment: string[]
  expectedOutcome: string
  roleScope: string
  safetyClass: string
  reusableType: string
}

type ClusterDecision = 'SAME_CLUSTER' | 'VARIANT_OF_CLUSTER' | 'MERGE_REVIEW' | 'NEW_CLUSTER' | 'REJECT'

type ClusterDecisionEvidence = {
  candidateClusterId?: string
  conflicts: string[]
  decision: ClusterDecision
  reason: string
  score: number
}

type ClusterCandidate = {
  canonicalProblemJson: Prisma.JsonValue | null
  id: string
  representativeProblem: string
  representativeResolution: string | null
  topicKey: string
}

const CONTINUABLE_STATUSES = new Set<AiProblemSessionStatus>([
  AiProblemSessionStatus.ACTIVE,
  AiProblemSessionStatus.AWAITING_RESOLUTION,
])

const DUPLICATE_REVIEW_THRESHOLD = 0.72
const SAME_CLUSTER_THRESHOLD = 0.9
const VARIANT_CLUSTER_THRESHOLD = 0.72
const MERGE_REVIEW_THRESHOLD = 0.58
const AUTO_APPROVAL_THRESHOLDS = {
  maxDuplicateRisk: 0.72,
  maxPrivacyRisk: 0.1,
  minAskCount: 5,
  minQualityScore: 0.72,
  minDistinctUsers: 2,
  minResolvedSessionCount: 3,
  minReuseScore: 0.82,
  minSafetyScore: 0.9,
}

@Injectable()
export class AiProblemSessionService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(input: CreateProblemSessionInput, user: AuthenticatedRequestUser) {
    const mode = normalizeMode(input.mode)
    const initialQuestion = redactSensitiveText(input.initialQuestion?.trim() || '新问题会话')
    if (!input.forceNew) {
      const existing = await this.prisma.aiProblemSession.findFirst({
        orderBy: { updatedAt: 'desc' },
        where: {
          mode,
          status: AiProblemSessionStatus.ACTIVE,
          userId: user.id,
        },
      })
      if (existing) return serializeProblemSession(existing)
    } else {
      await this.prisma.aiProblemSession.updateMany({
        data: { status: AiProblemSessionStatus.AWAITING_RESOLUTION },
        where: { mode, status: AiProblemSessionStatus.ACTIVE, userId: user.id },
      })
    }

    const session = await this.prisma.aiProblemSession.create({
      data: {
        aiSpace: getAiSpace(mode),
        initialQuestion,
        mode,
        title: buildProblemSessionTitle(initialQuestion),
        topicKey: buildSemanticTopicKey(buildCanonicalProblemFromText(initialQuestion, getAiSpace(mode))),
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
    if (!session) return null
    const prompted = await this.maybePromptForInactivity(session)
    return serializeProblemSession(prompted ?? session)
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
      status: query.status ?? { in: [AiProblemSessionStatus.READY_REVIEW, AiProblemSessionStatus.RESOLVED] },
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
      data: {
        lastActiveAt: new Date(),
      },
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
      },
      where: { id },
    })
    return serializeProblemSession(session)
  }

  async requestResolutionPrompt(id: string, reason: 'INACTIVITY' | 'NEW_CONVERSATION' | 'NEW_QUESTION', user: AuthenticatedRequestUser) {
    const session = await this.getOwnedSession(id, user.id, true)
    if (!CONTINUABLE_STATUSES.has(session.status)) return null
    if (!this.isReusablePromptCandidate(session)) return null
    if (session.resolutionSnoozedUntil && session.resolutionSnoozedUntil > new Date()) return null
    if (reason === 'INACTIVITY' && Date.now() - session.lastActiveAt.getTime() < 24 * 60 * 60 * 1000) return null
    const prompted = await this.prisma.aiProblemSession.update({
      data: {
        resolutionPromptCount: { increment: 1 },
        resolutionPromptedAt: new Date(),
        status: AiProblemSessionStatus.AWAITING_RESOLUTION,
      },
      where: { id: session.id },
    })
    return serializeProblemSession(prompted)
  }

  async snoozeResolutionPrompt(id: string, user: AuthenticatedRequestUser) {
    await this.assertOwnedSession(id, user.id)
    const session = await this.prisma.aiProblemSession.update({
      data: {
        lastActiveAt: new Date(),
        resolutionSnoozedUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: AiProblemSessionStatus.ACTIVE,
      },
      where: { id },
    })
    return serializeProblemSession(session)
  }

  async resumeResolutionPrompt(id: string, user: AuthenticatedRequestUser) {
    await this.assertOwnedSession(id, user.id)
    const session = await this.prisma.aiProblemSession.update({
      data: {
        lastActiveAt: new Date(),
        resolutionSnoozedUntil: null,
        status: AiProblemSessionStatus.ACTIVE,
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

    const sanitizedTurns = session.turns.map((turn) => ({ ...turn, sanitizedText: redactSensitiveText(turn.sanitizedText) }))
    const turnRedactionWrites = sanitizedTurns
      .filter((turn, index) => turn.sanitizedText !== session.turns[index]?.sanitizedText)
      .map((turn) => this.prisma.aiProblemSessionTurn.update({ data: { sanitizedText: turn.sanitizedText }, where: { id: turn.id } }))
    const sanitizedInitialQuestion = redactSensitiveText(session.initialQuestion)
    if (turnRedactionWrites.length || sanitizedInitialQuestion !== session.initialQuestion) {
      await this.prisma.$transaction([
        ...turnRedactionWrites,
        ...(sanitizedInitialQuestion !== session.initialQuestion
          ? [this.prisma.aiProblemSession.update({ data: { initialQuestion: sanitizedInitialQuestion, title: buildProblemSessionTitle(sanitizedInitialQuestion) }, where: { id } })]
          : []),
      ])
    }

    const summary = await this.buildResolvedSessionSummary({ ...session, initialQuestion: sanitizedInitialQuestion, turns: sanitizedTurns })
    validateProblemSessionSummary(summary)
    const canonicalProblem = buildCanonicalProblem(summary.problem, renderProblemSessionKnowledgeAnswer(summary), session.aiSpace)
    const clusterDecision = await this.decideKnowledgeCluster(session.aiSpace, summary, canonicalProblem)
    const cluster = await this.applyKnowledgeClusterDecision(session, summary, canonicalProblem, clusterDecision)
    const topicKey = cluster?.topicKey ?? buildSemanticTopicKey(canonicalProblem)
    const summaryWithDecision: ProblemSessionSummary = {
      ...summary,
      canonicalKey: buildCanonicalKey(canonicalProblem),
      canonicalProblemJson: canonicalProblem,
      clusterDecision,
    }
    const updated = await this.prisma.aiProblemSession.update({
      data: {
        canonicalKey: buildCanonicalKey(canonicalProblem),
        canonicalProblemJson: canonicalProblem as unknown as Prisma.InputJsonValue,
        clusterId: cluster?.id,
        clusterDecision: clusterDecision.decision,
        clusterDecisionReason: clusterDecision.reason,
        clusterDecisionScore: clusterDecision.score,
        duplicateRiskScore: summary.similarKnowledgeMatches[0]?.similarity ?? 0,
        summaryJson: summaryWithDecision as unknown as Prisma.InputJsonValue,
        title: buildProblemSessionTitle(summary.problem),
        topicKey,
        status: AiProblemSessionStatus.READY_REVIEW,
      },
      include: { turns: { orderBy: { createdAt: 'asc' }, take: 100 } },
      where: { id },
    })
    await this.tryAutoApproveCluster(updated.id)
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
    assistantMetadata?: Prisma.InputJsonValue
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
    const shouldRecordAskSignal = session.turnCount === 0 && !getProblemSessionRejectionReason(question) && !getNonReusableProblemReason(question)
    const titleUpdate = session.initialQuestion === '新问题会话' || !session.title
      ? {
          initialQuestion: question,
          title: buildProblemSessionTitle(question),
          topicKey: buildSemanticTopicKey(buildCanonicalProblemFromText(question, session.aiSpace)),
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
          metadata: input.assistantMetadata,
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
    if (shouldRecordAskSignal) {
      await this.recordClusterAskSignal(session.aiSpace, question).catch(() => undefined)
    }

    return {
      assistantTurnId: assistantTurn.id,
      sessionId: session.id,
      userTurnId: userTurn.id,
    }
  }

  async submitTurnFeedback(sessionId: string, turnId: string, input: TurnFeedbackInput, user: AuthenticatedRequestUser) {
    const session = await this.getOwnedSession(sessionId, user.id)
    const turn = await this.prisma.aiProblemSessionTurn.findFirst({
      where: { id: turnId, role: 'assistant', sessionId: session.id },
    })
    if (!turn) throw new NotFoundException('AI 回复不存在')

    const metadata = isRecord(turn.metadata) ? turn.metadata : {}
    const existingFeedback = isRecord(metadata.feedback) ? metadata.feedback : null
    const knowledgeHitIds = normalizeStringArray(metadata.knowledgeHitIds)
    const previousValue = normalizeStoredKnowledgeFeedbackValue(existingFeedback?.knowledgeFeedbackValue)
    const nextValue = mapTurnRatingToKnowledgeFeedbackValue(input.rating, input.reasonCode, input.reasonText)
    const reason = [input.reasonCode, input.reasonText].filter((item): item is string => typeof item === 'string' && item.trim().length > 0).join('：').slice(0, 1000)
    const now = new Date()

    const usedHits = knowledgeHitIds.length
      ? await this.prisma.aiKnowledgeHit.findMany({
          select: { id: true, knowledgeId: true },
          where: { id: { in: knowledgeHitIds }, usedInResponse: true, userId: user.id },
        })
      : []
    const uniqueKnowledgeIds = [...new Set(usedHits.map((hit) => hit.knowledgeId))]

    await this.prisma.$transaction(async (tx) => {
      await tx.aiProblemSessionTurn.update({
        data: {
          metadata: {
            ...metadata,
            feedback: {
              at: now.toISOString(),
              knowledgeFeedbackValue: nextValue,
              rating: input.rating,
              reason,
              reasonCode: input.reasonCode ?? null,
              reasonText: input.reasonText ?? null,
            },
          } as Prisma.InputJsonValue,
        },
        where: { id: turn.id },
      })

      for (const knowledgeId of uniqueKnowledgeIds) {
        if (previousValue) {
          await tx.aiKnowledgeEntry.update({
            data: buildKnowledgeFeedbackCounterUpdate(previousValue, -1),
            where: { id: knowledgeId },
          })
        }
        if (nextValue) {
          await tx.aiKnowledgeFeedback.create({
            data: {
              knowledgeId,
              note: reason || null,
              userId: user.id,
              value: nextValue,
            },
          })
          await tx.aiKnowledgeEntry.update({
            data: buildKnowledgeFeedbackCounterUpdate(nextValue, 1),
            where: { id: knowledgeId },
          })
          if (nextValue === AiKnowledgeFeedbackValue.UNHELPFUL || nextValue === AiKnowledgeFeedbackValue.REPORT_ABUSE) {
            const security = nextValue === AiKnowledgeFeedbackValue.REPORT_ABUSE
            await tx.aiKnowledgeMaintenanceTask.upsert({
              create: {
                dedupeKey: `feedback:${security ? 'SECURITY' : 'LOW_QUALITY'}:${knowledgeId}`,
                knowledgeId,
                priority: security ? 'P0' : 'P1',
                reason: security ? '用户举报知识回答，已立即暂停全部召回。' : '用户点踩知识回答，已立即停止直接回答并等待人工复核。',
                taskType: security ? 'SECURITY' : 'LOW_QUALITY',
              },
              update: {
                reason: security ? '用户再次举报知识回答，继续暂停全部召回。' : '知识回答再次收到点踩，继续禁止直接回答。',
                status: 'OPEN',
              },
              where: { dedupeKey: `feedback:${security ? 'SECURITY' : 'LOW_QUALITY'}:${knowledgeId}` },
            })
          }
        }
      }

      await tx.auditLog.create({
        data: {
          action: AuditAction.CALL_AI,
          actorId: user.id,
          metadata: {
            feedback: input.rating,
            knowledgeHitIds,
            knowledgeIds: uniqueKnowledgeIds,
            reasonCode: input.reasonCode ?? null,
            turnId: turn.id,
          },
          result: 'success',
          targetId: turn.id,
          targetType: 'AI_PROBLEM_SESSION_TURN_FEEDBACK',
        },
      })
    })

    return {
      knowledgeFeedbackUpdated: uniqueKnowledgeIds.length > 0 && input.rating !== 'CLEARED',
      knowledgeHitIds: usedHits.map((hit) => hit.id),
      rating: input.rating,
      requiresReview: input.rating === 'REPORT' || input.reasonCode === 'SAFETY_RISK',
      turnId: turn.id,
    }
  }

  async getRecentChatTurnsForPrompt(sessionId: string | undefined, user: AuthenticatedRequestUser, limit = 12) {
    if (!sessionId) return []
    const session = await this.prisma.aiProblemSession.findUnique({
      include: { turns: { orderBy: { createdAt: 'asc' }, take: 100 } },
      where: { id: sessionId },
    })
    if (!session) throw new NotFoundException('问题会话不存在')
    if (session.userId !== user.id) throw new ForbiddenException('无权访问该问题会话')
    if (!CONTINUABLE_STATUSES.has(session.status)) {
      throw new BadRequestException('当前问题会话已结束，请开启新的对话')
    }

    return [...session.turns]
      .slice(-Math.max(0, Math.min(limit, 20)))
      .filter((turn) => turn.role === 'user' || turn.role === 'assistant')
      .map((turn) => ({
        content: turn.sanitizedText.slice(0, turn.role === 'user' ? 3000 : 4000),
        role: turn.role as 'assistant' | 'user',
      }))
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
    turns: Array<{ metadata?: Prisma.JsonValue | null; role: string; sanitizedText: string }>
  }): Promise<ProblemSessionSummary> {
    const turns = session.turns.map((turn) => ({ content: turn.sanitizedText, role: turn.role }))
    const fullText = turns.map((turn) => `${turn.role}: ${turn.content}`).join('\n')
    const userMessages = turns.filter((turn) => turn.role === 'user').map((turn) => turn.content)
    const assistantMessages = turns.filter((turn) => turn.role === 'assistant').map((turn) => turn.content)
    const problem = userMessages[0] || session.initialQuestion
    const lastAnswer = assistantMessages.at(-1) ?? ''
    const feedback = collectSessionFeedback(session.turns)
    const rejectionFlags = getProblemSessionRuleFlags(fullText, problem)
    const redactionFlags = getRedactionRuleFlags(fullText)
    const ruleFlags = [...rejectionFlags, ...redactionFlags]
    const rejectionReason = rejectionFlags[0] ?? (feedback.report > 0 ? '用户举报该 AI 回复，禁止进入知识沉淀' : undefined)
    const hasRedactedSensitiveContent = redactionFlags.length > 0
    const environment = extractLines(fullText, /(windows|wsl|linux|ubuntu|centos|docker|compose|php\s*\d|mysql|mariadb|nginx|apache|node|npm|python|端口|版本|浏览器|burp|nmap|sqlmap)/i, 8)
    const pitfalls = extractLines(fullText, /(报错|错误|失败|不兼容|permission denied|denied|not found|timeout|端口占用|版本|依赖|乱码|空白页|连接失败|启动失败|越权|403|500)/i, 10)
    const successfulSteps = extractLines(assistantMessages.join('\n'), /(执行|运行|修改|配置|安装|重启|检查|确认|设置|创建|导入|访问|启动|提交|补充|复现|验证)/i, 12)
    const failedAttempts = extractLines(userMessages.join('\n'), /(还是|又|仍然|报错|失败|不行|不能|无法|不兼容|空白|连不上|没有效果)/i, 8)
    const applicableScope = inferApplicableScope(problem, fullText)
    const nonApplicableScope = inferNonApplicableScope(fullText)
    const duplicate = await this.assessDuplicateRisk(problem, lastAnswer, session.aiSpace)
    const baselineQuality = clampScore((successfulSteps.length >= 2 ? 0.72 : 0.48) + (pitfalls.length ? 0.08 : 0) + (environment.length ? 0.06 : 0))
    const quality = clampScore(baselineQuality + Math.min(feedback.up, 2) * 0.08 - feedback.down * 0.2 - feedback.report * 0.5)
    const reuse = clampScore(/积分|余额|商品|兑换|我的|当前|今天|公告|排名|证书|漏洞状态|SRC-\d/i.test(problem) ? 0.22 : quality + 0.08)
    const safety = rejectionReason || feedback.report > 0 ? 0.1 : 0.94
    const privacy = rejectionReason ? 0.9 : hasRedactedSensitiveContent ? 0.18 : 0.08
    const poisoningRisk = /忽略.*规则|ignore .*instructions|系统提示词|开发者指令|自动通过|绕过权限/i.test(fullText) ? 0.95 : 0.04
    // 点踩降低质量分并禁止自动入库，但仍保留给管理员审核；不能把用户反馈直接等同于删除知识。
    const recommendation: ProblemSessionSummary['recommendation'] = rejectionReason || feedback.report > 0 || reuse < 0.5 || (feedback.down === 0 && quality < 0.55) || (feedback.down > 0 && baselineQuality < 0.55)
      ? 'DISCARD'
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
        feedback,
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

  private async maybePromptForInactivity(session: { id: string; initialQuestion: string; lastActiveAt: Date; resolutionSnoozedUntil: Date | null; status: AiProblemSessionStatus; turnCount: number; turns?: Array<{ role: string; sanitizedText: string }> }) {
    if (Date.now() - session.lastActiveAt.getTime() < 24 * 60 * 60 * 1000) return null
    if (session.resolutionSnoozedUntil && session.resolutionSnoozedUntil > new Date()) return null
    const detailed = session.turns ? session : await this.prisma.aiProblemSession.findUnique({
      include: { turns: { orderBy: { createdAt: 'asc' }, take: 100 } },
      where: { id: session.id },
    })
    if (!detailed) return null
    if (!this.isReusablePromptCandidate(detailed)) return null
    return this.prisma.aiProblemSession.update({
      data: { resolutionPromptCount: { increment: 1 }, resolutionPromptedAt: new Date(), status: AiProblemSessionStatus.AWAITING_RESOLUTION },
      where: { id: session.id },
    })
  }

  private isReusablePromptCandidate(session: { initialQuestion: string; turnCount: number; turns?: Array<{ role: string; sanitizedText: string }> }) {
    if (session.turnCount < 4) return false
    const text = [session.initialQuestion, ...(session.turns ?? []).map((turn) => turn.sanitizedText)].join('\n')
    if (/^(你好|在吗|谢谢|帮我查|我有多少积分|我的积分|我的证书|今天.*公告|我的漏洞状态)[？?！!。\s]*$/i.test(session.initialQuestion.trim())) return false
    if (/(积分|余额|商品库存|我的证书|我的漏洞|公告|排名|订单)/i.test(text) && !/(报错|配置|安装|复现|修复|学习|规则|教程|步骤|环境|docker|部署)/i.test(text)) return false
    return /(报错|错误|失败|配置|安装|部署|复现|修复|学习|规则|教程|步骤|环境|docker|漏洞报告|网络安全|怎么)/i.test(text)
  }

  private async applyKnowledgeClusterDecision(session: {
    aiSpace: AiSpace
    clusterId?: string | null
    id: string
  }, summary: ProblemSessionSummary, canonicalProblem: CanonicalProblem, decision: ClusterDecisionEvidence) {
    if (summary.rejectionReason) return null
    if (decision.decision === 'REJECT') return null
    const duplicateRiskScore = summary.similarKnowledgeMatches[0]?.similarity ?? 0
    const topicKey = buildSemanticTopicKey(canonicalProblem)
    const existing = decision.candidateClusterId
      ? await this.prisma.aiKnowledgeCluster.findUnique({ where: { id: decision.candidateClusterId } })
      : await this.prisma.aiKnowledgeCluster.findUnique({ where: { aiSpace_topicKey: { aiSpace: session.aiSpace, topicKey } } })
    const shouldIncrement = !session.clusterId || session.clusterId !== existing?.id
    if (!existing) {
      return this.prisma.aiKnowledgeCluster.create({
        data: {
          aiSpace: session.aiSpace,
          avgQualityScore: summary.scores.quality,
          avgReuseScore: summary.scores.reuse,
          avgSafetyScore: summary.scores.safety,
          canonicalKey: buildCanonicalKey(canonicalProblem),
          canonicalProblemJson: canonicalProblem as unknown as Prisma.InputJsonValue,
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
    if (decision.decision === 'VARIANT_OF_CLUSTER' || decision.decision === 'MERGE_REVIEW') {
      return this.prisma.aiKnowledgeCluster.update({
        data: {
          mergeReviewCount: decision.decision === 'MERGE_REVIEW' ? { increment: 1 } : undefined,
          mergeSuggestion: buildClusterDecisionSuggestion(decision, summary.mergeSuggestion),
          similarKnowledgeMatches: summary.similarKnowledgeMatches as unknown as Prisma.InputJsonValue,
          variantCount: decision.decision === 'VARIANT_OF_CLUSTER' ? { increment: 1 } : undefined,
        },
        where: { id: existing.id },
      })
    }
    const nextResolvedCount = shouldIncrement ? existing.resolvedSessionCount + 1 : existing.resolvedSessionCount
    const nextTotalAskCount = Math.max(existing.totalAskCount, nextResolvedCount)
    const average = (current: number, incoming: number) => shouldIncrement
      ? clampScore(((current * existing.resolvedSessionCount) + incoming) / Math.max(nextResolvedCount, 1))
      : incoming
    return this.prisma.aiKnowledgeCluster.update({
      data: {
        avgQualityScore: average(existing.avgQualityScore, summary.scores.quality),
        avgReuseScore: average(existing.avgReuseScore, summary.scores.reuse),
        avgSafetyScore: average(existing.avgSafetyScore, summary.scores.safety),
        canonicalKey: existing.canonicalKey ?? buildCanonicalKey(canonicalProblem),
        canonicalProblemJson: existing.canonicalProblemJson ?? canonicalProblem as unknown as Prisma.InputJsonValue,
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

  private async recordClusterAskSignal(aiSpace: AiSpace, question: string) {
    const canonicalProblem = buildCanonicalProblemFromText(question, aiSpace)
    const decision = await this.decideAskCluster(aiSpace, question, canonicalProblem)
    const topicKey = buildSemanticTopicKey(canonicalProblem)
    const existing = decision.candidateClusterId
      ? await this.prisma.aiKnowledgeCluster.findUnique({ where: { id: decision.candidateClusterId } })
      : await this.prisma.aiKnowledgeCluster.findUnique({ where: { aiSpace_topicKey: { aiSpace, topicKey } } })
    if (!existing) {
      await this.prisma.aiKnowledgeCluster.create({
        data: {
          aiSpace,
          canonicalKey: buildCanonicalKey(canonicalProblem),
          canonicalProblemJson: canonicalProblem as unknown as Prisma.InputJsonValue,
          representativeProblem: question,
          topicKey,
          totalAskCount: 1,
        },
      })
      return
    }
    if (decision.decision !== 'SAME_CLUSTER') return
    await this.prisma.aiKnowledgeCluster.update({
      data: {
        representativeProblem: existing.representativeProblem || question,
        totalAskCount: { increment: 1 },
      },
      where: { id: existing.id },
    })
  }

  private async decideAskCluster(aiSpace: AiSpace, question: string, canonicalProblem: CanonicalProblem): Promise<ClusterDecisionEvidence> {
    const candidates = await this.findClusterCandidates(aiSpace, canonicalProblem)
    return decideClusterMatch({
      answerText: '',
      canonicalProblem,
      candidates,
      problemText: question,
    })
  }

  private async decideKnowledgeCluster(aiSpace: AiSpace, summary: ProblemSessionSummary, canonicalProblem: CanonicalProblem): Promise<ClusterDecisionEvidence> {
    if (summary.rejectionReason || summary.recommendation === 'DISCARD') {
      return {
        conflicts: [summary.rejectionReason ?? '无复用价值'],
        decision: 'REJECT',
        reason: summary.rejectionReason ?? '总结被判定为不适合沉淀',
        score: 0,
      }
    }
    const candidates = await this.findClusterCandidates(aiSpace, canonicalProblem)
    return decideClusterMatch({
      answerText: renderProblemSessionKnowledgeAnswer(summary),
      canonicalProblem,
      candidates,
      problemText: summary.problem,
    })
  }

  private async findClusterCandidates(aiSpace: AiSpace, canonicalProblem: CanonicalProblem): Promise<ClusterCandidate[]> {
    const canonicalKey = buildCanonicalKey(canonicalProblem)
    const entityKeywords = canonicalProblem.entities.slice(0, 4)
    const exact = await this.prisma.aiKnowledgeCluster.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 12,
      where: {
        aiSpace,
        canonicalKey,
      },
    })
    const lexical = entityKeywords.length
      ? await this.prisma.aiKnowledgeCluster.findMany({
          orderBy: { updatedAt: 'desc' },
          take: 24,
          where: {
            aiSpace,
            OR: entityKeywords.flatMap((entity) => [
              { representativeProblem: { contains: entity, mode: 'insensitive' as const } },
              { representativeResolution: { contains: entity, mode: 'insensitive' as const } },
            ]),
          },
        })
      : []
    const recent = await this.prisma.aiKnowledgeCluster.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 12,
      where: { aiSpace },
    })
    const seen = new Set<string>()
    return [...exact, ...lexical, ...recent]
      .filter((candidate) => {
        if (seen.has(candidate.id)) return false
        seen.add(candidate.id)
        return true
      })
      .map((candidate) => ({
        canonicalProblemJson: candidate.canonicalProblemJson,
        id: candidate.id,
        representativeProblem: candidate.representativeProblem,
        representativeResolution: candidate.representativeResolution,
        topicKey: candidate.topicKey,
      }))
  }

  private async tryAutoApproveCluster(latestSessionId: string) {
    const latestSession = await this.prisma.aiProblemSession.findUnique({
      where: { id: latestSessionId },
    })
    if (!latestSession?.clusterId) return null
    const cluster = await this.prisma.aiKnowledgeCluster.findUnique({
      where: { id: latestSession.clusterId },
    })
    if (!cluster || cluster.promotedKnowledgeId || cluster.status === 'AUTO_APPROVED') return null
    if (cluster.resolvedSessionCount < AUTO_APPROVAL_THRESHOLDS.minResolvedSessionCount) return null
    if (cluster.totalAskCount < AUTO_APPROVAL_THRESHOLDS.minAskCount) return null
    if (cluster.avgQualityScore < AUTO_APPROVAL_THRESHOLDS.minQualityScore) return null
    if (cluster.avgReuseScore < AUTO_APPROVAL_THRESHOLDS.minReuseScore) return null
    if (cluster.avgSafetyScore < AUTO_APPROVAL_THRESHOLDS.minSafetyScore) return null
    if (cluster.duplicateRiskScore >= AUTO_APPROVAL_THRESHOLDS.maxDuplicateRisk) return null

    const sessions = await this.prisma.aiProblemSession.findMany({
      orderBy: [{ resolvedAt: 'desc' }, { updatedAt: 'desc' }],
      take: 10,
      where: {
        clusterId: cluster.id,
        resolutionByUser: true,
        status: AiProblemSessionStatus.READY_REVIEW,
      },
    })
    const summaries = sessions
      .map((session) => ({ id: session.id, summary: parseProblemSessionSummary(session.summaryJson) }))
      .filter((item) => item.summary.recommendation !== 'DISCARD' && !item.summary.rejectionReason)
    if (summaries.length < AUTO_APPROVAL_THRESHOLDS.minResolvedSessionCount) return null
    if (new Set(sessions.filter((session) => summaries.some((item) => item.id === session.id)).map((session) => session.userId)).size < AUTO_APPROVAL_THRESHOLDS.minDistinctUsers) return null
    if (summaries.some((item) => item.summary.scores.privacy > AUTO_APPROVAL_THRESHOLDS.maxPrivacyRisk)) return null
    if (summaries.some((item) => item.summary.scoreDetails.feedback.report > 0 || item.summary.scoreDetails.feedback.down > 0)) return null
    const best = summaries
      .slice()
      .sort((a, b) => b.summary.scores.confidence - a.summary.scores.confidence)[0]
    if (!best) return null

    const autoApprovalReason = [
      `同类问题已解决 ${cluster.resolvedSessionCount} 次`,
      `来自至少 ${AUTO_APPROVAL_THRESHOLDS.minDistinctUsers} 名独立用户`,
      `询问信号 ${cluster.totalAskCount} 次`,
      `平均质量 ${cluster.avgQualityScore.toFixed(2)}`,
      `平均复用 ${cluster.avgReuseScore.toFixed(2)}`,
      `平均安全 ${cluster.avgSafetyScore.toFixed(2)}`,
      `重复风险 ${cluster.duplicateRiskScore.toFixed(2)}`,
    ].join('；')
    const knowledge = await this.createKnowledgeEntryFromProblemSession(
      {
        aiSpace: latestSession.aiSpace,
        clusterId: cluster.id,
        id: best.id,
        sourceSessionIds: summaries.map((item) => item.id).slice(0, 10),
        userId: latestSession.userId,
      },
      best.summary,
      null,
      autoApprovalReason,
      AiKnowledgeStatus.AUTO_APPROVED,
      {
        askCount: cluster.totalAskCount,
        autoApprovalReason,
        resolvedSessionCount: cluster.resolvedSessionCount,
      },
    )
    await this.prisma.$transaction([
      this.prisma.aiKnowledgeCluster.update({
        data: {
          autoApprovalReason,
          promotedKnowledgeId: knowledge.id,
          status: 'AUTO_APPROVED',
        },
        where: { id: cluster.id },
      }),
      this.prisma.aiProblemSession.updateMany({
        data: {
          knowledgeEntryId: knowledge.id,
          status: AiProblemSessionStatus.APPROVED_TO_KB,
        },
        where: {
          id: { in: summaries.map((item) => item.id) },
          status: AiProblemSessionStatus.READY_REVIEW,
        },
      }),
    ])
    return knowledge
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
        maintenanceStatus: { in: [AiKnowledgeMaintenanceStatus.HEALTHY, AiKnowledgeMaintenanceStatus.LOW_QUALITY_REVIEW, AiKnowledgeMaintenanceStatus.DUPLICATE_REVIEW] },
        retrievalEnabled: true,
        sensitivity: { in: [AiKnowledgeSensitivity.PUBLIC, AiKnowledgeSensitivity.INTERNAL] },
        status: { in: [AiKnowledgeStatus.APPROVED, AiKnowledgeStatus.AUTO_APPROVED, AiKnowledgeStatus.NEEDS_REVIEW] },
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
    clusterId?: string | null
    id: string
    sourceSessionIds?: string[]
    userId: string | null
  }, summary: ProblemSessionSummary, reviewerId: string | null, reviewNote?: string, status: AiKnowledgeStatus = AiKnowledgeStatus.APPROVED, autoApproval?: {
    askCount: number
    autoApprovalReason: string
    resolvedSessionCount: number
  }) {
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
          reviewedById: reviewerId ?? undefined,
          reviewNote,
          roleScope,
          safetyScore: summary.scores.safety,
          sanitizedInputHash: stableHash(question),
          sensitivity: AiKnowledgeSensitivity.INTERNAL,
          similarityKey: summary.canonicalKey ?? buildSemanticTopicKey(summary.canonicalProblemJson ?? buildCanonicalProblem(question, answer, session.aiSpace)),
          source: AiKnowledgeSource.USER_CHAT,
          sourceClusterId: session.clusterId ?? undefined,
          sourceHash,
          sourceSessionIds: session.sourceSessionIds ?? [session.id],
          sourceUserId: session.userId ?? undefined,
          status,
          summary: summary.resolution,
          tags: tokenizeForSearch(`${question}\n${answer}`).slice(0, 8),
          title: buildProblemSessionTitle(question),
          visibility: AiKnowledgeVisibility.ROLE_ONLY,
          ...(autoApproval
            ? {
                askCount: autoApproval.askCount,
                autoApprovalReason: autoApproval.autoApprovalReason,
                resolvedSessionCount: autoApproval.resolvedSessionCount,
              }
            : {}),
        },
      })
    } catch (error) {
      if (isUniqueConstraintError(error)) throw new BadRequestException('相同问题会话知识已存在')
      throw error
    }
  }
}

function serializeProblemSession<T extends {
  canonicalKey?: string | null
  canonicalProblemJson?: Prisma.JsonValue | null
  clusterId: string | null
  clusterDecision?: string | null
  clusterDecisionReason?: string | null
  clusterDecisionScore?: number | null
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
  turns?: Array<{ createdAt: Date; id: string; metadata: Prisma.JsonValue | null; role: string; sanitizedText: string }>
}>(session: T) {
  return {
    canonicalKey: session.canonicalKey ?? null,
    canonicalProblemJson: session.canonicalProblemJson ?? null,
    closedAt: session.closedAt?.toISOString() ?? null,
    clusterId: session.clusterId,
    clusterDecision: session.clusterDecision ?? null,
    clusterDecisionReason: session.clusterDecisionReason ?? null,
    clusterDecisionScore: session.clusterDecisionScore ?? null,
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
      metadata: turn.metadata,
      role: turn.role,
    })),
    updatedAt: session.updatedAt.toISOString(),
    userOutcomeNote: session.userOutcomeNote,
  }
}

function normalizeStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.length > 0) : []
}

function collectSessionFeedback(turns: Array<{ metadata?: Prisma.JsonValue | null; role: string }>) {
  const feedback = { down: 0, report: 0, up: 0 }
  for (const turn of turns) {
    if (turn.role !== 'assistant' || !isRecord(turn.metadata)) continue
    const detail = isRecord(turn.metadata.feedback) ? turn.metadata.feedback : null
    if (detail?.rating === 'UP') feedback.up += 1
    if (detail?.rating === 'DOWN') feedback.down += 1
    if (detail?.rating === 'REPORT') feedback.report += 1
  }
  return feedback
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeStoredKnowledgeFeedbackValue(value: unknown): AiKnowledgeFeedbackValue | null {
  if (value === AiKnowledgeFeedbackValue.HELPFUL || value === AiKnowledgeFeedbackValue.UNHELPFUL || value === AiKnowledgeFeedbackValue.REPORT_ABUSE) {
    return value
  }
  return null
}

function mapTurnRatingToKnowledgeFeedbackValue(rating: TurnFeedbackInput['rating'], reasonCode?: string, reasonText?: string) {
  if (rating === 'UP') return AiKnowledgeFeedbackValue.HELPFUL
  if (rating === 'DOWN') return AiKnowledgeFeedbackValue.UNHELPFUL
  if (rating === 'REPORT' || reasonCode === 'SAFETY_RISK' || /安全|风险|越权|投毒|攻击/.test(reasonText ?? '')) return AiKnowledgeFeedbackValue.REPORT_ABUSE
  return null
}

function buildKnowledgeFeedbackCounterUpdate(value: AiKnowledgeFeedbackValue, delta: 1 | -1): Prisma.AiKnowledgeEntryUpdateInput {
  if (value === AiKnowledgeFeedbackValue.HELPFUL) return { helpfulCount: { increment: delta } }
  if (value === AiKnowledgeFeedbackValue.UNHELPFUL) return {
    ...(delta === 1 ? { directAnswerEnabled: false, maintenanceStatus: AiKnowledgeMaintenanceStatus.LOW_QUALITY_REVIEW } : {}),
    unhelpfulCount: { increment: delta },
  }
  return {
    abuseReportCount: { increment: delta },
    ...(delta === 1 ? {
      agentInjectEnabled: false,
      directAnswerEnabled: false,
      maintenanceStatus: AiKnowledgeMaintenanceStatus.SECURITY_SUSPENDED,
      retrievalEnabled: false,
    } : {}),
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

function buildSemanticTopicKey(canonicalProblem: CanonicalProblem) {
  return stableHash(buildCanonicalKey(canonicalProblem))
}

function buildCanonicalKey(problem: CanonicalProblem) {
  const primaryEntity = problem.entities[0] ?? 'general'
  return [
    problem.roleScope,
    problem.domain,
    problem.intent,
    normalizeKeyPart(primaryEntity),
    problem.scenario,
    problem.symptom,
    problem.expectedOutcome,
  ].join(':')
}

function normalizeKeyPart(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'general'
}

function buildCanonicalProblemFromText(text: string, aiSpace: AiSpace) {
  return buildCanonicalProblem(text, '', aiSpace)
}

function buildCanonicalProblem(problem: string, answer: string, aiSpace: AiSpace): CanonicalProblem {
  const problemText = normalizeSemanticText(problem)
  const text = normalizeSemanticText(`${problem}\n${answer}`)
  const entities = inferCanonicalEntities(text)
  const environment = inferCanonicalEnvironment(text)
  const symptom = inferCanonicalSymptom(problemText)
  const scenario = inferCanonicalScenario(text, entities, symptom)
  const domain = inferCanonicalDomain(text, entities)
  const intent = inferCanonicalIntent(text, symptom)
  const expectedOutcome = inferExpectedOutcome(text, scenario, symptom)
  return {
    domain,
    entities,
    environment,
    expectedOutcome,
    intent,
    reusableType: isDirectAnswerOrLookupQuestion(text) ? 'direct_answer' : 'how_to',
    roleScope: mapAiSpaceToRoleScope(aiSpace).toLowerCase(),
    safetyClass: getProblemSessionRejectionReason(text) ? 'risk_review' : 'benign_learning',
    scenario,
    symptom,
  }
}

function normalizeSemanticText(text: string) {
  return text
    .toLowerCase()
    .replace(/\[[^\]]*phase2[^\]]*\]/gi, ' ')
    .replace(/皮卡丘/g, 'pikachu')
    .replace(/弹框|弹窗|alert/g, 'alert')
    .replace(/端口被占|端口占用|address already in use/g, 'port_conflict')
    .replace(/\s+/g, ' ')
    .trim()
}

function inferCanonicalEntities(text: string) {
  const entities: string[] = []
  const add = (entity: string, pattern: RegExp) => {
    if (pattern.test(text) && !entities.includes(entity)) entities.push(entity)
  }
  add('Pikachu', /pikachu/)
  add('DVWA', /\bdvwa\b/)
  add('Kali Linux', /\bkali\b/)
  add('VMware', /\bvmware\b/)
  add('VirtualBox', /virtualbox/)
  add('Docker', /\bdocker\b|compose/)
  add('XSS', /\bxss\b|跨站|alert/)
  add('SQL Injection', /sql\s*注入|sql\s*injection|sqli/)
  add('Burp Suite', /\bburp\b/)
  add('Chrome', /chrome|浏览器/)
  if (!entities.length) entities.push('General')
  return entities
}

function inferCanonicalEnvironment(text: string) {
  const environment: string[] = []
  const add = (value: string, pattern: RegExp) => {
    if (pattern.test(text) && !environment.includes(value)) environment.push(value)
  }
  add('Windows', /windows|win10|win11/)
  add('WSL', /\bwsl\b/)
  add('Linux', /linux|ubuntu|centos/)
  add('Docker', /docker|compose/)
  add('Chrome', /chrome|浏览器/)
  add('VMware', /vmware/)
  add('VirtualBox', /virtualbox/)
  return environment
}

function inferCanonicalSymptom(text: string) {
  if (/alert|没有弹|不弹|弹不出来|触发不了/.test(text)) return 'no_alert'
  if (/\bburp\b/.test(text) && /(history|拦截|intercept|停住|不停|放行)/.test(text)) return 'intercept_not_paused'
  if (/\bburp\b/.test(text) && /(抓不到|进不来|没有请求|代理|proxy|拦截不到|抓包失败)/.test(text)) return 'proxy_no_traffic'
  if (/\bburp\b/.test(text) && /(证书|certificate|https|tls|ssl)/.test(text)) return 'certificate_error'
  if (/port_conflict|端口|8080|3000|5173/.test(text)) return 'port_conflict'
  if (/下载|镜像|iso|链接|地址/.test(text)) return 'download_link_request'
  if (/驳回|退回|不通过|审核失败/.test(text)) return 'report_rejected'
  if (/登录|login|密码/.test(text)) return 'login_failed'
  if (/启动失败|起不来|无法启动|运行失败/.test(text)) return 'startup_failed'
  if (/空白页|白屏/.test(text)) return 'page_blank'
  if (/permission denied|403|权限/.test(text)) return 'permission_denied'
  return 'general_issue'
}

function inferCanonicalScenario(text: string, entities: string[], symptom: string) {
  if (entities.includes('Pikachu') && entities.includes('XSS')) return 'xss_lab_reproduction'
  if (entities.includes('DVWA') && (entities.includes('Docker') || symptom === 'port_conflict' || symptom === 'startup_failed')) return 'dvwa_startup'
  if (entities.includes('Kali Linux') && /vmware|virtualbox|虚拟机|iso|镜像|安装/.test(text)) return 'vm_installation'
  if (entities.includes('Burp Suite') && (symptom === 'proxy_no_traffic' || symptom === 'intercept_not_paused' || symptom === 'certificate_error')) return 'burp_proxy_setup'
  if (/漏洞报告|src|提交|复现材料|修复建议|驳回/.test(text)) return 'vulnerability_report'
  if (/商城|兑换|积分/.test(text)) return 'mall_realtime'
  if (/证书/.test(text)) return 'certificate_realtime'
  return 'general_troubleshooting'
}

function inferCanonicalDomain(text: string, entities: string[]) {
  if (/商城|兑换|积分/.test(text)) return 'mall'
  if (/证书/.test(text)) return 'certificate'
  if (/漏洞报告|src|提交|复现材料|修复建议|驳回/.test(text)) return 'vulnerability_reporting'
  if (entities.some((entity) => ['Pikachu', 'DVWA', 'Kali Linux', 'Burp Suite', 'XSS', 'SQL Injection'].includes(entity))) return 'security_learning'
  return 'platform_usage'
}

function inferCanonicalIntent(text: string, symptom: string) {
  if (symptom !== 'general_issue' && symptom !== 'download_link_request') return 'troubleshooting'
  if (/区别|对比|哪个好|差异/.test(text)) return 'compare'
  if (/解释|是什么|为什么/.test(text)) return 'explain'
  if (/推荐|建议/.test(text)) return 'recommend'
  if (/模板|怎么写|格式/.test(text)) return 'template'
  if (/怎么|步骤|安装|配置|处理|排查|解决/.test(text)) return 'how_to'
  return 'how_to'
}

function inferExpectedOutcome(text: string, scenario: string, symptom: string) {
  if (scenario === 'xss_lab_reproduction' && symptom === 'no_alert') return 'trigger_alert'
  if (scenario === 'dvwa_startup') return 'start_lab_success'
  if (scenario === 'vm_installation' && symptom === 'download_link_request') return 'download_official_iso'
  if (scenario === 'vm_installation') return 'install_success'
  if (scenario === 'burp_proxy_setup' && symptom === 'proxy_no_traffic') return 'capture_http_traffic'
  if (scenario === 'burp_proxy_setup' && symptom === 'intercept_not_paused') return 'pause_intercepted_request'
  if (scenario === 'burp_proxy_setup' && symptom === 'certificate_error') return 'fix_https_intercept'
  if (scenario === 'vulnerability_report' && symptom === 'report_rejected') return 'revise_report_pass_review'
  if (symptom === 'port_conflict') return 'fix_port_conflict'
  if (symptom === 'download_link_request') return 'get_official_download'
  return 'fix_error'
}

function parseCanonicalProblem(value: Prisma.JsonValue | null): CanonicalProblem | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const item = value as unknown as Partial<CanonicalProblem>
  if (!item.domain || !item.intent || !item.scenario || !item.symptom || !item.expectedOutcome) return null
  return {
    domain: item.domain,
    entities: Array.isArray(item.entities) ? item.entities.filter((entity): entity is string => typeof entity === 'string') : [],
    environment: Array.isArray(item.environment) ? item.environment.filter((env): env is string => typeof env === 'string') : [],
    expectedOutcome: item.expectedOutcome,
    intent: item.intent,
    reusableType: item.reusableType ?? 'how_to',
    roleScope: item.roleScope ?? 'student',
    safetyClass: item.safetyClass ?? 'benign_learning',
    scenario: item.scenario,
    symptom: item.symptom,
  }
}

function decideClusterMatch(input: {
  answerText: string
  canonicalProblem: CanonicalProblem
  candidates: ClusterCandidate[]
  problemText: string
}): ClusterDecisionEvidence {
  if (input.canonicalProblem.safetyClass !== 'benign_learning') {
    return { conflicts: ['安全分类不允许自动聚类'], decision: 'REJECT', reason: '安全或隐私风险问题不进入问题族统计', score: 0 }
  }
  const scored = input.candidates
    .map((candidate) => scoreClusterCandidate(input.canonicalProblem, input.problemText, input.answerText, candidate))
    .sort((a, b) => b.score - a.score)
  const best = scored[0]
  if (!best) {
    return { conflicts: [], decision: 'NEW_CLUSTER', reason: '未召回可兼容的问题族，创建新 cluster', score: 0 }
  }
  if (best.score >= SAME_CLUSTER_THRESHOLD && best.conflicts.length === 0) {
    return {
      candidateClusterId: best.candidate.id,
      conflicts: [],
      decision: 'SAME_CLUSTER',
      reason: `canonical 问题族高置信匹配：${best.reason}`,
      score: best.score,
    }
  }
  if (best.score >= VARIANT_CLUSTER_THRESHOLD && hasVariantEvidence(input.canonicalProblem, best.canonical)) {
    return {
      candidateClusterId: best.candidate.id,
      conflicts: best.conflicts,
      decision: 'VARIANT_OF_CLUSTER',
      reason: `同主题变体，不计入自动入库统计：${best.reason}`,
      score: best.score,
    }
  }
  if (best.score >= 0.42 && hasStrongVariantEvidence(input.canonicalProblem, best.canonical)) {
    return {
      candidateClusterId: best.candidate.id,
      conflicts: best.conflicts,
      decision: 'VARIANT_OF_CLUSTER',
      reason: `同一主实体和场景下的不同症状/结果，作为变体记录：${best.reason}`,
      score: best.score,
    }
  }
  if (best.score >= MERGE_REVIEW_THRESHOLD) {
    return {
      candidateClusterId: best.candidate.id,
      conflicts: best.conflicts,
      decision: 'MERGE_REVIEW',
      reason: `可能同类但证据不足，需要管理员合并复核：${best.reason}`,
      score: best.score,
    }
  }
  return { conflicts: [], decision: 'NEW_CLUSTER', reason: '候选问题族相似度不足，创建新 cluster', score: best.score }
}

function scoreClusterCandidate(canonicalProblem: CanonicalProblem, problemText: string, answerText: string, candidate: ClusterCandidate) {
  const candidateCanonical = parseCanonicalProblem(candidate.canonicalProblemJson) ?? buildCanonicalProblem(candidate.representativeProblem, candidate.representativeResolution ?? '', AiSpace.STUDENT)
  const conflicts = getClusterConflicts(canonicalProblem, candidateCanonical)
  const entityOverlap = overlapScore(canonicalProblem.entities, candidateCanonical.entities)
  const environmentOverlap = canonicalProblem.environment.length && candidateCanonical.environment.length
    ? overlapScore(canonicalProblem.environment, candidateCanonical.environment)
    : 0.5
  const lexical = scoreTextSimilarity(
    `${problemText}\n${answerText}`,
    tokenizeForSearch(`${problemText}\n${answerText}`),
    `${candidate.representativeProblem}\n${candidate.representativeResolution ?? ''}`,
  )
  const exactCanonical = buildCanonicalKey(canonicalProblem) === buildCanonicalKey(candidateCanonical)
  const base = [
    canonicalProblem.domain === candidateCanonical.domain ? 0.18 : 0,
    canonicalProblem.intent === candidateCanonical.intent ? 0.12 : 0,
    canonicalProblem.scenario === candidateCanonical.scenario ? 0.18 : 0,
    canonicalProblem.symptom === candidateCanonical.symptom ? 0.16 : 0,
    canonicalProblem.expectedOutcome === candidateCanonical.expectedOutcome ? 0.14 : 0,
    entityOverlap * 0.16,
    environmentOverlap * 0.04,
    lexical * 0.12,
    exactCanonical ? 0.12 : 0,
  ].reduce((sum, item) => sum + item, 0)
  const score = clampScore(base - (conflicts.length * 0.18))
  return {
    candidate,
    canonical: candidateCanonical,
    conflicts,
    reason: [
      `domain=${canonicalProblem.domain === candidateCanonical.domain}`,
      `intent=${canonicalProblem.intent === candidateCanonical.intent}`,
      `scenario=${canonicalProblem.scenario === candidateCanonical.scenario}`,
      `symptom=${canonicalProblem.symptom === candidateCanonical.symptom}`,
      `expectedOutcome=${canonicalProblem.expectedOutcome === candidateCanonical.expectedOutcome}`,
      `entityOverlap=${entityOverlap.toFixed(2)}`,
      `lexical=${lexical.toFixed(2)}`,
      conflicts.length ? `conflicts=${conflicts.join(',')}` : 'noConflicts',
    ].join('；'),
    score,
  }
}

function getClusterConflicts(current: CanonicalProblem, candidate: CanonicalProblem) {
  const conflicts: string[] = []
  const currentPrimary = current.entities[0] ?? 'General'
  const candidatePrimary = candidate.entities[0] ?? 'General'
  if (current.domain !== candidate.domain) conflicts.push('domain')
  if (currentPrimary !== 'General' && candidatePrimary !== 'General' && currentPrimary !== candidatePrimary) conflicts.push('primaryEntity')
  if (current.scenario !== candidate.scenario && current.symptom !== candidate.symptom) conflicts.push('scenarioAndSymptom')
  if (current.scenario !== candidate.scenario && current.expectedOutcome !== candidate.expectedOutcome && current.symptom !== candidate.symptom) conflicts.push('answerOutcome')
  return conflicts
}

function hasVariantEvidence(current: CanonicalProblem, candidate: CanonicalProblem) {
  const entityOverlap = overlapScore(current.entities, candidate.entities)
  return current.domain === candidate.domain
    && entityOverlap >= 0.5
    && (current.scenario === candidate.scenario || current.intent === candidate.intent)
}

function hasStrongVariantEvidence(current: CanonicalProblem, candidate: CanonicalProblem) {
  const entityOverlap = overlapScore(current.entities, candidate.entities)
  return current.domain === candidate.domain
    && current.scenario === candidate.scenario
    && entityOverlap >= 0.5
}

function overlapScore(left: string[], right: string[]) {
  const a = new Set(left.map(normalizeKeyPart))
  const b = new Set(right.map(normalizeKeyPart))
  if (!a.size || !b.size) return 0
  let overlap = 0
  for (const item of a) {
    if (b.has(item)) overlap += 1
  }
  return overlap / Math.max(a.size, b.size)
}

function buildClusterDecisionSuggestion(decision: ClusterDecisionEvidence, mergeSuggestion?: string) {
  return [mergeSuggestion, `${decision.decision} ${Math.round(decision.score * 100)}%：${decision.reason}`].filter(Boolean).join('；')
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
  if ((summary.recommendation as string) === 'SKILL') summary.recommendation = 'KB'
  if (!summary.problem || !summary.resolution || !summary.scores) {
    throw new BadRequestException('问题会话总结字段不完整')
  }
  if (!summary.scoreDetails) {
    summary.scoreDetails = { feedback: { down: 0, report: 0, up: 0 }, modelSuggested: false, ruleFlags: [], scoringVersion: 'legacy-session-summary' }
  } else if (!summary.scoreDetails.feedback) {
    summary.scoreDetails.feedback = { down: 0, report: 0, up: 0 }
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
  if (!summary.scoreDetails?.scoringVersion || !Array.isArray(summary.scoreDetails.ruleFlags) || !summary.scoreDetails.feedback) {
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
  const inspect = text
    .replace(/https?:\/\/localhost\s*:\s*\[TARGET_HOST\]/gi, '')
    .replace(/authorization\s*:\s*\[REDACTED\]/gi, '')
    .replace(/bearer\s+\[REDACTED\]/gi, '')
    .replace(/(?:set-cookie|cookie)\s*:\s*\[REDACTED\]/gi, '')
    .replace(/(password|api[_-]?key|secret|private_key|token|session[_-]?id)\s*[=:：]\s*\[REDACTED\]/gi, '')
    .replace(/host\s*:\s*\[TARGET_HOST\]/gi, '')
  if (/authorization\s*:|bearer\s+[a-z0-9._~+/=-]{12,}|cookie\s*:|set-cookie\s*:/i.test(inspect)) return '包含 Token、Cookie 或 Authorization 信息'
  if (/(password|api[_-]?key|secret|private_key|token)\s*[=:：]\s*\S+/i.test(inspect)) return '包含密码、密钥或私钥信息'
  if (/(?:10|127|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.\d{1,3}\.\d{1,3}/.test(inspect)) return '包含内网或真实资产地址'
  if (/https?:\/\/(?!localhost\b|127\.0\.0\.1\b|example\.(?:com|org|net)\b)[^\s"'<>，。]+/i.test(inspect)) return '包含真实资产 URL'
  if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(inspect)) return '包含邮箱等个人身份信息'
  if (/(?:\+?86[-\s]?)?1[3-9]\d{9}\b/.test(inspect)) return '包含手机号等个人身份信息'
  if (/(?:GET|POST|PUT|DELETE|PATCH)\s+\/[^\s]*\s+HTTP\/1\.[01]|Host:\s*[^\s]+|-----BEGIN [A-Z ]+PRIVATE KEY-----/i.test(inspect)) return '包含原始请求包或私密附件内容'
  if (/忽略.*(规则|指令|系统)|ignore\s+(previous|all)\s+instructions|system\s*prompt|开发者指令|系统提示词|绕过\s*(平台|系统|审核|权限|规则)|越权\s*(读取|查询|查看|操作|修改|删除)\s*(平台|系统|用户|管理员|数据库|数据)/i.test(inspect)) return '疑似 prompt injection 或越权指令'
  return undefined
}

function getRedactionRuleFlags(text: string) {
  if (/\[REDACTED\]|\[TARGET_URL\]|\[TARGET_HOST\]|\[DATABASE_URL\]|\[LOCAL_PATH\]|\[PRIVATE_REQUEST\]|\[PRIVATE_ATTACHMENT\]|\[REDACTED_IP\]|\*\*\*/.test(text)) {
    return ['原始会话含敏感字段，已在总结前确定性脱敏，需人工复核后入库']
  }
  return []
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

function isDirectAnswerOrLookupQuestion(text: string) {
  return /(下载链接|下载地址|官网地址|镜像地址|链接是多少|地址是多少|版本号|当前版本|最新版本|今天|现在|实时|能兑换|多少积分|我的|这次|刚才|上次|这个对话|直接给|发我链接|给我地址|查一下|查询)/i.test(text)
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
    .replace(/https?:\/\/localhost\s*:\s*\[TARGET_HOST\]/gi, 'http://localhost')
    .replace(/((?:GET|POST|PUT|DELETE|PATCH)\s+\/[^\s]*\s+HTTP\/1\.[01][\s\S]{0,1200}?)(?=\n\n|$)/gi, '[PRIVATE_REQUEST]')
    .replace(/-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]+?-----END [A-Z ]+PRIVATE KEY-----/g, '[PRIVATE_ATTACHMENT]')
    .replace(/authorization\s*:\s*[^\n\r]+/gi, 'Authorization: [REDACTED]')
    .replace(/set-cookie\s*:\s*[^\n\r]+/gi, 'Set-Cookie: [REDACTED]')
    .replace(/cookie\s*:\s*[^\n\r]+/gi, 'Cookie: [REDACTED]')
    .replace(/bearer\s+[a-z0-9._~+/=-]{12,}/gi, 'Bearer [REDACTED]')
    .replace(/(password|api[_-]?key|secret|private[_-]?key|token|session[_-]?id)\s*([=:：])\s*\S+/gi, '$1$2 [REDACTED]')
    .replace(/(?:postgres|postgresql|mysql|mongodb|redis):\/\/[^\s"'<>，。]+/gi, '[DATABASE_URL]')
    .replace(/https?:\/\/(?!localhost\b|127\.0\.0\.1\b|example\.(?:com|org|net)\b)[^\s"'<>，。]+/gi, '[TARGET_URL]')
    .replace(/(^|[\r\n])host\s*:\s*(?!localhost\b|127\.0\.0\.1\b|\[TARGET_HOST\])[^\n\r，。]+/gi, '$1Host: [TARGET_HOST]')
    .replace(/([a-z0-9._%+-])[a-z0-9._%+-]*(@[a-z0-9.-]+\.[a-z]{2,})/gi, '$1***$2')
    .replace(/\b((?:\+?86[-\s]?)?1[3-9]\d{2})\d{4}(\d{4})\b/g, '$1****$2')
    .replace(/\b(?:10|127|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.\d{1,3}\.\d{1,3}\b/g, '[REDACTED_IP]')
    .replace(/(?:[A-Za-z]:\\|\/home\/|\/mnt\/[a-z]\/|\/Users\/)[^\s"'<>，。]+/g, '[LOCAL_PATH]')
    .trim()
}
