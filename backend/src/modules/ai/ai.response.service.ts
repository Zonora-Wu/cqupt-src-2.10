import { AiCard, AiPendingAction } from './ai.types'

type ParsedResponse = {
  cards: AiCard[]
  actions: AiPendingAction[]
}

/**
 * 从 Agent 回复文本中提取结构化内容。
 * Agent 被训练为在回复末尾以特定 JSON 格式输出 cards 和 actions：
 *
 * ```json
 * {
 *   "cards": [...],
 *   "actions": [...]
 * }
 * ```
 *
 * 如果解析失败，返回空数组（不阻塞纯文本回复）。
 */
export function parseStructuredResponse(content: string): ParsedResponse {
  const result: ParsedResponse = { actions: [], cards: [] }

  if (!content) return result

  // 只提取真正的结构化 cards/actions JSON 块；普通代码块（尤其 json 示例）必须保留给前端展示
  let jsonStr = ''
  const fenceMatches = [...content.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/g)]
  const structuredFence = fenceMatches.find((match) => /"cards"\s*:/.test(match[1]) && /"actions"\s*:/.test(match[1]))
  if (structuredFence) {
    jsonStr = structuredFence[1]
  } else {
    const jsonMatch = content.match(/\{[\s\S]*"cards"[\s\S]*"actions"[\s\S]*\}/)
    if (!jsonMatch) return result
    jsonStr = jsonMatch[0]
  }

  try {
    const parsed = JSON.parse(jsonStr) as {
      actions?: Array<Record<string, unknown>>
      cards?: Array<Record<string, unknown>>
    }

    if (Array.isArray(parsed.cards)) {
      result.cards = parsed.cards.map(normalizeCard).filter((c): c is AiCard => c !== null)
    }

    if (Array.isArray(parsed.actions)) {
      result.actions = parsed.actions.map(normalizeAction).filter((a): a is AiPendingAction => a !== null)
    }
  } catch {
    // JSON 解析失败，忽略结构化提取
  }

  return result
}

/** 从 Agent 回复中剥离 JSON 块，返回纯文本 */
export function stripJsonBlock(content: string): string {
  const fenceMatches = [...content.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/g)]
  const structuredFence = fenceMatches.find((match) => /"cards"\s*:/.test(match[1]) && /"actions"\s*:/.test(match[1]))
  if (structuredFence) {
    return content.replace(structuredFence[0], '').trim()
  }

  const jsonMatch = content.match(/\{[\s\S]*"cards"[\s\S]*"actions"[\s\S]*\}/)
  if (!jsonMatch) return content
  return content.replace(jsonMatch[0], '').trim()
}

// ── Normalizers ──

function normalizeCard(raw: Record<string, unknown>): AiCard | null {
  const type = raw.type as string | undefined
  if (!type) return null

  switch (type) {
    case 'LEARNING_RESOURCE':
      if (!raw.id || !raw.title) return null
      return {
        actionLabel: (raw.actionLabel as string) || '查看资源',
        category: (raw.category as string) || '',
        description: (raw.description as string) ?? null,
        id: raw.id as string,
        kind: (raw.kind as string) || 'RESOURCE',
        title: raw.title as string,
        type: 'LEARNING_RESOURCE',
      }

    case 'MALL_PRODUCT':
      if (!raw.id || !raw.name) return null
      return {
        actionId: (raw.actionId as string) ?? undefined,
        canRedeem: Boolean(raw.canRedeem),
        description: (raw.description as string) ?? null,
        id: raw.id as string,
        imageUrl: (raw.imageUrl as string) ?? null,
        name: raw.name as string,
        perUserLimit: Number(raw.perUserLimit) || undefined,
        pointsCost: Number(raw.pointsCost) || 0,
        stock: Number(raw.stock) || 0,
        type: 'MALL_PRODUCT',
        userBalance: Number(raw.userBalance) || 0,
      }

    case 'VULNERABILITY':
      if (!raw.id || !raw.reportNo) return null
      return {
        id: raw.id as string,
        needsSupplement: Boolean(raw.needsSupplement),
        reportNo: raw.reportNo as string,
        severity: (raw.severity as string) || '',
        status: (raw.status as string) || '',
        title: (raw.title as string) || '',
        type: 'VULNERABILITY',
      }

    default:
      return null
  }
}

function normalizeAction(raw: Record<string, unknown>): AiPendingAction | null {
  const type = raw.type as string | undefined
  if (!type || !raw.id || !raw.label) return null

  const allowedTypes = ['MALL_REDEEM', 'OPEN_LEARNING_RESOURCE', 'VIEW_VULNERABILITY']
  if (!allowedTypes.includes(type)) return null

  return {
    expiresIn: Number(raw.expiresIn) || 300,
    id: raw.id as string,
    label: raw.label as string,
    payload: (raw.payload as Record<string, unknown>) ?? {},
    type: type as AiPendingAction['type'],
  }
}
