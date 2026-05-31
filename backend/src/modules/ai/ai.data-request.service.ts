import { ForbiddenException, Inject, Injectable } from '@nestjs/common'
import { RoleCode } from '@prisma/client'
import { AuthenticatedRequestUser } from '../auth/auth.types'
import { AiToolsService } from './ai.tools.service'
import { getAvailableTools, isToolAllowed } from './ai.tools.registry'
import {
  AiCard,
  AiDataRequest,
  AiDataRequestResult,
  AiDataRequestToolName,
  AiPendingAction,
  UserContextSnapshot,
} from './ai.types'

const MAX_DATA_REQUESTS_PER_TURN = 4

@Injectable()
export class AiDataRequestService {
  constructor(@Inject(AiToolsService) private readonly tools: AiToolsService) {}

  buildPrompt(role: RoleCode): string {
    const tools = getAvailableTools(role).map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }))

    return [
      '【平台数据按需请求协议】',
      '当前不启用 OpenAI tool_calls。若回答必须依赖未注入的实时平台数据，你只能在回复末尾输出 dataRequests JSON，由 NestJS 后端代为执行只读查询；不要自行 curl、不要索要 JWT、不要声称已经查询。',
      '如果已注入上下文足够回答，直接回答，不要输出 dataRequests。',
      '一次最多请求 4 个工具；只请求回答当前问题必需的数据；arguments 只放过滤条件，不要包含 userId、role、JWT 或权限字段，后端会基于当前登录用户强制覆盖。',
      'dataRequests 格式如下，必须是唯一 JSON 块：',
      '```json',
      '{"dataRequests":[{"tool":"search_mall_products","arguments":{"keyword":"笔"},"reason":"用户询问可兑换的笔"}]}',
      '```',
      '后端回灌 platformToolResults 后，你必须基于结果生成最终中文回复和 cards/actions；最终回复不要再输出 dataRequests。',
      `本轮可请求的只读工具：${JSON.stringify(tools)}`,
    ].join('\n')
  }

  parse(content: string): AiDataRequest[] {
    const raw = extractDataRequestJson(content)
    if (!raw) return []

    try {
      const parsed = JSON.parse(raw) as { dataRequests?: unknown }
      if (!Array.isArray(parsed.dataRequests)) return []
      const requests: AiDataRequest[] = []
      for (const [index, item] of parsed.dataRequests.entries()) {
        if (!isRecord(item)) continue
        const tool = typeof item.tool === 'string' ? item.tool : ''
        if (!isKnownDataRequestToolName(tool)) continue
        const args = isRecord(item.arguments) ? item.arguments : {}
        requests.push({
          arguments: sanitizeArguments(args),
          id: typeof item.id === 'string' && item.id.trim() ? item.id.trim() : `dr_${index + 1}`,
          reason: typeof item.reason === 'string' ? item.reason.slice(0, 200) : undefined,
          tool,
        })
        if (requests.length >= MAX_DATA_REQUESTS_PER_TURN) break
      }
      return requests
    } catch {
      return []
    }
  }

  strip(content: string): string {
    const fence = findDataRequestFence(content)
    if (fence) return content.replace(fence.full, '').trim()

    const bare = content.match(/\{[\s\S]*"dataRequests"[\s\S]*\}/)
    return bare ? content.replace(bare[0], '').trim() : content
  }

  async execute(requests: AiDataRequest[], user: AuthenticatedRequestUser): Promise<AiDataRequestResult[]> {
    const results: AiDataRequestResult[] = []
    for (const request of requests.slice(0, MAX_DATA_REQUESTS_PER_TURN)) {
      if (!isToolAllowed(request.tool, user.role)) {
        results.push({ error: `角色 ${user.role} 不能请求 ${request.tool}`, id: request.id, ok: false, tool: request.tool })
        continue
      }

      try {
        const raw = await this.tools.executeTool(
          { arguments: request.arguments, id: request.id, name: request.tool },
          user,
        )
        const parsed = safeParseJson(raw)
        if (isRecord(parsed) && typeof parsed.error === 'string') {
          results.push({ error: parsed.error, id: request.id, ok: false, tool: request.tool })
        } else {
          results.push({ id: request.id, ok: true, result: parsed, tool: request.tool })
        }
      } catch (error) {
        const message = error instanceof ForbiddenException
          ? '没有权限请求该平台数据'
          : error instanceof Error
            ? error.message
            : '平台数据请求执行失败'
        results.push({ error: message, id: request.id, ok: false, tool: request.tool })
      }
    }
    return results
  }

  buildResultPrompt(results: AiDataRequestResult[]): string {
    const promptSafeResults = stripPromptUnsafeMediaFields(results)
    return [
      '【platformToolResults】',
      '以下 JSON 是 NestJS 后端基于当前登录用户 JWT/RBAC 执行只读平台数据请求后的结果。只能使用这些结果和上一轮上下文回答；不要编造未返回的数据。图片字段不会进入模型上下文，商品卡片图片会由后端按真实 id 在最终响应阶段补全。',
      JSON.stringify(promptSafeResults, null, 2),
      '请现在生成最终中文回复。如果需要商品/学习资源/漏洞卡片，只能引用 platformToolResults 或已注入上下文中的真实 id。最终回复末尾可输出 cards/actions JSON，但不要再输出 dataRequests。',
    ].join('\n')
  }

  filterStructuredOutput(
    cards: AiCard[],
    actions: AiPendingAction[],
    context: UserContextSnapshot,
    results: AiDataRequestResult[],
  ): { cards: AiCard[]; actions: AiPendingAction[] } {
    const allow = buildAllowedIdSet(context, results)
    const filteredCards = cards.filter((card) => allow.ids.has(card.id))
    const filteredActions = actions.filter((action) => isActionAllowed(action, allow))
    return { actions: filteredActions, cards: filteredCards }
  }
}

function extractDataRequestJson(content: string) {
  const fence = findDataRequestFence(content)
  if (fence) return fence.body
  const bare = content.match(/\{[\s\S]*"dataRequests"[\s\S]*\}/)
  return bare?.[0] ?? ''
}

function findDataRequestFence(content: string) {
  const matches = [...content.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/g)]
  const found = matches.find((match) => /"dataRequests"\s*:/.test(match[1]))
  return found ? { body: found[1], full: found[0] } : null
}

function isKnownDataRequestToolName(value: string): value is AiDataRequestToolName {
  return [
    'get_audit_log_summary',
    'get_assigned_reports',
    'get_my_vulnerabilities',
    'get_platform_stats',
    'get_point_balance',
    'get_redeem_eligibility',
    'get_review_queue_stats',
    'get_user_summary',
    'search_learning_resources',
    'search_mall_products',
  ].includes(value)
}

function sanitizeArguments(args: Record<string, unknown>): Record<string, unknown> {
  const deniedKeys = new Set(['userId', 'role', 'permission', 'permissions', 'jwt', 'token', 'accessToken', 'refreshToken'])
  const sanitized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(args)) {
    if (deniedKeys.has(key)) continue
    if (typeof value === 'string') sanitized[key] = value.slice(0, 120)
    else if (typeof value === 'number' && Number.isFinite(value)) sanitized[key] = value
    else if (typeof value === 'boolean') sanitized[key] = value
  }
  return sanitized
}

function safeParseJson(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return { raw: value }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stripPromptUnsafeMediaFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripPromptUnsafeMediaFields)
  if (!isRecord(value)) return value

  const next: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value)) {
    if (key === 'imageUrl') {
      next.hasImage = typeof child === 'string' && child.length > 0
      continue
    }
    next[key] = stripPromptUnsafeMediaFields(child)
  }
  return next
}

function buildAllowedIdSet(context: UserContextSnapshot, results: AiDataRequestResult[]) {
  const ids = new Set<string>()
  const productIds = new Set<string>()
  const learningResourceIds = new Set<string>()
  const vulnerabilityIds = new Set<string>()

  for (const product of context.mallSuggestions) {
    ids.add(product.id)
    productIds.add(product.id)
  }
  for (const resource of context.learningSuggestions) {
    ids.add(resource.id)
    learningResourceIds.add(resource.id)
  }
  for (const vulnerability of context.vulnerabilities.recent) {
    ids.add(vulnerability.id)
    vulnerabilityIds.add(vulnerability.id)
  }

  for (const result of results) collectIds(result.result, { ids, learningResourceIds, productIds, vulnerabilityIds })
  return { ids, learningResourceIds, productIds, vulnerabilityIds }
}

function collectIds(value: unknown, sets: {
  ids: Set<string>
  productIds: Set<string>
  learningResourceIds: Set<string>
  vulnerabilityIds: Set<string>
}) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectIds(item, sets))
    return
  }
  if (!isRecord(value)) return

  const id = typeof value.id === 'string' ? value.id : ''
  if (id) {
    sets.ids.add(id)
    if (typeof value.name === 'string' && ('pointsCost' in value || 'stock' in value)) sets.productIds.add(id)
    if (typeof value.title === 'string' && 'kind' in value) sets.learningResourceIds.add(id)
    if (typeof value.reportNo === 'string') sets.vulnerabilityIds.add(id)
  }

  for (const child of Object.values(value)) collectIds(child, sets)
}

function isActionAllowed(action: AiPendingAction, allow: ReturnType<typeof buildAllowedIdSet>) {
  const payload = action.payload
  if (action.type === 'MALL_REDEEM') {
    const productId = typeof payload.productId === 'string' ? payload.productId : typeof payload.id === 'string' ? payload.id : ''
    return productId.length > 0 && allow.productIds.has(productId)
  }
  if (action.type === 'OPEN_LEARNING_RESOURCE') {
    const resourceId = typeof payload.resourceId === 'string' ? payload.resourceId : typeof payload.id === 'string' ? payload.id : ''
    return resourceId.length > 0 && allow.learningResourceIds.has(resourceId)
  }
  if (action.type === 'VIEW_VULNERABILITY') {
    const vulnerabilityId = typeof payload.vulnerabilityId === 'string' ? payload.vulnerabilityId : typeof payload.id === 'string' ? payload.id : ''
    return vulnerabilityId.length > 0 && allow.vulnerabilityIds.has(vulnerabilityId)
  }
  return false
}
