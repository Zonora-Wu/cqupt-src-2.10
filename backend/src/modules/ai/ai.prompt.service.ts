import { RoleCode } from '@prisma/client'
import { AiToolDefinition, NormalizedAiChatInput, UserContextSnapshot } from './ai.types'
import { getAvailableTools } from './ai.tools.registry'

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
  const parts: string[] = ['当前用户数据摘要：']

  // 积分
  parts.push(
    `- 积分：余额 ${context.points.balance}（累计获得 ${context.points.earned}，累计支出 ${context.points.spent}，待领取 ${context.points.pendingRedemptions} 个兑换）`,
  )

  // 漏洞
  parts.push(
    `- 漏洞：共 ${context.vulnerabilities.total} 个（待补充 ${context.vulnerabilities.needsSupplement}，审核中 ${context.vulnerabilities.pending}，已确认 ${context.vulnerabilities.confirmed}）`,
  )

  if (context.vulnerabilities.recent.length > 0) {
    parts.push('  近期漏洞[JSON]：')
    for (const v of context.vulnerabilities.recent) {
      const statusTag = v.needsSupplement ? ' ⚠️待补充' : ''
      parts.push(
        `    {id:"${v.id}",reportNo:"${v.reportNo}",title:"${v.title}",status:"${v.status}",severity:"${v.selfSeverity}",needsSupplement:${v.needsSupplement}}${statusTag}`,
      )
    }
  }

  // 学习推荐 — 包含 ID
  if (context.learningSuggestions.length > 0) {
    const items = context.learningSuggestions
      .map((r) => `{id:"${r.id}",title:"${r.title}",category:"${r.category}",kind:"${r.kind}"}`)
      .join(', ')
    parts.push(`- 学习资源[JSON]（共 ${context.learningSuggestions.length} 个推荐）：${items}`)
  }

  // 商城推荐 — 包含 ID
  if (context.mallSuggestions.length > 0) {
    const items = context.mallSuggestions
      .map(
        (p) =>
          `{id:"${p.id}",name:"${p.name}",points:${p.pointsCost},stock:${p.stock},imageUrl:${p.imageUrl ? '"' + p.imageUrl + '"' : 'null'}}`,
      )
      .join(', ')
    parts.push(`- 积分商城商品[JSON]（平台共 ${context.mallSuggestions.length} 个可见商品）：${items}`)
  }

  parts.push(
    '以上数据由平台注入，已反映当前最新状态。只有当用户明确询问自己的积分、商品兑换、漏洞状态或学习资源推荐时，才使用这些摘要回答；平台名、SRC 概念、漏洞知识、报告写作方法等泛问不等于请求个人业务数据，不要主动展示用户私有数据。不要编造不存在的数据。',
  )

  return parts.join('\n')
}

function buildToolPrompt(role: RoleCode): string {
  const tools = getAvailableTools(role)
  if (tools.length === 0) return ''

  const toolNames = tools.map((t) => t.name).join('、')
  return `你有 ${tools.length} 个可用工具：${toolNames}。当用户的问题需要查询平台数据（积分、漏洞、学习资源、商城商品等）时，请主动调用工具获取准确信息，不要猜测或编造数据。如果工具返回错误，请如实告知用户并建议替代方案。`
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
MALL_PRODUCT 必填: type,id,name,pointsCost,stock,userBalance,canRedeem,imageUrl(可为null)
LEARNING_RESOURCE 必填: type,id,title,category,kind,actionLabel
VULNERABILITY 必填: type,id,reportNo,title,status,severity,needsSupplement
推荐商品时 card+action 成对出现。纯文本问答不输出卡片。`
}
