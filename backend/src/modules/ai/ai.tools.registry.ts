import { RoleCode } from '@prisma/client'
import { AiToolDefinition } from './ai.types'

// ══════════════════════════════════════════════════════════════
// Layer 1 — 只读·用户域（所有角色）
// ══════════════════════════════════════════════════════════════

const TOOL_GET_USER_SUMMARY: AiToolDefinition = {
  description:
    '获取当前用户的平台概览摘要：积分余额、漏洞数量（总数/待补充/已确认/审核中）、近期漏洞列表。当用户询问"我的积分"、"我的漏洞"、"我的概览"时调用。',
  name: 'get_user_summary',
  parameters: {
    properties: {},
    type: 'object',
  },
}

const TOOL_GET_MY_VULNERABILITIES: AiToolDefinition = {
  description:
    '获取当前用户提交的漏洞列表，可按状态过滤。当用户询问"我提交了哪些漏洞"、"有哪些需要补充的漏洞"、"审核通过的漏洞"时调用。',
  name: 'get_my_vulnerabilities',
  parameters: {
    properties: {
      status: {
        description:
          '漏洞状态过滤，可选值：SUBMITTED(已提交)、PENDING_REVIEW(审核中)、NEEDS_SUPPLEMENT(待补充)、CONFIRMED(已确认)、REJECTED(已驳回)、CERTIFIED(已发证)。不传则返回全部。',
        enum: ['SUBMITTED', 'PENDING_REVIEW', 'NEEDS_SUPPLEMENT', 'CONFIRMED', 'FIXING', 'CERTIFIED', 'REJECTED'],
        type: 'string',
      },
    },
    type: 'object',
  },
}

const TOOL_GET_POINT_BALANCE: AiToolDefinition = {
  description:
    '获取当前用户的积分详情：当前余额、累计获得、累计支出、待领取兑换数。当用户询问"我多少积分"、"积分够不够"时调用。',
  name: 'get_point_balance',
  parameters: {
    properties: {},
    type: 'object',
  },
}

const TOOL_GET_REDEEM_ELIGIBILITY: AiToolDefinition = {
  description:
    '检查当前用户是否满足兑换某个积分商城商品的条件：积分是否足够、库存是否充足、是否超过每人限兑数量。当用户询问"我能兑换X吗"、"有什么可以兑换的"时调用。',
  name: 'get_redeem_eligibility',
  parameters: {
    properties: {
      keyword: {
        description: '商品名称关键词，可选。不传则返回所有可兑换商品的资格检查结果。',
        type: 'string',
      },
    },
    type: 'object',
  },
}

const TOOL_SEARCH_LEARNING_RESOURCES: AiToolDefinition = {
  description:
    '搜索平台学习中心的资源（靶场、教程、文档等）。当用户询问"找SQL注入靶场"、"有什么学习资料"、"推荐学习路径"时调用。',
  name: 'search_learning_resources',
  parameters: {
    properties: {
      category: {
        description: '资源分类，如"Web 靶场"、"二进制安全"、"密码学"。可选，不传则返回全部。',
        type: 'string',
      },
      keyword: {
        description: '标题/描述中的搜索关键词，如"SQL注入"、"XSS"、"文件上传"。',
        type: 'string',
      },
      kind: {
        description: '资源类型：RANGE(靶场/实操) 或 RESOURCE(资料/文档)。可选。',
        enum: ['RANGE', 'RESOURCE'],
        type: 'string',
      },
    },
    type: 'object',
  },
}

const TOOL_SEARCH_MALL_PRODUCTS: AiToolDefinition = {
  description:
    '搜索积分商城中的商品。当用户询问"有什么可以兑换"、"商城有什么"、"想兑换钥匙扣"时调用。',
  name: 'search_mall_products',
  parameters: {
    properties: {
      category: {
        description: '商品分类，如"实体奖励"。可选，不传则返回全部在售商品。',
        type: 'string',
      },
      keyword: {
        description: '商品名称关键词。可选。',
        type: 'string',
      },
    },
    type: 'object',
  },
}

// ══════════════════════════════════════════════════════════════
// Layer 2 — 只读·审核域（auditor / admin）
// ══════════════════════════════════════════════════════════════

const TOOL_GET_ASSIGNED_REPORTS: AiToolDefinition = {
  description:
    '获取分配给当前审核员的漏洞报告列表。当审核员询问"我有哪些待审核漏洞"、"今天要审什么"时调用。',
  name: 'get_assigned_reports',
  parameters: {
    properties: {
      status: {
        description: '漏洞状态过滤。可选，不传返回全部已分配的报告。',
        enum: ['SUBMITTED', 'PENDING_REVIEW', 'CONFIRMED', 'FIXING', 'PENDING_RETEST', 'NEEDS_SUPPLEMENT'],
        type: 'string',
      },
    },
    type: 'object',
  },
}

const TOOL_GET_REVIEW_QUEUE_STATS: AiToolDefinition = {
  description:
    '获取审核队列统计：待初审数、待复测数、待归档数、待发证数。当审核员询问"还有多少要审"、"审核积压情况"时调用。',
  name: 'get_review_queue_stats',
  parameters: {
    properties: {},
    type: 'object',
  },
}

// ══════════════════════════════════════════════════════════════
// Layer 3 — 只读·管理域（admin only）
// ══════════════════════════════════════════════════════════════

const TOOL_GET_PLATFORM_STATS: AiToolDefinition = {
  description:
    '获取平台运营统计数据：漏洞总数/趋势/高危分布、审核积压、证书签发、用户活跃度。当管理员询问"平台运行状况"、"漏洞趋势"时调用。',
  name: 'get_platform_stats',
  parameters: {
    properties: {},
    type: 'object',
  },
}

const TOOL_GET_AUDIT_LOG_SUMMARY: AiToolDefinition = {
  description:
    '获取审计日志摘要：近期异常操作、高频操作类型、风险操作分布。当管理员询问"有什么异常"、"审计日志概览"时调用。',
  name: 'get_audit_log_summary',
  parameters: {
    properties: {
      hours: {
        description: '查询最近多少小时的记录，默认 24。',
        type: 'number',
      },
    },
    type: 'object',
  },
}

// ══════════════════════════════════════════════════════════════
// 工具册
// ══════════════════════════════════════════════════════════════

const STUDENT_TOOLS: AiToolDefinition[] = [
  TOOL_GET_USER_SUMMARY,
  TOOL_GET_MY_VULNERABILITIES,
  TOOL_GET_POINT_BALANCE,
  TOOL_GET_REDEEM_ELIGIBILITY,
  TOOL_SEARCH_LEARNING_RESOURCES,
  TOOL_SEARCH_MALL_PRODUCTS,
]

const AUDITOR_TOOLS: AiToolDefinition[] = [
  ...STUDENT_TOOLS,
  TOOL_GET_ASSIGNED_REPORTS,
  TOOL_GET_REVIEW_QUEUE_STATS,
]

const ADMIN_TOOLS: AiToolDefinition[] = [
  ...AUDITOR_TOOLS,
  TOOL_GET_PLATFORM_STATS,
  TOOL_GET_AUDIT_LOG_SUMMARY,
]

const TOOLS_BY_ROLE: Record<RoleCode, AiToolDefinition[]> = {
  ADMIN: ADMIN_TOOLS,
  AUDITOR: AUDITOR_TOOLS,
  STUDENT: STUDENT_TOOLS,
}

const ALL_TOOL_NAMES = new Set([
  ...STUDENT_TOOLS,
  ...AUDITOR_TOOLS,
  ...ADMIN_TOOLS,
].map((tool) => tool.name))

// ══════════════════════════════════════════════════════════════
// 公开 API
// ══════════════════════════════════════════════════════════════

/** 按角色返回该角色可调用的全部 tool */
export function getAvailableTools(role: RoleCode): AiToolDefinition[] {
  return TOOLS_BY_ROLE[role] ?? STUDENT_TOOLS
}

/** 校验 tool 是否注册 */
export function isToolAllowed(name: string, role: RoleCode): boolean {
  const tools = TOOLS_BY_ROLE[role] ?? STUDENT_TOOLS
  return tools.some((tool) => tool.name === name)
}

/** 校验 tool 名称是否合法（已注册） */
export function isKnownToolName(name: string): boolean {
  return ALL_TOOL_NAMES.has(name)
}

/** 获取单个 tool 定义，用于参数校验 */
export function getToolDefinition(name: string): AiToolDefinition | undefined {
  for (const tools of Object.values(TOOLS_BY_ROLE)) {
    const found = tools.find((tool) => tool.name === name)
    if (found) return found
  }
  return undefined
}
