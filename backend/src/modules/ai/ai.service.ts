import { BadGatewayException, ForbiddenException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common'
import { AiCallPurpose, AiSpace, AuditAction, RoleCode } from '@prisma/client'
import { AuthenticatedRequestUser, ClientRequestMeta } from '../auth/auth.types'
import { PrismaService } from '../prisma/prisma.service'
import { NormalizedAiChatInput, OpenAiChatPayload } from './ai.types'

const DEFAULT_OPENAI_BASE_URL = 'http://localhost:5000/v1'
const DEFAULT_OPENAI_MODEL = 'hermes-agent'
const REQUEST_TIMEOUT_MS = 30_000
const DEFAULT_AI_DAILY_TOKENS = 20_000
const DEFAULT_AI_WEEKLY_TOKENS = 60_000
const DEFAULT_AI_MONTHLY_TOKENS = 100_000
const AI_DEFAULT_DAILY_TOKENS_KEY = 'ai_default_daily_tokens'
const AI_DEFAULT_WEEKLY_TOKENS_KEY = 'ai_default_weekly_tokens'
const AI_DEFAULT_MONTHLY_TOKENS_KEY = 'ai_default_monthly_tokens'
const AI_QUOTA_PERIOD_KEY = 'ai_quota_period'
type AiQuotaPeriod = 'DAY' | 'WEEK' | 'MONTH'

@Injectable()
export class AiService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async checkAgentHealth() {
    const startedAt = Date.now()
    const result = await this.requestOpenAi('models', {
      method: 'GET',
      timeoutMs: 5000,
    })

    return {
      models: result.body,
      latencyMs: Date.now() - startedAt,
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

  async chat(input: NormalizedAiChatInput, user: AuthenticatedRequestUser, meta: ClientRequestMeta) {
    this.assertCanUseMode(input.mode, user)
    const quotaBefore = await this.buildQuotaSummary(user.id)
    if (!quotaBefore.enabled) {
      throw new ForbiddenException('AI 助手额度已停用，请联系管理员')
    }
    if (quotaBefore.remaining <= 0) {
      throw new ForbiddenException('本月 AI token 额度已用尽，请联系管理员调整额度')
    }

    const safeMessage = redactSensitiveText(input.message)
    const payload: OpenAiChatPayload = {
      messages: [
        {
          content: buildSystemPrompt(input.mode),
          role: 'system',
        },
        {
          content: buildUserPrompt(safeMessage, input.context),
          role: 'user',
        },
      ],
      model: getOpenAiModel(),
      user: user.id,
    }

    const result = await this.requestOpenAi('chat/completions', {
      body: payload,
      method: 'POST',
      timeoutMs: REQUEST_TIMEOUT_MS,
    })

    const content = extractOpenAiContent(result.body)
    const tokensUsed = extractTokenUsage(result.body) ?? estimateTokens(payload.messages.map((message) => message.content).join('\n'), content)

    await this.prisma.$transaction(async (tx) => {
      await tx.aiCallLog.create({
        data: {
          aiSpace: getAiSpace(input.mode),
          hermesRunId: extractRunId(result.body),
          ipAddress: meta.ipAddress,
          modelName: getOpenAiModel(),
          outputSummary: content.slice(0, 1000),
          purpose: AiCallPurpose.CHAT,
          sanitizedInputSummary: safeMessage.slice(0, 1000),
          tokensUsed,
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
            status: result.status,
            tokensUsed,
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
      content,
      mode: input.mode,
      quota: await this.buildQuotaSummary(user.id),
      response: result.body,
    }
  }

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
      resetAt: getNextPeriodStart(quotaSettings.quotaPeriod),
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
      throw new ServiceUnavailableException(error instanceof Error ? error.message : 'OpenAI-compatible Agent 暂不可用')
    } finally {
      clearTimeout(timeout)
    }
  }
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

async function readResponseBody(response: Response) {
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    return response.json()
  }

  return response.text()
}

function redactSensitiveText(text: string) {
  return text
    .replace(/(authorization:\s*bearer\s+)[^\s]+/gi, '$1[REDACTED]')
    .replace(/(cookie:\s*)[^\n\r]+/gi, '$1[REDACTED]')
    .replace(/((?:access|refresh)?token["'\s:=]+)[A-Za-z0-9._~+/=-]{12,}/gi, '$1[REDACTED]')
    .replace(/(password["'\s:=]+)[^\s,'"，。；;]+/gi, '$1[REDACTED]')
}

function buildSystemPrompt(mode: NormalizedAiChatInput['mode']) {
  const base =
    '你是 CQUPT-SRC 校园漏洞响应平台的 AI 助手。你只能提供授权范围内的防御性安全建议，不能指导未授权攻击、绕过、隐蔽持久化、凭据窃取或数据外传。所有结论仅供辅助，最终由人工确认。'

  if (mode === 'auditor') {
    return `${base} 当前场景是审核员辅助，请重点检查漏洞价值、复现材料完整性、等级建议和修复建议。`
  }

  if (mode === 'admin') {
    return `${base} 当前场景是管理员辅助，请重点支持运营分析、规则草拟、风险摘要和平台治理建议。`
  }

  return `${base} 当前场景是学生辅助，请重点帮助整理漏洞报告、补全复现说明、提醒敏感信息脱敏和推荐学习路径。`
}

function buildUserPrompt(message: string, context?: Record<string, unknown>) {
  if (!context) return message

  return `${message}\n\n上下文 JSON：\n${JSON.stringify(context)}`
}

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
  const totalTokens = (usage as { total_tokens?: unknown; totalTokens?: unknown }).total_tokens ?? (usage as { totalTokens?: unknown }).totalTokens
  const numberValue = Number(totalTokens)
  return Number.isFinite(numberValue) && numberValue > 0 ? Math.ceil(numberValue) : null
}

function extractRunId(body: unknown) {
  if (!body || typeof body !== 'object') return undefined
  const id = (body as { id?: unknown }).id
  return typeof id === 'string' ? id : undefined
}

function estimateTokens(prompt: string, completion: string) {
  return Math.max(1, Math.ceil((prompt.length + completion.length) / 2))
}

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
