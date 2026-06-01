import { ForbiddenException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common'
import { AiCallPurpose, AiSpace, AuditAction, RoleCode } from '@prisma/client'
import { AuthenticatedRequestUser, ClientRequestMeta } from '../auth/auth.types'
import { AiKnowledgeService } from '../ai-knowledge/ai-knowledge.service'
import { AiProblemSessionService } from '../ai-knowledge/ai-problem-session.service'
import { PrismaService } from '../prisma/prisma.service'
import { parseStructuredResponse, stripJsonBlock } from './ai.response.service'
import { buildSystemPrompt, buildUserPrompt } from './ai.prompt.service'
import { AiDataRequestService } from './ai.data-request.service'
import { AiSkillRouterService } from './ai.skill-router.service'
import { getAvailableTools } from './ai.tools.registry'
import {
  AiCard,
  AiChatResponse,
  AiPendingAction,
  AiSkillLibraryItem,
  AiToolCall,
  NormalizedAiChatInput,
  OpenAiChatMessage,
  OpenAiChatPayload,
  UserContextDomain,
  UserContextSnapshot,
} from './ai.types'
import { AiToolsService } from './ai.tools.service'

const DEFAULT_OPENAI_BASE_URL = 'http://localhost:5000/v1'
const DEFAULT_OPENAI_MODEL = 'hermes-agent'
const DEFAULT_REQUEST_TIMEOUT_MS = 300_000
const DEFAULT_ATTACHMENT_REQUEST_TIMEOUT_MS = 300_000
const ATTACHMENT_AGENT_EXCERPT_LIMIT = 5_000
const MAX_TOOL_ROUNDS = 3
const DEFAULT_AI_DAILY_TOKENS = 20_000
const DEFAULT_AI_WEEKLY_TOKENS = 60_000
const DEFAULT_AI_MONTHLY_TOKENS = 100_000
const AI_DEFAULT_DAILY_TOKENS_KEY = 'ai_default_daily_tokens'
const AI_DEFAULT_WEEKLY_TOKENS_KEY = 'ai_default_weekly_tokens'
const AI_DEFAULT_MONTHLY_TOKENS_KEY = 'ai_default_monthly_tokens'
const AI_QUOTA_PERIOD_KEY = 'ai_quota_period'
type AiQuotaPeriod = 'DAY' | 'WEEK' | 'MONTH'

const FALLBACK_SKILLS: AiSkillLibraryItem[] = [
  {
    aiSpace: 'STUDENT',
    content: '辅助学生把漏洞报告整理为标准结构：标题、影响资产、漏洞类型、复现步骤、影响说明、修复建议与附件清单。',
    id: 'builtin-report-polish',
    source: 'platform-default',
    title: '漏洞报告整理',
  },
  {
    aiSpace: 'STUDENT',
    content: '检查用户输入中的 token、Cookie、密码、学号手机号等敏感信息，并提醒先脱敏再提交。',
    id: 'builtin-sensitive-redaction',
    source: 'platform-default',
    title: '敏感信息脱敏提醒',
  },
  {
    aiSpace: 'STUDENT',
    content: '根据 Web 安全、权限控制、注入、文件上传、逻辑漏洞等方向，为学生推荐下一步学习路径。',
    id: 'builtin-learning-path',
    source: 'platform-default',
    title: '学习路径推荐',
  },
  {
    aiSpace: 'AUDITOR',
    content: '辅助审核员核对复现材料完整性、影响范围、漏洞等级和修复建议，但不替代人工审核结论。',
    id: 'builtin-audit-assist',
    source: 'platform-default',
    title: '审核材料核对',
  },
]

@Injectable()
export class AiService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AiToolsService) private readonly toolsService: AiToolsService,
    @Inject(AiSkillRouterService) private readonly skillRouter: AiSkillRouterService,
    @Inject(AiDataRequestService) private readonly dataRequests: AiDataRequestService,
    @Inject(AiKnowledgeService) private readonly knowledge: AiKnowledgeService,
    @Inject(AiProblemSessionService) private readonly problemSessions: AiProblemSessionService,
  ) {}

  async checkAgentHealth() {
    const startedAt = Date.now()
    const result = await this.requestOpenAi('models', {
      method: 'GET',
      timeoutMs: 5000,
    })

    return {
      latencyMs: Date.now() - startedAt,
      models: result.body,
      ok: true,
    }
  }

  async getAppearance() {
    const setting = await this.prisma.systemSetting.findUnique({ where: { key: 'ai_assistant_avatar_url' } })
    return {
      avatarUrl: typeof setting?.value === 'string' ? setting.value : null,
    }
  }

  async getQuota(userId: string) {
    return this.buildQuotaSummary(userId)
  }

  async getSkillLibrary(user: AuthenticatedRequestUser) {
    const visibleSpaces = getVisibleSkillSpaces(user.role)
    const skills = await this.prisma.aiSkill.findMany({
      orderBy: [{ aiSpace: 'asc' }, { updatedAt: 'desc' }],
      select: {
        aiSpace: true,
        content: true,
        id: true,
        source: true,
        title: true,
      },
      where: { active: true, aiSpace: { in: visibleSpaces } },
    })

    return {
      isolation: 'skills_shared_globally_user_data_isolated',
      skills: skills.length > 0 ? skills : FALLBACK_SKILLS.filter((skill) => visibleSpaces.includes(skill.aiSpace)),
    }
  }

  async chat(input: NormalizedAiChatInput, user: AuthenticatedRequestUser, meta: ClientRequestMeta): Promise<AiChatResponse> {
    this.assertCanUseMode(input.mode, user)

    const quotaBefore = await this.buildQuotaSummary(user.id)
    if (!quotaBefore.enabled) {
      throw new ForbiddenException('邮宝额度已停用，请联系管理员')
    }
    if (quotaBefore.remaining <= 0) {
      throw new ForbiddenException('本月邮宝 token 额度已用尽，请联系管理员调整额度')
    }

    const safeMessage = redactSensitiveText(input.message)
    const skillRoute = this.skillRouter.route({ ...input, message: safeMessage }, user)

    const hasAttachmentContext = hasUserAttachmentContext(input.context)
    const contextDomains = selectContextDomains({
      forceFullContext: shouldUseDirectResourceResponse(),
      hasAttachmentContext,
      input: { ...input, message: safeMessage },
      role: user.role,
    })

    // 1. 构建按需用户上下文。附件场景默认不注入平台业务数据，避免报告/PDF 问题被商城或漏洞列表污染。
    const context = await this.toolsService.buildUserContext(user, { domains: contextDomains })

    // 2. 平台数据只作为模型上下文注入，不再用关键词规则直接生成回复。
    const directResponse: Pick<AiChatResponse, 'actions' | 'cards' | 'content'> | null = shouldUseDirectResourceResponse()
      ? buildDirectResourceResponse(input, context)
      : null
    if (directResponse) {
      await this.prisma.$transaction(async (tx) => {
        await tx.aiCallLog.create({
          data: {
            aiSpace: getAiSpace(input.mode),
            ipAddress: meta.ipAddress,
            modelName: `${getOpenAiModel()}:deterministic-context`,
            outputSummary: directResponse.content.slice(0, 1000),
            purpose: AiCallPurpose.CHAT,
            sanitizedInputSummary: safeMessage.slice(0, 1000),
            tokensUsed: 0,
            userAgent: meta.userAgent,
            userId: user.id,
          },
        })

        await tx.auditLog.create({
          data: {
            action: AuditAction.CALL_AI,
            actorId: user.id,
            ipAddress: meta.ipAddress,
            metadata: {
              contextDomains: context.injectedDomains,
              directResponse: true,
              mode: input.mode,
              promptLength: input.message.length,
              quotaRemainingBefore: quotaBefore.remaining,
              redacted: safeMessage !== input.message,
              skillRoute: {
                active: skillRoute.active.map((skill) => skill.name),
                available: skillRoute.available.map((skill) => skill.name),
                strategy: skillRoute.strategy,
              },
              status: 200,
              tokensUsed: 0,
              upstreamModel: getOpenAiModel(),
            },
            requestPath: meta.requestPath,
            result: 'success',
            targetId: user.id,
            targetType: 'AI',
            userAgent: meta.userAgent,
          },
        })
      })

      const sessionTurn = await this.problemSessions.recordChatTurnPair({
        answer: directResponse.content,
        hasAttachment: false,
        question: safeMessage,
        sessionId: input.sessionId,
        user,
      })

      return {
        ...directResponse,
        assistantTurnId: sessionTurn?.assistantTurnId,
        mode: input.mode,
        quota: await this.buildQuotaSummary(user.id),
        sessionId: sessionTurn?.sessionId ?? input.sessionId,
        skillRoute: serializeSkillRoute(skillRoute),
        toolCalls: [],
      }
    }

    // 3. 查询已审核知识库。强业务数据已经由 Direct Response 拦截，知识库只处理通用安全方法论。
    const aiSpace = getAiSpace(input.mode)
    const knowledgeHits = hasAttachmentContext
      ? []
      : await this.knowledge.retrieve({
          aiSpace,
          question: safeMessage,
          userId: user.id,
        })
    const topKnowledgeHit = knowledgeHits[0]
    if (topKnowledgeHit && topKnowledgeHit.similarity >= 0.65 && shouldUseKnowledgeDirectResponse()) {
      const knowledgeContent = `${topKnowledgeHit.answer}\n\n（已引用知识库：${topKnowledgeHit.title}）`
      await this.prisma.$transaction(async (tx) => {
        await tx.aiCallLog.create({
          data: {
            aiSpace,
            ipAddress: meta.ipAddress,
            modelName: `${getOpenAiModel()}:knowledge-direct`,
            outputSummary: knowledgeContent.slice(0, 1000),
            purpose: AiCallPurpose.CHAT,
            sanitizedInputSummary: safeMessage.slice(0, 1000),
            tokensUsed: 0,
            userAgent: meta.userAgent,
            userId: user.id,
          },
        })
        await tx.auditLog.create({
          data: {
            action: AuditAction.CALL_AI,
            actorId: user.id,
            ipAddress: meta.ipAddress,
            metadata: {
              contextDomains: context.injectedDomains,
              knowledgeDirect: true,
              knowledgeHit: { id: topKnowledgeHit.id, similarity: topKnowledgeHit.similarity, title: topKnowledgeHit.title },
              mode: input.mode,
              promptLength: input.message.length,
              quotaRemainingBefore: quotaBefore.remaining,
              redacted: safeMessage !== input.message,
              status: 200,
              tokensUsed: 0,
              upstreamModel: getOpenAiModel(),
            },
            requestPath: meta.requestPath,
            result: 'success',
            targetId: user.id,
            targetType: 'AI',
            userAgent: meta.userAgent,
          },
        })
      })

      const sessionTurn = await this.problemSessions.recordChatTurnPair({
        answer: knowledgeContent,
        hasAttachment: false,
        question: safeMessage,
        sessionId: input.sessionId,
        user,
      })

      return {
        actions: [],
        assistantTurnId: sessionTurn?.assistantTurnId,
        cards: [],
        content: knowledgeContent,
        mode: input.mode,
        quota: await this.buildQuotaSummary(user.id),
        sessionId: sessionTurn?.sessionId ?? input.sessionId,
        skillRoute: serializeSkillRoute(skillRoute),
        toolCalls: [],
      }
    }

    // 4. 构建提示词。Hermes Agent 当前不执行后端业务 tool；实时平台数据通过 dataRequests JSON 由后端代执行。
    const routeAndDataRequestPrompt = [
      this.skillRouter.buildPrompt(skillRoute),
      this.dataRequests.buildPrompt(user.role),
    ].join('\n')
    const systemPrompt = buildSystemPrompt(input.mode, context, user.role, routeAndDataRequestPrompt)
    const tools: ReturnType<typeof getAvailableTools> = []
    const promptContext = {
      platformRuntimeData: formatPlatformRuntimeDataForPrompt(context),
      ...(hasAttachmentContext ? compactAttachmentContextForAgent(input.context) : (input.context ?? {})),
      ...(knowledgeHits.length > 0 ? { aiKnowledgeBase: formatKnowledgeHitsForPrompt(knowledgeHits) } : {}),
    }

    // 5. 初始消息
    const messages: OpenAiChatMessage[] = [
      { content: systemPrompt, role: 'system' },
      { content: buildUserPrompt(safeMessage, promptContext), role: 'user' },
    ]

    let finalContent = ''
    let fallbackResponse: Pick<AiChatResponse, 'actions' | 'cards' | 'content'> | null = null
    let agentDegradedReason: string | null = null
    const toolCallsMade: AiToolCall[] = []
    let dataRequestsMade: ReturnType<AiDataRequestService['parse']> = []
    let dataRequestResults: Awaited<ReturnType<AiDataRequestService['execute']>> = []
    let totalTokens = 0

    // 4. Tool calling loop — 最多 MAX_TOOL_ROUNDS 轮
    try {
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const payload: OpenAiChatPayload = {
          messages,
          model: getOpenAiModel(),
          tool_choice: round === 0 ? 'auto' : 'auto',
          tools: tools.length > 0 ? tools : undefined,
          user: user.id,
        }

        const result = await this.requestOpenAi('chat/completions', {
          body: payload,
          method: 'POST',
          timeoutMs: hasAttachmentContext ? getAttachmentRequestTimeoutMs() : getRequestTimeoutMs(),
        })

        const choice = result.body?.choices?.[0]
        totalTokens += extractTokenUsage(result.body) ?? 0

        // 4a. Agent 返回了 tool_calls
        if (choice?.message?.tool_calls && choice.message.tool_calls.length > 0) {
          // 记录 assistant 消息（含 tool_calls）
          messages.push(choice.message)

          for (const tc of choice.message.tool_calls) {
            const toolArgs = safeParseJson(tc.function.arguments)
            const toolCall: AiToolCall = {
              arguments: toolArgs,
              id: tc.id,
              name: tc.function.name,
            }
            toolCallsMade.push(toolCall)

            // 执行 tool
            const toolResultStr = await this.toolsService.executeTool(toolCall, user)

            // 添加 tool 结果消息
            messages.push({
              content: toolResultStr,
              role: 'tool',
              tool_call_id: tc.id,
            })
          }
          continue // 下一轮
        }

        // 4b. Agent 通过 dataRequests JSON 请求后端代查实时平台数据（最多一轮）
        if (choice?.message?.content && round === 0) {
          const requestedData = this.dataRequests.parse(choice.message.content)
          if (requestedData.length > 0) {
            dataRequestsMade = requestedData
            dataRequestResults = await this.dataRequests.execute(requestedData, user)
            messages.push({ content: this.dataRequests.strip(choice.message.content), role: 'assistant' })
            messages.push({ content: this.dataRequests.buildResultPrompt(dataRequestResults), role: 'user' })
            continue
          }
        }

        // 4c. Agent 返回了纯文本
        if (choice?.message?.content) {
          finalContent = this.dataRequests.strip(choice.message.content)
          break
        }

        // 4d. 空响应
        break
      }
    } catch (error) {
      agentDegradedReason = getAgentErrorMessage(error)
      fallbackResponse = buildAgentFailureResponse(agentDegradedReason)
      finalContent = fallbackResponse.content
    }

    // 5. 如果 loop 结束仍无文本，取最后一条 assistant 消息
    if (!finalContent) {
      const lastAssistant = [...messages].reverse().find(
        (m) => m.role === 'assistant' && typeof m.content === 'string' && m.content.length > 0,
      )
      finalContent = this.dataRequests.strip((lastAssistant?.content as string) || '')
    }

    // 6. 解析结构化响应
    const parsedStructured = fallbackResponse
      ? { actions: fallbackResponse.actions ?? [], cards: fallbackResponse.cards ?? [] }
      : parseStructuredResponse(finalContent)
    const filteredStructured = fallbackResponse
      ? parsedStructured
      : this.dataRequests.filterStructuredOutput(parsedStructured.cards, parsedStructured.actions, context, dataRequestResults)
    const structured = completeStructuredFromBackend(safeMessage, filteredStructured, context, dataRequestResults)
    const displayContent = fallbackResponse ? fallbackResponse.content : stripJsonBlock(finalContent) || finalContent

    // 7. 写审计日志
    await this.prisma.$transaction(async (tx) => {
      await tx.aiCallLog.create({
        data: {
          aiSpace: getAiSpace(input.mode),
          hermesRunId: undefined,
          ipAddress: meta.ipAddress,
          modelName: getOpenAiModel(),
          outputSummary: displayContent.slice(0, 1000),
          purpose: AiCallPurpose.CHAT,
          sanitizedInputSummary: safeMessage.slice(0, 1000),
          tokensUsed: totalTokens || undefined,
          userAgent: meta.userAgent,
          userId: user.id,
        },
      })

      await tx.auditLog.create({
        data: {
          action: AuditAction.CALL_AI,
          actorId: user.id,
          ipAddress: meta.ipAddress,
          metadata: {
            contextDomains: context.injectedDomains,
            mode: input.mode,
            promptLength: input.message.length,
            quotaRemainingBefore: quotaBefore.remaining,
            redacted: safeMessage !== input.message,
            degraded: Boolean(fallbackResponse),
            degradedReason: agentDegradedReason,
            skillRoute: {
              active: skillRoute.active.map((skill) => skill.name),
              available: skillRoute.available.map((skill) => skill.name),
              strategy: skillRoute.strategy,
            },
            status: 200,
            tokensUsed: totalTokens || 0,
            dataRequests: dataRequestsMade.map((request) => ({ id: request.id, tool: request.tool })),
            dataRequestResults: dataRequestResults.map((result) => ({ id: result.id, ok: result.ok, tool: result.tool })),
            toolCalls: toolCallsMade.map((tc) => tc.name),
            upstreamModel: getOpenAiModel(),
          },
          requestPath: meta.requestPath,
          result: 'success',
          targetId: user.id,
          targetType: 'AI',
          userAgent: meta.userAgent,
        },
      })
    })

    const sessionTurn = await this.problemSessions.recordChatTurnPair({
      answer: displayContent,
      hasAttachment: hasAttachmentContext,
      question: safeMessage,
      sessionId: input.sessionId,
      user,
    })

    // 7. 兜底：action 存在但 card 缺失时，从上下文补全
    const enrichedCards = enrichCardsFromContext(structured.cards, structured.actions, context)

    return {
      actions: structured.actions,
      assistantTurnId: sessionTurn?.assistantTurnId,
      cards: enrichedCards,
      content: displayContent,
      mode: input.mode,
      quota: await this.buildQuotaSummary(user.id),
      sessionId: sessionTurn?.sessionId ?? input.sessionId,
      skillRoute: serializeSkillRoute(skillRoute),
      toolCalls: [
        ...toolCallsMade.map((tc) => ({ name: tc.name })),
        ...dataRequestsMade.map((request) => ({ name: request.tool })),
      ],
    }
  }

  // ════════════════════════════════════════════════════════════
  // Private: quota
  // ════════════════════════════════════════════════════════════

  private async buildQuotaSummary(userId: string) {
    const quotaSettings = await this.getQuotaSettings()
    const [quotaOverride, usage] = await Promise.all([
      this.prisma.aiUserQuota.findUnique({ where: { userId } }),
      this.prisma.aiCallLog.aggregate({
        _sum: { tokensUsed: true },
        where: {
          createdAt: { gte: getPeriodStart(quotaSettings.quotaPeriod) },
          userId,
        },
      }),
    ])

    const limits = {
      daily: quotaOverride?.dailyLimit ?? quotaOverride?.monthlyLimit ?? quotaSettings.defaultDailyTokens,
      monthly: quotaOverride?.monthlyLimit ?? quotaSettings.defaultMonthlyTokens,
      weekly: quotaOverride?.weeklyLimit ?? quotaOverride?.monthlyLimit ?? quotaSettings.defaultWeeklyTokens,
    }
    const activeLimit = getActiveLimit(limits, quotaSettings.quotaPeriod)
    const usedThisPeriod = usage._sum.tokensUsed ?? 0
    const remaining = Math.max(0, activeLimit - usedThisPeriod)

    return {
      activeLimit,
      dailyLimit: limits.daily,
      enabled: quotaOverride?.enabled ?? true,
      monthlyLimit: limits.monthly,
      overridden: Boolean(quotaOverride),
      quotaPeriod: quotaSettings.quotaPeriod,
      remaining,
      resetAt: getNextPeriodStart(quotaSettings.quotaPeriod).toISOString(),
      usedPercent: activeLimit > 0 ? Math.min(100, Math.round((usedThisPeriod / activeLimit) * 100)) : 100,
      usedThisMonth: usedThisPeriod,
      usedThisPeriod,
      weeklyLimit: limits.weekly,
    }
  }

  private async getQuotaSettings() {
    const rows = await this.prisma.systemSetting.findMany({
      where: {
        key: {
          in: [
            AI_DEFAULT_DAILY_TOKENS_KEY,
            AI_DEFAULT_WEEKLY_TOKENS_KEY,
            AI_DEFAULT_MONTHLY_TOKENS_KEY,
            AI_QUOTA_PERIOD_KEY,
          ],
        },
      },
    })
    const map = Object.fromEntries(rows.map((row) => [row.key, row.value]))
    return {
      defaultDailyTokens: normalizeStoredTokenLimit(map[AI_DEFAULT_DAILY_TOKENS_KEY], DEFAULT_AI_DAILY_TOKENS),
      defaultMonthlyTokens: normalizeStoredTokenLimit(map[AI_DEFAULT_MONTHLY_TOKENS_KEY], DEFAULT_AI_MONTHLY_TOKENS),
      defaultWeeklyTokens: normalizeStoredTokenLimit(map[AI_DEFAULT_WEEKLY_TOKENS_KEY], DEFAULT_AI_WEEKLY_TOKENS),
      quotaPeriod: normalizeQuotaPeriod(map[AI_QUOTA_PERIOD_KEY]),
    }
  }

  private assertCanUseMode(mode: NormalizedAiChatInput['mode'], user: AuthenticatedRequestUser) {
    const requiredPermission = getModePermission(mode)
    if (!user.permissions.includes(requiredPermission)) {
      throw new ForbiddenException(`缺少权限：${requiredPermission}`)
    }

    if (mode === 'student' && user.role !== RoleCode.STUDENT && user.role !== RoleCode.ADMIN) {
      throw new ForbiddenException('当前角色不能使用学生 AI')
    }

    if (mode === 'auditor' && user.role !== RoleCode.AUDITOR && user.role !== RoleCode.ADMIN) {
      throw new ForbiddenException('当前角色不能使用审核员 AI')
    }
  }

  private async requestOpenAi(path: string, options: { body?: unknown; method: 'GET' | 'POST'; timeoutMs: number }) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs)
    const headers: Record<string, string> = options.body === undefined ? {} : { 'Content-Type': 'application/json' }
    const apiKey = getOpenAiApiKey()
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`
    }

    try {
      const response = await fetch(new URL(path, getOpenAiBaseUrl()), {
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        headers,
        method: options.method,
        signal: controller.signal,
      })
      const body = await readResponseBody(response)

      if (!response.ok) {
        throw new ServiceUnavailableException(
          `模型服务返回 HTTP ${response.status}${formatUpstreamErrorDetail(body)}`,
        )
      }

      return {
        body,
        status: response.status,
      }
    } catch (error) {
      const message = error instanceof Error && error.name === 'AbortError'
        ? `模型服务在 ${formatDuration(options.timeoutMs)} 内没有返回结果，已终止本次请求。`
        : error instanceof Error
          ? error.message
          : 'OpenAI-compatible Agent 暂不可用'
      throw new ServiceUnavailableException(message)
    } finally {
      clearTimeout(timeout)
    }
  }
}

// ══════════════════════════════════════════════════════════════
// 环境变量
// ══════════════════════════════════════════════════════════════

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

function shouldUseDirectResourceResponse() {
  return process.env.AI_DIRECT_RESOURCE_RESPONSE === 'true'
}

function shouldUseKnowledgeDirectResponse() {
  return process.env.AI_KNOWLEDGE_DIRECT_RESPONSE === 'true'
}

function getRequestTimeoutMs() {
  return normalizeTimeoutMs(process.env.OPENAI_REQUEST_TIMEOUT_MS, DEFAULT_REQUEST_TIMEOUT_MS)
}

function getAttachmentRequestTimeoutMs() {
  return normalizeTimeoutMs(process.env.OPENAI_ATTACHMENT_REQUEST_TIMEOUT_MS, DEFAULT_ATTACHMENT_REQUEST_TIMEOUT_MS)
}

function getModePermission(mode: NormalizedAiChatInput['mode']) {
  if (mode === 'auditor') return 'ai:use_auditor'
  if (mode === 'admin') return 'ai:use_admin'
  return 'ai:use_student'
}

function getAiSpace(mode: NormalizedAiChatInput['mode']) {
  if (mode === 'auditor') return AiSpace.AUDITOR
  if (mode === 'admin') return AiSpace.ADMIN
  return AiSpace.STUDENT
}


function formatKnowledgeHitsForPrompt(hits: Array<{ answer: string; category: string; similarity: number; title: string }>) {
  return hits.map((hit) => ({
    answer: hit.answer.slice(0, 1200),
    category: hit.category,
    confidence: Number(hit.similarity.toFixed(2)),
    title: hit.title,
  }))
}

function formatPlatformRuntimeDataForPrompt(context: UserContextSnapshot) {
  const injected = new Set(context.injectedDomains)
  return {
    injectedDomains: context.injectedDomains,
    ...(injected.has('mall')
      ? {
          mallProducts: context.mallSuggestions.map((product) => ({
            canRedeem: product.canRedeem,
            category: product.category,
            description: product.description,
            hasImage: Boolean(product.imageUrl),
            id: product.id,
            name: product.name,
            perUserLimit: product.perUserLimit,
            pointsCost: product.pointsCost,
            remainingAfterRedeem: product.remainingAfterRedeem,
            stock: product.stock,
          })),
          visibleMallProductCount: context.mallSuggestions.length,
        }
      : {}),
    ...(injected.has('points') || injected.has('mall') ? { points: context.points } : {}),
  }
}

function selectContextDomains(options: {
  forceFullContext: boolean
  hasAttachmentContext: boolean
  input: NormalizedAiChatInput
  role: RoleCode
}): UserContextDomain[] {
  if (options.forceFullContext) return ['points', 'mall', 'vulnerabilities', 'learning']
  if (options.hasAttachmentContext) return []

  const message = options.input.message
  const normalized = normalizeIntentText(message)
  const learningIntent = hasLearningResourceIntent(message)
  const domains = new Set<UserContextDomain>()

  if (options.input.mode === 'student') {
    if (hasPersonalPointIntent(message)) domains.add('points')
    if (!learningIntent && (hasMallBrowseIntent(normalized) || hasPriceFilterIntent(normalized) || extractProductKeywords(message).length > 0)) {
      domains.add('points')
      domains.add('mall')
    }
    if (hasUserVulnerabilityListIntent(message)) domains.add('vulnerabilities')
    if (learningIntent) domains.add('learning')
    if (hasUserSummaryIntent(message)) {
      domains.add('points')
      domains.add('vulnerabilities')
    }
  }

  // 当前 UserContextSnapshot 只承载学生域实时数据；审核/管理域后续接 read-only tools 或独立上下文。
  void options.role
  return Array.from(domains)
}

function getVisibleSkillSpaces(role: RoleCode) {
  if (role === RoleCode.ADMIN) return [AiSpace.ADMIN, AiSpace.AUDITOR, AiSpace.STUDENT]
  if (role === RoleCode.AUDITOR) return [AiSpace.AUDITOR]
  return [AiSpace.STUDENT]
}

function serializeSkillRoute(decision: ReturnType<AiSkillRouterService['route']>) {
  return {
    active: decision.active.map((skill) => skill.name),
    available: decision.available.map((skill) => skill.name),
    blocked: decision.blocked.map((skill) => skill.name),
    strategy: decision.strategy,
  }
}

function hasUserAttachmentContext(context: Record<string, unknown> | undefined) {
  if (!context) return false
  const attachments = context.attachments
  return Array.isArray(attachments) && attachments.length > 0
}

function compactAttachmentContextForAgent(context: Record<string, unknown> | undefined) {
  if (!context) return {}
  const attachments = Array.isArray(context.attachments) ? context.attachments : []
  return {
    ...context,
    attachments: attachments.map((attachment) => {
      if (!isRecord(attachment)) return attachment
      const textExcerpt = typeof attachment.textExcerpt === 'string' ? attachment.textExcerpt : ''
      const truncated = textExcerpt.length > ATTACHMENT_AGENT_EXCERPT_LIMIT
      return {
        ...attachment,
        textExcerpt: truncated ? textExcerpt.slice(0, ATTACHMENT_AGENT_EXCERPT_LIMIT) : textExcerpt,
        textExcerptTruncatedForAgent: truncated,
      }
    }),
  }
}

function getFirstAttachmentTextContext(context: Record<string, unknown> | undefined) {
  if (!context) return null
  const attachments = context.attachments
  if (!Array.isArray(attachments)) return null
  const first = attachments.find(isRecord)
  if (!first) return null
  const textExcerpt = typeof first.textExcerpt === 'string' ? first.textExcerpt.trim() : ''
  if (!textExcerpt) return null
  return {
    fileName: typeof first.fileName === 'string' ? first.fileName : '已上传附件',
    sourceTextLength: typeof first.sourceTextLength === 'number' ? first.sourceTextLength : textExcerpt.length,
    textExcerpt,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// ══════════════════════════════════════════════════════════════
// Fetch helpers
// ══════════════════════════════════════════════════════════════

async function readResponseBody(response: Response) {
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    return response.json()
  }
  return response.text()
}

function formatUpstreamErrorDetail(body: unknown) {
  if (!body) return ''
  if (typeof body === 'string') return body.trim() ? `：${body.trim().slice(0, 300)}` : ''
  if (!isRecord(body)) return ''

  const message = body.message ?? body.error ?? body.detail
  if (typeof message === 'string' && message.trim()) return `：${message.trim().slice(0, 300)}`
  return `：${JSON.stringify(body).slice(0, 300)}`
}

function getAgentErrorMessage(error: unknown) {
  if (error instanceof ServiceUnavailableException) {
    const response = error.getResponse()
    if (typeof response === 'string') return response
    if (isRecord(response) && typeof response.message === 'string') return response.message
  }

  if (error instanceof Error && error.message.trim()) return error.message
  return '模型服务暂不可用，后端没有收到可解析的错误信息。'
}

function normalizeTimeoutMs(value: string | undefined, fallback: number) {
  const numberValue = Number(value)
  return Number.isInteger(numberValue) && numberValue >= 5_000 ? numberValue : fallback
}

function formatDuration(ms: number) {
  if (ms % 1000 !== 0) return `${ms} 毫秒`
  return `${ms / 1000} 秒`
}

// ══════════════════════════════════════════════════════════════
// 脱敏
// ══════════════════════════════════════════════════════════════

function redactSensitiveText(text: string) {
  return text
    .replace(/(authorization:\s*bearer\s+)[^\s]+/gi, '$1[REDACTED]')
    .replace(/(cookie:\s*)[^\n\r]+/gi, '$1[REDACTED]')
    .replace(/((?:access|refresh)?token["'\s:=]+)[A-Za-z0-9._~+/=-]{12,}/gi, '$1[REDACTED]')
    .replace(/(password["'\s:=]+)[^\s,'"，。；;]+/gi, '$1[REDACTED]')
}

// ══════════════════════════════════════════════════════════════
// OpenAI response parsers
// ══════════════════════════════════════════════════════════════

function extractOpenAiContent(body: unknown) {
  if (!body || typeof body !== 'object') return ''
  const choices = (body as { choices?: unknown }).choices
  if (!Array.isArray(choices)) return ''
  const firstChoice = choices[0] as { message?: { content?: unknown }; text?: unknown } | undefined
  if (typeof firstChoice?.message?.content === 'string') return firstChoice.message.content
  if (typeof firstChoice?.text === 'string') return firstChoice.text
  return ''
}

function extractTokenUsage(body: unknown) {
  if (!body || typeof body !== 'object') return null
  const usage = (body as { usage?: unknown }).usage
  if (!usage || typeof usage !== 'object') return null
  const totalTokens =
    (usage as { total_tokens?: unknown; totalTokens?: unknown }).total_tokens ??
    (usage as { totalTokens?: unknown }).totalTokens
  const numberValue = Number(totalTokens)
  return Number.isFinite(numberValue) && numberValue > 0 ? Math.ceil(numberValue) : null
}

function extractRunId(body: unknown) {
  if (!body || typeof body !== 'object') return undefined
  const id = (body as { id?: unknown }).id
  return typeof id === 'string' ? id : undefined
}

// ══════════════════════════════════════════════════════════════
// Quota 周期计算
// ══════════════════════════════════════════════════════════════

function getActiveLimit(limits: { daily: number; monthly: number; weekly: number }, period: AiQuotaPeriod) {
  if (period === 'DAY') return limits.daily
  if (period === 'WEEK') return limits.weekly
  return limits.monthly
}

function getPeriodStart(period: AiQuotaPeriod) {
  if (period === 'DAY') return getDayStart()
  if (period === 'WEEK') return getWeekStart()
  return getMonthStart()
}

function getNextPeriodStart(period: AiQuotaPeriod) {
  if (period === 'DAY') return getNextDayStart()
  if (period === 'WEEK') return getNextWeekStart()
  return getNextMonthStart()
}

function getDayStart() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

function getNextDayStart() {
  const now = getDayStart()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
}

function getWeekStart() {
  const now = new Date()
  const day = now.getDay() || 7
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1)
}

function getNextWeekStart() {
  const start = getWeekStart()
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7)
}

function getMonthStart() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

function getNextMonthStart() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() + 1, 1)
}

function normalizeStoredTokenLimit(value: unknown, fallback: number) {
  const numberValue = Number(value)
  return Number.isInteger(numberValue) && numberValue >= 0 ? numberValue : fallback
}

function normalizeQuotaPeriod(value: unknown): AiQuotaPeriod {
  return value === 'DAY' || value === 'WEEK' || value === 'MONTH' ? value : 'MONTH'
}

// ══════════════════════════════════════════════════════════════
// 确定性资源响应 — 不依赖模型，避免超时/编造业务 ID
// ══════════════════════════════════════════════════════════════

function buildAgentFailureResponse(reason: string): Pick<AiChatResponse, 'actions' | 'cards' | 'content'> {
  return {
    actions: [],
    cards: [],
    content: [
      '这次没有拿到模型回复。',
      '',
      `原因：${reason}`,
      '',
      '请稍后重试；如果连续出现，可以检查平台 Hermes Gateway、模型 API Key、模型服务日志或网络连接。',
    ].join('\n'),
  }
}

function buildDirectResourceResponse(
  input: NormalizedAiChatInput,
  context: UserContextSnapshot,
): Pick<AiChatResponse, 'actions' | 'cards' | 'content'> | null {
  if (input.mode !== 'student') return null

  const message = input.message.toLowerCase()
  const asksPoints = hasPersonalPointIntent(message)
  const asksMall = hasMallIntent(message, context)
  const asksVulnerabilities = hasUserVulnerabilityListIntent(message)
  const asksPlatformBasics = hasPlatformBasicsIntent(message)
  const asksGreeting = hasGreetingIntent(message)

  if (!asksPoints && !asksMall && !asksVulnerabilities && !asksPlatformBasics && !asksGreeting) return null

  const cards: AiCard[] = []
  const actions: AiPendingAction[] = []
  const lines: string[] = []

  if (asksPlatformBasics) {
    lines.push(
      '### CQUPT-SRC 是什么',
      'CQUPT-SRC 是校园漏洞响应与安全学习平台，用来承载授权范围内的漏洞提交、审核、学习资源、积分激励、证书和公告等流程。',
      '',
      '- 学生/白帽：提交漏洞、补充材料、学习安全知识、使用积分兑换商品。',
      '- 审核员：审核漏洞报告、判断材料完整性、给出审核意见。',
      '- 管理员：维护平台规则、公告、资源、商城和运营数据。',
    )
  }

  if (asksGreeting) {
    if (lines.length > 0) lines.push('')
    lines.push(
      '你好，我是邮宝，CQUPT-SRC 平台的 AI 助手。',
      '',
      '我可以帮你：',
      '- 整理漏洞报告和复现步骤。',
      '- 查询你的积分、漏洞状态和可兑换商品。',
      '- 推荐安全学习资源和入门路线。',
      '- 提醒敏感信息脱敏和报告材料完整性。',
      '',
      '你可以直接问：“推荐 400 积分以下商品”“XSS 报告怎么写”“我有哪些待补充漏洞”。',
    )
  }

  if (asksPoints) {
    if (lines.length > 0) lines.push('')
    lines.push(
      '### 当前积分概览',
      `- 可用积分：\`${context.points.balance.toLocaleString('zh-CN')}\` 分`,
      `- 累计获得：${context.points.earned.toLocaleString('zh-CN')} 分`,
      `- 累计支出：${context.points.spent.toLocaleString('zh-CN')} 分`,
      `- 待领取兑换：${context.points.pendingRedemptions} 个`,
    )
  }

  if (asksMall) {
    const products = filterMallProducts(message, context).slice(0, 6)
    cards.push(...products.map((product) => buildMallProductCard(product, context)))
    actions.push(
      ...products.filter((product) => product.canRedeem).map((product) => ({
        expiresIn: 300,
        id: `redeem_${product.id}`,
        label: '立即兑换',
        payload: { productId: product.id },
        type: 'MALL_REDEEM' as const,
      })),
    )

    if (lines.length > 0) lines.push('')
    lines.push('### 积分商城推荐')
    if (products.length === 0) {
      lines.push('- 暂时没有匹配的可见商品。你可以换一个关键词，或者去积分商城查看全部商品。')
    } else {
      lines.push(`- 已根据你的问题筛选出 ${products.length} 个商品，下方卡片可以直接查看兑换条件。`)
      const redeemableCount = products.filter((product) => product.canRedeem).length
      lines.push(`- 当前可直接兑换：${redeemableCount} 个；不可兑换通常是库存、积分或限购原因。`)
    }
  }

  if (asksVulnerabilities) {
    const wantsSupplement = /待补充|补充/.test(message)
    const vulnerabilities = context.vulnerabilities.recent
      .filter((item) => (wantsSupplement ? item.needsSupplement : true))
      .slice(0, 6)

    cards.push(
      ...vulnerabilities.map((item) => ({
        id: item.id,
        needsSupplement: item.needsSupplement,
        reportNo: item.reportNo,
        severity: item.finalSeverity ?? item.selfSeverity,
        status: item.status,
        title: item.title,
        type: 'VULNERABILITY' as const,
      })),
    )
    actions.push(
      ...vulnerabilities.map((item) => ({
        expiresIn: 300,
        id: `view_vulnerability_${item.id}`,
        label: item.needsSupplement ? '去补充材料' : '查看详情',
        payload: { vulnerabilityId: item.id },
        type: 'VIEW_VULNERABILITY' as const,
      })),
    )

    if (lines.length > 0) lines.push('')
    lines.push(
      '### 我的漏洞概览',
      `- 漏洞总数：${context.vulnerabilities.total} 个`,
      `- 需要补充：\`${context.vulnerabilities.needsSupplement}\` 个`,
      `- 已确认：${context.vulnerabilities.confirmed} 个`,
      `- 待审核：${context.vulnerabilities.pending} 个`,
    )
    if (vulnerabilities.length === 0) {
      lines.push(wantsSupplement ? '- 当前没有需要补充的漏洞报告。' : '- 暂无可展示的近期漏洞报告。')
    } else {
      lines.push(`- 下方列出 ${vulnerabilities.length} 条${wantsSupplement ? '需要补充的' : '近期'}报告，可直接查看详情。`)
    }
  }

  return {
    actions,
    cards,
    content: lines.join('\n'),
  }
}

function hasPlatformBasicsIntent(message: string): boolean {
  const normalized = message.toLowerCase().replace(/\s+/g, '')
  return /(?:cqupt-src|cq?uptsrc|src平台|这个平台|平台).{0,12}(?:是什么|干什么|介绍|说明|作用|怎么用|角色|流程)/i.test(normalized)
}

function hasGreetingIntent(message: string): boolean {
  const normalized = message.trim().toLowerCase().replace(/[。！？!?,，\s]/g, '')
  return /^(你好|您好|hello|hi|嗨|在吗|在不在)$/.test(normalized)
}

function hasLearningResourceIntent(message: string): boolean {
  const normalized = message.toLowerCase().replace(/\s+/g, '')
  return /(?:平台|src|学习中心|资源库|站内|校内).{0,12}(?:学习|资源|教程|资料|靶场|练习|实操|课程|路线)|(?:学习|资源|教程|资料|靶场|练习|实操|课程|路线).{0,12}(?:平台|src|学习中心|资源库|站内|校内)|(?:推荐|找|有没有|查看|看看|我想|想要|想练|练习|实操|入门|学习|想学|怎么学).{0,12}(?:靶场|学习资源|教程|资料|课程|练习环境|lab|range)|(?:靶场|练习环境|实操环境|lab|range)/.test(normalized)
}

function hasUserSummaryIntent(message: string): boolean {
  const normalized = message.toLowerCase().replace(/\s+/g, '')
  return /(?:我的|个人|当前账号|账户|账号).{0,8}(?:概览|总览|摘要|情况|状态)|(?:我在平台|我的平台).{0,8}(?:情况|状态|数据)/.test(normalized)
}

function requiresModelJudgement(message: string): boolean {
  const normalized = message.toLowerCase().replace(/\s+/g, '')
  return /学习|想学|入门|路线|教程|资源|靶场|练习|怎么学|提升|课程|全网|热门|热度|业内|公开|ctf|lab|range|报告.{0,8}(怎么写|如何写|模板|格式|优化|完善|描述)|(?:xss|sql注入|ssrf|越权|文件上传|漏洞).{0,8}报告/.test(normalized)
}

function hasMallIntent(message: string, context: UserContextSnapshot): boolean {
  const normalized = normalizeIntentText(message)
  const keywords = extractProductKeywords(message)
  if (hasMallBrowseIntent(normalized) || hasPriceFilterIntent(normalized)) return true
  return keywords.length > 0 && context.mallSuggestions.some((item) => productMatchesKeywords(item, keywords))
}

function filterMallProducts(message: string, context: UserContextSnapshot) {
  const keywords = extractProductKeywords(message)
  const price = extractPriceFilter(message)
  const wantsRedeemable = hasRedeemableMallIntent(normalizeIntentText(message))
  const hasSpecificKeywords = keywords.length > 0
  let products = context.mallSuggestions

  if (hasSpecificKeywords) {
    products = products.filter((product) => productMatchesKeywords(product, keywords))
  }
  if (typeof price.max === 'number') {
    products = products.filter((product) => product.pointsCost <= price.max!)
  }
  if (typeof price.min === 'number') {
    products = products.filter((product) => product.pointsCost >= price.min!)
  }
  if (wantsRedeemable) {
    products = products.filter((product) => product.canRedeem)
  }

  return products.sort((a, b) => Number(b.canRedeem) - Number(a.canRedeem) || a.pointsCost - b.pointsCost)
}

function buildMallProductCard(product: UserContextSnapshot['mallSuggestions'][number], context: UserContextSnapshot): AiCard {
  return {
    canRedeem: product.canRedeem,
    description: product.description,
    id: product.id,
    imageUrl: product.imageUrl,
    name: product.name,
    perUserLimit: product.perUserLimit,
    pointsCost: product.pointsCost,
    stock: product.stock,
    type: 'MALL_PRODUCT',
    userBalance: context.points.balance,
  }
}

function productMatchesKeywords(product: UserContextSnapshot['mallSuggestions'][number], keywords: string[]) {
  const haystack = `${product.name} ${product.category} ${product.description ?? ''}`.toLowerCase()
  return keywords.some((keyword) => haystack.includes(keyword.toLowerCase()))
}

function normalizeIntentText(message: string) {
  return message.toLowerCase().replace(/\s+/g, '')
}

function hasMallBrowseIntent(normalized: string) {
  return (
    /(?:我的|我有|当前|账户|账号|个人)?积分.{0,10}(?:可以|可|能)?(?:兑换|换|买).{0,8}(?:哪些|什么|啥|有什么|有哪些|商品|东西|物品|奖品|礼品)/.test(normalized) ||
    /(?:积分商城|商城).{0,8}(?:有哪些|有什么|看看|查看|商品|东西|物品|奖品|礼品)/.test(normalized) ||
    /(?:有哪些|有什么|哪些|什么|啥).{0,6}(?:商品|东西|物品|奖品|礼品).{0,8}(?:兑换|换|买|积分|商城)/.test(normalized) ||
    /(?:可以|可|能)(?:兑换|换).{0,8}(?:哪些|什么|啥|商品|东西|物品|奖品|礼品)/.test(normalized) ||
    /(?:兑换|换).{0,8}(?:列表|清单|商品|东西|物品|奖品|礼品)/.test(normalized)
  )
}

function hasRedeemableMallIntent(normalized: string) {
  return /(?:可以|可|能|够)(?:兑换|换|买)|(?:兑换|换).{0,8}(?:哪些|什么|啥|商品|东西|物品|奖品|礼品)/.test(normalized)
}

function hasPriceFilterIntent(normalized: string) {
  return /\d+(?:积分|分)?(?:以[下上内外]|以内|以下|以上|左右)/.test(normalized)
}

/**
 * 从用户消息中提取商品相关关键词。
 * 覆盖中文自然表达：我想兑换X、我要换X、换X、有没有X、给我X…
 */
function extractProductKeywords(message: string): string[] {
  const cleaned = message
    .replace(/\d+\s*(?:积分|分)?\s*(?:以下|以上|以内|左右|内|外)/g, '')
    .replace(/[一两二三几]个/g, '')
    .replace(/一些/g, '')

  const intentPatterns = [
    /(?:我想|我要|我想要|帮我|给我)(?:兑换|换|买|找|推荐)[个些一二两三]?([^，。！？、\s]{1,8})/,
    /(?:兑换|换|买)[个些]?([^，。！？、\s]{1,8})/,
    /想要[个些]?([^，。！？、\s]{1,8})/,
    /有没有([^，。！？、\s]{1,8})(?:可以|能|可)?(?:兑换|换|买)?/,
    /可以兑换[个些]?([^，。！？、\s]{1,8})/,
    /能(?:兑换|换)[个些]?([^，。！？、\s]{1,8})/,
    /看看有没有([^，。！？、\s]{1,8})/,
    /换个?([^，。！？、\s]{1,8})/,
    /(?:推荐|搜[索下]?)[个些]?([^，。！？、\s]{1,8})(?:商品|礼品|奖品|东西|物品)?/,
  ]

  const genericWords = new Set([
    '商品',
    '东西',
    '物品',
    '奖品',
    '礼品',
    '积分',
    '商城',
    '哪些',
    '什么',
    '啥',
    '有哪些',
    '有什么',
    '哪些东西',
    '什么东西',
    '哪些商品',
    '什么商品',
    '哪些物品',
    '什么物品',
    '哪些奖品',
    '什么奖品',
    '哪些礼品',
    '什么礼品',
  ])
  const blockedTopicWords = new Set([
    '靶场',
    '练习',
    '实操',
    '课程',
    '教程',
    '资料',
    '资源',
    '漏洞',
    '报告',
    '全网',
    '热门',
    '热度',
    '公开',
    '业内',
    '学习',
    '路线',
  ])
  const extracted: string[] = []
  for (const pattern of intentPatterns) {
    const match = cleaned.match(pattern)
    if (!match?.[1]) continue
    const word = normalizeProductKeyword(match[1])
    if (
      word.length >= 1 &&
      word.length <= 8 &&
      !/^[一二两三]?[个些]?$/.test(word) &&
      !/^\d+$/.test(word) &&
      !genericWords.has(word) &&
      !blockedTopicWords.has(word)
    ) {
      extracted.push(word)
    }
  }
  return Array.from(new Set(extracted))
}

function normalizeProductKeyword(value: string) {
  return value
    .replace(/[的了吗呢啊呀吧]$/, '')
    .replace(/^的/, '')
    .replace(/^(有哪些|有什么|哪些|什么|啥)(?=商品|东西|物品|奖品|礼品)/, '')
    .trim()
}

/** 从消息中提取价格约束：{ max?: number; min?: number } */
function extractPriceFilter(message: string): { max?: number; min?: number } {
  const filter: { max?: number; min?: number } = {}
  const maxMatch = message.match(/(\d+)\s*(?:积分|分)?\s*(?:以[下内]|以内|以下)/)
  const minMatch = message.match(/(\d+)\s*(?:积分|分)?\s*(?:以[上外]|以上)/)
  if (maxMatch) filter.max = parseInt(maxMatch[1], 10)
  if (minMatch) filter.min = parseInt(minMatch[1], 10)
  return filter
}

function hasUserVulnerabilityListIntent(message: string): boolean {
  const normalized = message.toLowerCase().replace(/\s+/g, '')

  // 平台名或泛知识问题不应触发个人漏洞列表。这里的直出逻辑只处理
  // “查我的漏洞数据”这类确定性、强业务边界的问题。
  const hasReportId = /(?:cqupt-?src|src)[-_]?\d{4,}/i.test(normalized)
  if (hasReportId) return true

  const hasVulnerabilityNoun = /漏洞|漏洞报告|报告/.test(normalized)
  const hasOwnedDataCue = /我的|我提交|我有|我发现|个人|自己|当前账号/.test(normalized)
  const hasListOrStatusCue = /列表|哪些|多少|几个|查看|查询|列出|显示|打开|详情|状态|进度|最近|近期|待补充|补充材料|审核中|待审核|已确认|通过|驳回|修复中|复测|证书/.test(normalized)

  if (hasVulnerabilityNoun && hasOwnedDataCue && hasListOrStatusCue) return true
  if (/待补充|补充材料/.test(normalized) && /我的|我提交|漏洞|报告/.test(normalized)) return true

  return false
}

function hasPersonalPointIntent(message: string): boolean {
  const normalized = message.toLowerCase().replace(/\s+/g, '')
  return (
    /(?:我的|我有|当前|账户|账号|个人).{0,8}(?:积分|point)/.test(normalized) ||
    /(?:积分|point).{0,8}(?:余额|多少|几分|还剩|剩余|够不够|够吗|可用)/.test(normalized)
  )
}

// ══════════════════════════════════════════════════════════════
// JSON 安全解析
// ══════════════════════════════════════════════════════════════

function safeParseJson(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

// ══════════════════════════════════════════════════════════════
// 卡片兜底补全 — Agent 输出 action 但没输出 card 时自动填充
// ══════════════════════════════════════════════════════════════

function enrichCardsFromContext(
  cards: AiCard[],
  actions: AiPendingAction[],
  context: UserContextSnapshot | null,
): AiCard[] {
  if (!context) return cards

  const enriched = cards.map((card) => {
    if (card.type !== 'MALL_PRODUCT') return card

    const match = context.mallSuggestions.find((product) => product.id === card.id)
    if (!match) return card

    return {
      ...card,
      canRedeem: match.canRedeem,
      description: match.description,
      imageUrl: match.imageUrl,
      perUserLimit: match.perUserLimit,
      pointsCost: match.pointsCost,
      stock: match.stock,
      userBalance: context.points.balance,
    }
  })
  if (actions.length === 0) return enriched

  const existingIds = new Set(cards.map((c) => c.type + ':' + c.id))

  for (const action of actions) {
    if (action.type === 'MALL_REDEEM') {
      // 从上下文找匹配的商品
      const productId = action.payload?.productId as string | undefined
      const match = productId
        ? context.mallSuggestions.find((p) => p.id === productId)
        : context.mallSuggestions[0] // fallback: 第一个可兑换商品

      if (match && !existingIds.has('MALL_PRODUCT:' + match.id)) {
        enriched.push({
          canRedeem: match.canRedeem,
          description: match.description,
          id: match.id,
          imageUrl: match.imageUrl,
          name: match.name,
          perUserLimit: match.perUserLimit,
          pointsCost: match.pointsCost,
          stock: match.stock,
          type: 'MALL_PRODUCT',
          userBalance: context.points.balance,
        })
        existingIds.add('MALL_PRODUCT:' + match.id)
      }
    }

    if (action.type === 'OPEN_LEARNING_RESOURCE') {
      const resourceId = action.payload?.resourceId as string | undefined
      const match = resourceId
        ? context.learningSuggestions.find((r) => r.id === resourceId)
        : context.learningSuggestions[0]

      if (match && !existingIds.has('LEARNING_RESOURCE:' + match.id)) {
        enriched.push({
          actionLabel: match.kind === 'RANGE' ? '进入靶场' : '查看资源',
          category: match.category,
          description: match.description,
          id: match.id,
          kind: match.kind,
          title: match.title,
          type: 'LEARNING_RESOURCE',
        })
        existingIds.add('LEARNING_RESOURCE:' + match.id)
      }
    }

    if (action.type === 'VIEW_VULNERABILITY') {
      const vulnId = action.payload?.vulnerabilityId as string | undefined
      const match = vulnId
        ? context.vulnerabilities.recent.find((v) => v.id === vulnId)
        : context.vulnerabilities.recent[0]

      if (match && !existingIds.has('VULNERABILITY:' + match.id)) {
        enriched.push({
          id: match.id,
          needsSupplement: match.needsSupplement,
          reportNo: match.reportNo,
          severity: match.selfSeverity,
          status: match.status,
          title: match.title,
          type: 'VULNERABILITY',
        })
        existingIds.add('VULNERABILITY:' + match.id)
      }
    }
  }

  return enriched
}

function completeStructuredFromBackend(
  message: string,
  structured: { actions: AiPendingAction[]; cards: AiCard[] },
  context: UserContextSnapshot,
  dataRequestResults: Array<{ ok: boolean; result?: unknown; tool: string }>,
) {
  const cards = [...structured.cards]
  const actions = structured.actions.map((action) => {
    if (action.type !== 'OPEN_LEARNING_RESOURCE') return action
    const resourceId = typeof action.payload?.resourceId === 'string'
      ? action.payload.resourceId
      : typeof action.payload?.id === 'string'
        ? action.payload.id
        : ''
    return resourceId ? { ...action, payload: { ...action.payload, resourceId } } : action
  })
  const existingCardIds = new Set(cards.map((card) => `${card.type}:${card.id}`))
  const existingActionIds = new Set(actions.map((action) => action.id))

  if (hasMallIntent(message, context)) {
    const products = selectMallProductsForBackendCompletion(message, context, dataRequestResults)

    for (const product of products.slice(0, 6)) {
      if (!existingCardIds.has(`MALL_PRODUCT:${product.id}`)) {
        cards.push(buildMallProductCard(product, context))
        existingCardIds.add(`MALL_PRODUCT:${product.id}`)
      }

      const actionId = `redeem_${product.id}`
      if (product.canRedeem && !existingActionIds.has(actionId)) {
        actions.push({
          expiresIn: 300,
          id: actionId,
          label: '立即兑换',
          payload: { productId: product.id },
          type: 'MALL_REDEEM',
        })
        existingActionIds.add(actionId)
      }
    }
  }

  if (hasLearningResourceIntent(message)) {
    const resources = filterLearningResources(message, context)
    const existingLearningActionResourceIds = new Set(
      actions
        .filter((action) => action.type === 'OPEN_LEARNING_RESOURCE')
        .map((action) => action.payload?.resourceId)
        .filter((resourceId): resourceId is string => typeof resourceId === 'string'),
    )
    for (const resource of resources.slice(0, 6)) {
      if (!existingCardIds.has(`LEARNING_RESOURCE:${resource.id}`)) {
        cards.push(buildLearningResourceCard(resource))
        existingCardIds.add(`LEARNING_RESOURCE:${resource.id}`)
      }

      const actionId = `open_learning_${resource.id}`
      if (!existingActionIds.has(actionId) && !existingLearningActionResourceIds.has(resource.id)) {
        actions.push({
          expiresIn: 300,
          id: actionId,
          label: resource.kind === 'RANGE' ? '进入靶场' : '查看资源',
          payload: { resourceId: resource.id },
          type: 'OPEN_LEARNING_RESOURCE',
        })
        existingActionIds.add(actionId)
        existingLearningActionResourceIds.add(resource.id)
      }
    }
  }

  return { actions, cards }
}

function buildLearningResourceCard(resource: UserContextSnapshot['learningSuggestions'][number]): AiCard {
  return {
    actionLabel: resource.kind === 'RANGE' ? '进入靶场' : '查看资源',
    category: resource.category,
    description: resource.description,
    id: resource.id,
    kind: resource.kind,
    title: resource.title,
    type: 'LEARNING_RESOURCE',
  }
}

function filterLearningResources(message: string, context: UserContextSnapshot) {
  const normalized = normalizeIntentText(message)
  const keywords = extractLearningKeywords(message)
  const wantsRange = /靶场|练习环境|实操环境|实操|练习|lab|range/.test(normalized)
  const wantsResource = /教程|资料|文档|工具|课程/.test(normalized) && !wantsRange
  let resources = context.learningSuggestions

  if (wantsRange) resources = resources.filter((resource) => resource.kind === 'RANGE')
  if (wantsResource) resources = resources.filter((resource) => resource.kind === 'RESOURCE')

  if (keywords.length > 0) {
    const matched = resources.filter((resource) => learningResourceMatchesKeywords(resource, keywords))
    if (matched.length > 0) resources = matched
  }

  return resources
}

function learningResourceMatchesKeywords(resource: UserContextSnapshot['learningSuggestions'][number], keywords: string[]) {
  const haystack = normalizeLearningSearchText(`${resource.title} ${resource.category} ${resource.description ?? ''}`)
  return keywords.some((keyword) => haystack.includes(normalizeLearningSearchText(keyword)))
}

function extractLearningKeywords(message: string): string[] {
  const normalized = message.toLowerCase()
  const keywords: string[] = []
  const keywordPatterns = [
    /sql\s*注入|sqli|sql/i,
    /xss|跨站/i,
    /文件上传|上传/i,
    /ssrf/i,
    /csrf/i,
    /越权|权限控制/i,
    /代码审计/i,
    /web/i,
    /综合|cve|漏洞复现/i,
  ]

  for (const pattern of keywordPatterns) {
    const match = normalized.match(pattern)
    if (match?.[0]) keywords.push(match[0])
  }
  return [...new Set(keywords)]
}

function normalizeLearningSearchText(value: string) {
  return value.toLowerCase().replace(/\s+/g, '').replace(/sql注入|sql-injection/g, 'sqli')
}

function selectMallProductsForBackendCompletion(
  message: string,
  context: UserContextSnapshot,
  dataRequestResults: Array<{ ok: boolean; result?: unknown; tool: string }>,
) {
  const productIdsFromTools = getMallProductIdsFromToolResults(dataRequestResults)
  const productsFromTools = productIdsFromTools
    .map((id) => context.mallSuggestions.find((product) => product.id === id))
    .filter((product): product is UserContextSnapshot['mallSuggestions'][number] => Boolean(product))

  if (productsFromTools.length > 0) {
    return productsFromTools.sort((a, b) => Number(b.canRedeem) - Number(a.canRedeem) || a.pointsCost - b.pointsCost)
  }

  return filterMallProducts(message, context)
}

function getMallProductIdsFromToolResults(dataRequestResults: Array<{ ok: boolean; result?: unknown; tool: string }>) {
  const ids: string[] = []
  const seen = new Set<string>()

  for (const result of dataRequestResults) {
    if (!result.ok || !['get_redeem_eligibility', 'search_mall_products'].includes(result.tool)) continue
    collectMallProductIds(result.result, ids, seen)
  }

  return ids
}

function collectMallProductIds(value: unknown, ids: string[], seen: Set<string>) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectMallProductIds(item, ids, seen))
    return
  }
  if (!isRecord(value)) return

  const id = typeof value.id === 'string' ? value.id : ''
  const looksLikeProduct = typeof value.name === 'string' && ('pointsCost' in value || 'stock' in value)
  if (id && looksLikeProduct && !seen.has(id)) {
    ids.push(id)
    seen.add(id)
  }

  for (const child of Object.values(value)) collectMallProductIds(child, ids, seen)
}
