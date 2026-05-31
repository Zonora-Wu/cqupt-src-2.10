import { RoleCode } from '@prisma/client'
import { AiToolDefinition, NormalizedAiChatInput, UserContextSnapshot } from './ai.types'

/** 构造含用户上下文 + tool 声明的 system prompt */
export function buildSystemPrompt(
  mode: NormalizedAiChatInput['mode'],
  context: UserContextSnapshot | null,
  role: RoleCode,
  skillRoutePrompt = '',
): string {
  const base =
    '你是 CQUPT-SRC 校园漏洞响应与安全学习平台的 AI 助手，名字叫“邮宝”。对外自称“邮宝”，不要自称 Hermes、模型或通用机器人。人格：专业、克制、友善，默认使用中文，回答要结构化、可执行，不夸大能力。安全规则：只提供授权范围内的防御性安全建议，不能指导未授权攻击、绕过、隐蔽持久化、凭据窃取或数据外传。隔离规则：用户数据按登录用户强隔离；你只能使用当前请求中由后端提供的上下文和工具返回的数据，不得声称或尝试访问其他用户、其他角色或后台未授权数据；当用户要求查看、推断、导出他人信息时必须拒绝，并建议走平台授权流程。Skill 规则：AI skill 库由后端按角色和意图显式路由；你只能遵循本轮后端激活的 skills，不能自行启用被禁止的角色能力。所有结论仅供辅助，最终由人工确认。'

  const modePrompt = getModePrompt(mode)
  const contextPrompt = context ? buildContextPrompt(context) : ''
  const toolPrompt = buildToolPrompt(role)

  return `${base}\n${skillRoutePrompt}\n${modePrompt}\n${contextPrompt}\n${toolPrompt}`.trim()
}

function getModePrompt(mode: NormalizedAiChatInput['mode']): string {
  const cardRules = getCardOutputRules()

  if (mode === 'auditor') {
    return `当前场景：审核员辅助。请重点检查漏洞价值、复现材料完整性、等级建议和修复建议。你可以使用工具查询分配给你的漏洞和审核队列统计。\n${cardRules}`
  }
  if (mode === 'admin') {
    return `当前场景：管理员辅助。请重点支持运营分析、规则草拟、风险摘要和平台治理建议。你可以使用工具查询平台统计和审计日志。`
  }
  return `当前场景：学生辅助。请重点帮助整理漏洞报告、补全复现说明、提醒敏感信息脱敏、推荐学习路径、查询积分和兑换商品。你可以使用工具查询你的个人信息、漏洞、积分、学习资源和商城商品。\n${cardRules}`
}

function buildContextPrompt(context: UserContextSnapshot): string {
  const injected = new Set(context.injectedDomains)
  const parts: string[] = ['当前用户数据摘要（后端按本轮意图最小化注入）：']
  parts.push(`- 已注入模块：${context.injectedDomains.length > 0 ? context.injectedDomains.join(', ') : '无实时业务数据'}`)
  if (context.omittedDomains.length > 0) {
    parts.push(`- 未注入模块：${context.omittedDomains.join(', ')}。未注入表示本轮没有识别到相关业务查询，不代表数据不存在。`)
  }

  // 积分
  if (injected.has('points') || injected.has('mall')) {
    parts.push(
      `- 积分：余额 ${context.points.balance}（累计获得 ${context.points.earned}，累计支出 ${context.points.spent}，待领取 ${context.points.pendingRedemptions} 个兑换）`,
    )
  }

  // 漏洞
  if (injected.has('vulnerabilities')) {
    parts.push(
      `- 漏洞：共 ${context.vulnerabilities.total} 个（待补充 ${context.vulnerabilities.needsSupplement}，审核中 ${context.vulnerabilities.pending}，已确认 ${context.vulnerabilities.confirmed}）`,
    )
  }

  if (injected.has('vulnerabilities') && context.vulnerabilities.recent.length > 0) {
    parts.push('  近期漏洞[JSON]：')
    for (const v of context.vulnerabilities.recent) {
      const statusTag = v.needsSupplement ? ' ⚠️待补充' : ''
      parts.push(
        `    {id:"${v.id}",reportNo:"${v.reportNo}",title:"${v.title}",status:"${v.status}",severity:"${v.selfSeverity}",needsSupplement:${v.needsSupplement}}${statusTag}`,
      )
    }
  }

  // 学习推荐 — 包含 ID
  if (injected.has('learning') && context.learningSuggestions.length > 0) {
    const items = context.learningSuggestions
      .map((r) => `{id:"${r.id}",title:"${r.title}",category:"${r.category}",kind:"${r.kind}"}`)
      .join(', ')
    parts.push(`- 学习资源[JSON]（共 ${context.learningSuggestions.length} 个推荐）：${items}`)
  }

  // 商城结构化列表放在 user prompt 的 platformRuntimeData，避免 system prompt 与 user prompt 重复注入。
  if (injected.has('mall') && context.mallSuggestions.length > 0) {
    parts.push(
      `- 积分商城：本轮已注入 ${context.mallSuggestions.length} 个可见商品，结构化详情见附加上下文 platformRuntimeData.mallProducts；图片字段不进入模型上下文。`,
    )
  }

  parts.push(
    '以上平台数据由后端在本轮请求中实时查库、按需注入。只允许使用已注入模块回答实时业务数据；未注入模块不能当作“为空/没有”，也不要编造不存在的平台数据。若用户明确请求未注入的实时业务数据，只能按 dataRequests 协议请求后端代查，不能自行访问后端、数据库或外部网络。平台名、SRC 概念、漏洞知识、报告写作方法等泛问不等于请求个人业务数据，不要主动展示用户私有数据。用户问“能兑换/可以兑换哪些商品”且已注入 mall 时，优先返回 canRedeem=true 的商品；用户问“兑换不了/不能兑换/积分不够哪些商品”且已注入 mall 时，优先返回 canRedeem=false 的商品，并简要说明通常是积分、库存或限购原因。用户要求“靶场/实操/练习环境”且要平台内推荐时，只有已注入 learning 才能推荐平台资源，且只能推荐 kind 为 RANGE 的学习资源，不要混入 RESOURCE 工具资料。用户要求“全网热门、业内常用、公开靶场”等平台外建议时，不要把平台资源伪装成全网热度；可以基于通用知识给文本建议，并说明平台上下文不包含全网实时热度数据。',
  )

  return parts.join('\n')
}

function buildToolPrompt(role: RoleCode): string {
  void role
  return '当前请求没有启用 OpenAI function/tool_calls。若需要未注入的实时平台数据，只能按上方 dataRequests JSON 协议请求后端代查；最终回答只能使用已注入上下文和后端回灌的 platformToolResults。'
}

/** 构造 user prompt */
export function buildUserPrompt(message: string, extraContext?: Record<string, unknown>): string {
  if (!extraContext || Object.keys(extraContext).length === 0) return message
  return `${message}\n\n附加上下文：\n${JSON.stringify(extraContext, null, 2)}`
}

// ════════════════════════════════════════════════════════════
// 卡片输出规则 — 告诉 Agent 如何在前端渲染可交互卡片
// ════════════════════════════════════════════════════════════

function getCardOutputRules(): string {
  return `【卡片规则】推荐商品/靶场/漏洞时，在回复末尾必须输出 JSON 块：
` + '```json' + `
{"cards":[{"type":"LEARNING_RESOURCE|MALL_PRODUCT|VULNERABILITY",...}],"actions":[{"type":"MALL_REDEEM|OPEN_LEARNING_RESOURCE|VIEW_VULNERABILITY","label":"按钮文字","id":"act_xxx","payload":{}}]}
` + '```' + `
MALL_PRODUCT 必填: type,id,name,pointsCost,stock,userBalance,canRedeem；不要输出 imageUrl，后端会按真实 id 补全图片
用户询问商品/兑换结果时，应尽量输出 MALL_PRODUCT 卡片。可兑换列表只放 canRedeem=true；不可兑换列表只放 canRedeem=false
LEARNING_RESOURCE 必填: type,id,title,category,kind,actionLabel。平台资源卡片只能引用上下文里的真实资源。用户要求平台靶场时，LEARNING_RESOURCE.kind 必须为 RANGE，按钮文案用“进入靶场”；RESOURCE 只能在用户要求资料/教程/文档时推荐。用户要求全网/热门/公开靶场且平台上下文没有全网热度数据时，不要输出平台资源卡片，只给文本建议
VULNERABILITY 必填: type,id,reportNo,title,status,severity,needsSupplement
推荐商品时 card+action 成对出现。纯文本问答不输出卡片。`
}
