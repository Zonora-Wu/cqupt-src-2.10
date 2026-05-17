import { BadGatewayException, ForbiddenException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common'
import { AiCallPurpose, AiSpace, AuditAction, RoleCode } from '@prisma/client'
import { AuthenticatedRequestUser, ClientRequestMeta } from '../auth/auth.types'
import { PrismaService } from '../prisma/prisma.service'
import { parseStructuredResponse, stripJsonBlock } from './ai.response.service'
import { buildSystemPrompt, buildUserPrompt } from './ai.prompt.service'
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
  UserContextSnapshot,
} from './ai.types'
import { AiToolsService } from './ai.tools.service'

const DEFAULT_OPENAI_BASE_URL = 'http://localhost:5000/v1'
const DEFAULT_OPENAI_MODEL = 'hermes-agent'
const REQUEST_TIMEOUT_MS = 30_000
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
      throw new ForbiddenException('AI 助手额度已停用，请联系管理员')
    }
    if (quotaBefore.remaining <= 0) {
      throw new ForbiddenException('本月 AI token 额度已用尽，请联系管理员调整额度')
    }

    const safeMessage = redactSensitiveText(input.message)

    // 1. 构建用户上下文
    const context = await this.toolsService.buildUserContext(user)

    // 2. 对强结构化、强事务边界的资源查询走确定性业务响应，避免模型超时/编造 ID
    const directResponse = buildDirectResourceResponse(input, context)
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
              directResponse: true,
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

      return {
        ...directResponse,
        mode: input.mode,
        quota: await this.buildQuotaSummary(user.id),
        toolCalls: [],
      }
    }

    // 3. 构建提示词。Hermes Agent 当前不执行后端业务 tool，避免发送 tools 造成 unknown tool 自纠错超时。
    const systemPrompt = buildSystemPrompt(input.mode, context, user.role)
    const tools: ReturnType<typeof getAvailableTools> = []

    // 4. 初始消息
    const messages: OpenAiChatMessage[] = [
      { content: systemPrompt, role: 'system' },
      { content: buildUserPrompt(safeMessage, input.context), role: 'user' },
    ]

    let finalContent = ''
    const toolCallsMade: AiToolCall[] = []
    let totalTokens = 0

    // 4. Tool calling loop — 最多 MAX_TOOL_ROUNDS 轮
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
        timeoutMs: REQUEST_TIMEOUT_MS,
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

      // 4b. Agent 返回了纯文本
      if (choice?.message?.content) {
        finalContent = choice.message.content
        break
      }

      // 4c. 空响应
      break
    }

    // 5. 如果 loop 结束仍无文本，取最后一条 assistant 消息
    if (!finalContent) {
      const lastAssistant = [...messages].reverse().find(
        (m) => m.role === 'assistant' && typeof m.content === 'string' && m.content.length > 0,
      )
      finalContent = (lastAssistant?.content as string) || ''
    }

    // 6. 解析结构化响应
    const structured = parseStructuredResponse(finalContent)
    const displayContent = stripJsonBlock(finalContent) || finalContent

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
            mode: input.mode,
            promptLength: input.message.length,
            quotaRemainingBefore: quotaBefore.remaining,
            redacted: safeMessage !== input.message,
            status: 200,
            tokensUsed: totalTokens || 0,
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

    // 7. 兜底：action 存在但 card 缺失时，从上下文补全
    const enrichedCards = enrichCardsFromContext(structured.cards, structured.actions, context)

    return {
      actions: structured.actions,
      cards: enrichedCards,
      content: displayContent,
      mode: input.mode,
      quota: await this.buildQuotaSummary(user.id),
      toolCalls: toolCallsMade.map((tc) => ({ name: tc.name })),
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
        throw new BadGatewayException({
          detail: body,
          message: 'OpenAI-compatible Agent 调用失败',
          status: response.status,
        })
      }

      return {
        body,
        status: response.status,
      }
    } catch (error) {
      if (error instanceof BadGatewayException) throw error
      const message = error instanceof Error && error.name === 'AbortError'
        ? 'AI 助手响应超时，请稍后重试或改用更具体的问题。'
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

function getVisibleSkillSpaces(role: RoleCode) {
  if (role === RoleCode.ADMIN) return [AiSpace.ADMIN, AiSpace.AUDITOR, AiSpace.STUDENT]
  if (role === RoleCode.AUDITOR) return [AiSpace.AUDITOR]
  return [AiSpace.STUDENT]
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

/**
 * 从用户消息中提取商品相关关键词。
 * 覆盖中文自然表达：我想兑换X、我要换X、换X、有没有X、给我X…
 */
function extractProductKeywords(message: string): string[] {
  // 先剥掉价格修饰 + 量词，避免"400积分以下的商品" → "个的商品"污染提取
  const cleaned = message
    .replace(/\d+\s*(?:积分|分)?\s*(?:以下|以上|以内|左右|内|外)/g, '')
    .replace(/[一两二两三几]个/g, '')
    .replace(/一些/g, '')

  const intentPatterns = [
    /(?:我想|我要|我想要|帮我|给我)(?:兑换|换|买|找|推荐)[个些一二两三]?([^，。！？、\s]{1,8})/,
    /(?:兑换|换|买)[个些]?([^，。！？、\s]{1,8})/,
    /想要[个些]?([^，。！？、\s]{1,8})/,
    /有没有([^，。！？、\s]{1,8})/,
    /可以兑换[个些]?([^，。！？、\s]{1,8})/,
    /能(?:兑换|换)[个些]?([^，。！？、\s]{1,8})/,
    /看看[个些]?([^，。！？、\s]{1,8})/,
    /想要一个?([^，。！？、\s]{1,8})/,
    /找个?([^，。！？、\s]{1,8})/,
    /帮我看看[个些]?([^，。！？、\s]{1,8})/,
    /帮我查[个些]?([^，。！？、\s]{1,8})/,
    /看看有没有([^，。！？、\s]{1,8})/,
    /能兑换([^，。！？、\s]{1,8})/,
    /换个?([^，。！？、\s]{1,8})/,
    /换个?新的([^，。！？、\s]{1,8})/,
    /来[个些]?([^，。！？、\s]{1,8})/,
    /推荐[个些]?([^，。！？、\s]{1,8})/,
    /搜[索下]?([^，。！？、\s]{1,8})/,
  ]

  const extracted: string[] = []
  for (const pattern of intentPatterns) {
    const match = cleaned.match(pattern)
    if (match && match[1]) {
      const word = match[1]
        .replace(/[的了吗呢啊呀吧]$/, '')
        .replace(/^的/, '')
        .trim()
      // 过滤掉纯数字/量词残余 以及泛称词（"商品"、"东西"等）
      if (
        word.length >= 1 &&
        word.length <= 8 &&
        !/^[一二两三]?[个些]?$/.test(word) &&
        !/^\d+$/.test(word) &&
        word !== '商品' &&
        word !== '东西' &&
        word !== '物品' &&
        word !== '奖品' &&
        word !== '礼品'
      ) {
        extracted.push(word)
      }
    }
  }

  return extracted
}

/** 从消息中提取价格约束：{ max?: number; min?: number } */
function extractPriceFilter(message: string): { max?: number; min?: number } {
  const filter: { max?: number; min?: number } = {}
  const maxMatch = message.match(/(\d+)\s*(?:积分|分)?\s*以[下内]/)
  const minMatch = message.match(/(\d+)\s*(?:积分|分)?\s*以[上外]/)
  if (maxMatch) filter.max = parseInt(maxMatch[1], 10)
  if (minMatch) filter.min = parseInt(minMatch[1], 10)
  return filter
}

function buildDirectResourceResponse(
  input: NormalizedAiChatInput,
  context: UserContextSnapshot,
): Pick<AiChatResponse, 'actions' | 'cards' | 'content'> | null {
  if (input.mode !== 'student') return null

  const message = input.message.toLowerCase()
  const asksPoints = /积分|point/.test(message)
  const keywords = extractProductKeywords(message)
  const asksMall =
    /兑换|商品|商城|礼品|奖品|可换|能换|推荐/.test(message) ||
    (keywords.length > 0 && context.mallSuggestions.some((item) =>
      keywords.some((kw) => {
        if (item.name.includes(kw) || item.category.includes(kw)) return true
        if (/[\u4e00-\u9fff]/.test(kw)) return [...kw].some((ch) => item.name.includes(ch))
        return false
      }),
    ))
  const asksVulnerabilities = /漏洞|报告|src|待补充|补充|审核|通过|驳回|修复|证书/.test(message)

  if (!asksPoints && !asksMall && !asksVulnerabilities) return null

  const cards: AiCard[] = []
  const actions: AiPendingAction[] = []
  const lines: string[] = []

  if (asksPoints || asksMall) {
    lines.push(
      '### 当前积分概览',
      `- 可用积分：\`${context.points.balance.toLocaleString('zh-CN')}\` 分`,
      `- 累计获得：${context.points.earned.toLocaleString('zh-CN')} 分`,
      `- 累计支出：${context.points.spent.toLocaleString('zh-CN')} 分`,
      `- 待领取兑换：${context.points.pendingRedemptions} 个`,
    )
  }

  if (asksMall) {
    // 区分"泛问"和"特问"
    const isGeneralQuery = /有什么|哪些|什么|多少|全部|所有|列出|显示|看看商城|积分商城/.test(message)

    let products = context.mallSuggestions
      .filter((item) => item.stock > 0)
      .sort((a, b) => {
        if (a.canRedeem !== b.canRedeem) return a.canRedeem ? -1 : 1
        return a.pointsCost - b.pointsCost
      })

    // 泛问 或 仅有价格约束无具体商品名 → 返回全部（按价格过滤）
    const priceFilter = extractPriceFilter(message)
    const hasPriceFilter = priceFilter.max !== undefined || priceFilter.min !== undefined
    if (isGeneralQuery || (hasPriceFilter && keywords.length === 0)) {
      // 不做关键词过滤，走下面的全量卡片逻辑
    } else if (keywords.length > 0) {
      const matched = products.filter((item) =>
        keywords.some((kw) => {
          if (
            item.name.includes(kw) ||
            item.category.includes(kw) ||
            (item.description ?? '').includes(kw)
          )
            return true
          // 中文词回退：拆成单字匹配，解决"杯子"→"马克杯"这类非连续嵌入
          if (/[\u4e00-\u9fff]/.test(kw)) {
            return [...kw].some((ch) => item.name.includes(ch))
          }
          return false
        }),
      )
      // 用户明确在找某样东西但商城里没有 → 放行给 Agent
      if (matched.length === 0) return null
      products = matched
    } else {
      // 没提取到关键词、非泛问、无价格约束 → 交给 Agent 做模糊搜索
      return null
    }

    // 价格过滤
    if (priceFilter.max !== undefined || priceFilter.min !== undefined) {
      products = products.filter((item) => {
        if (priceFilter.max !== undefined && item.pointsCost > priceFilter.max) return false
        if (priceFilter.min !== undefined && item.pointsCost < priceFilter.min) return false
        return true
      })
    }

    products = products.slice(0, 20)

    const productCards: AiCard[] = products.map((item) => ({
      canRedeem: item.canRedeem,
      description: item.description,
      id: item.id,
      imageUrl: item.imageUrl,
      name: item.name,
      perUserLimit: item.perUserLimit,
      pointsCost: item.pointsCost,
      stock: item.stock,
      type: 'MALL_PRODUCT',
      userBalance: context.points.balance,
    }))

    cards.push(...productCards)
    actions.push(
      ...products
        .filter((item) => item.canRedeem)
        .map((item) => ({
          expiresIn: 300,
          id: `mall_redeem_${item.id}`,
          label: `立即兑换${item.name}`,
          payload: { productId: item.id },
          type: 'MALL_REDEEM' as const,
        })),
    )

    const redeemableCount = products.filter((item) => item.canRedeem).length
    if (lines.length > 0) lines.push('')
    lines.push('### 可兑换商品')
    if (priceFilter.max !== undefined || priceFilter.min !== undefined) {
      const range =
        priceFilter.min !== undefined && priceFilter.max !== undefined
          ? `${priceFilter.min}–${priceFilter.max} 积分`
          : priceFilter.max !== undefined
            ? `${priceFilter.max} 积分以下`
            : `${priceFilter.min} 积分以上`
      lines.push(`- 已按价格范围「${range}」筛选，匹配 ${products.length} 个商品，其中 ${redeemableCount} 个可兑换。`)
    } else if (products.length === 0) {
      lines.push('- 当前没有可展示的积分商城商品。')
    } else {
      lines.push(`- 已根据你的积分筛选出 ${products.length} 个商品，其中 ${redeemableCount} 个可以直接兑换。`)
      lines.push('- 点击下方卡片里的「立即兑换」即可在本页完成操作。')
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
  if (!context || actions.length === 0) return cards

  const enriched = [...cards]
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
