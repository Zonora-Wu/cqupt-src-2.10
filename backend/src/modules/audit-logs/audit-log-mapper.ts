import { AuditAction, Prisma } from '@prisma/client'
import { sanitizeAuditMetadata } from './audit-log-sanitizer'
import { AuditLogDetail, AuditLogListItem, AuditModuleCode, AuditRiskLevel } from './audit-logs.types'

type AuditLogWithActor = Prisma.AuditLogGetPayload<{
  include: {
    actor: {
      include: {
        role: true
      }
    }
  }
}>

const actionLabels: Record<AuditAction, string> = {
  AI_RETEST_ARTIFACT_VIEWED: '查看 AI 复测证据',
  AI_RETEST_BLOCKED: 'AI 复测被策略阻断',
  AI_RETEST_CANCELLED: '取消 AI 复测',
  AI_RETEST_CONTEXT_CREATED: '生成 AI 复测上下文',
  AI_RETEST_CREATED: '创建 AI 复测任务',
  AI_RETEST_DIRECT_ACTION_APPROVED: '批准 Hermes Direct 高风险动作',
  AI_RETEST_DIRECT_ACTION_REJECTED: '拒绝 Hermes Direct 高风险动作',
  AI_RETEST_DIRECT_ACTION_REQUESTED: '请求批准 Hermes Direct 高风险动作',
  AI_RETEST_DIRECT_BLOCKED: '阻断 Hermes Direct 动作',
  AI_RETEST_DIRECT_EVENT_RECORDED: '记录 Hermes Direct 执行事件',
  AI_RETEST_DIRECT_FINISHED: '完成 Hermes Direct 复测',
  AI_RETEST_DIRECT_PROPOSAL_CONFIRMED: '批准 Hermes Direct 复测方案',
  AI_RETEST_DIRECT_PROPOSAL_CREATED: '生成 Hermes Direct 复测方案',
  AI_RETEST_DIRECT_STARTED: '启动 Hermes Direct 复测',
  AI_RETEST_CREDENTIAL_CREATED: '创建 AI 复测凭据',
  AI_RETEST_CREDENTIAL_DESTROYED: '销毁 AI 复测凭据',
  AI_RETEST_CREDENTIAL_LEASED: '租用 AI 复测凭据',
  AI_RETEST_EXPIRED: 'AI 复测任务超时',
  AI_RETEST_FAILED: 'AI 复测任务失败',
  AI_RETEST_PLAN_APPROVED: '批准 AI 复测计划',
  AI_RETEST_PLAN_CREATED: '生成 AI 复测计划',
  AI_RETEST_POLICY_CHECKED: '检查 AI 复测策略',
  AI_RETEST_POLICY_UPDATED: '更新 AI 复测策略',
  AI_RETEST_REPORT_ADOPTED: '引用 AI 复测报告',
  AI_RETEST_REPORT_CREATED: '生成 AI 复测报告',
  AI_RETEST_RUNNER_STARTED: '启动 AI 复测 Runner',
  AI_RETEST_RUNNER_STEP_EXECUTED: '执行 AI 复测步骤',
  CALL_AI: '调用 AI 能力',
  CHANGE_SYSTEM_SETTING: '修改系统设置',
  CHANGE_USER_PERMISSION: '调整用户权限',
  CHANGE_VULNERABILITY_STATUS: '变更漏洞状态',
  CREATE_VULNERABILITY: '创建漏洞记录',
  ISSUE_CERTIFICATE: '签发证书',
  LOGIN: '登录',
  LOGOUT: '退出登录',
  MANAGE_LEARNING_RESOURCE: '管理学习资源',
  MANAGE_MALL: '管理积分商城',
  MANAGE_USER: '管理用户',
  PUBLISH_ANNOUNCEMENT: '管理公告',
  REVIEW_VULNERABILITY: '审核漏洞',
  REVOKE_CERTIFICATE: '撤销证书',
  SUBMIT_VULNERABILITY: '提交漏洞',
  VIEW_SENSITIVE_ATTACHMENT: '查看敏感附件',
}

const moduleLabels: Record<AuditModuleCode, string> = {
  AI: 'AI 调用',
  ANNOUNCEMENT: '公告管理',
  ATTACHMENT: '敏感附件',
  AUTH: '认证登录',
  CERTIFICATE: '证书管理',
  LEARNING: '学习管理',
  MALL: '积分商城',
  SYSTEM: '系统设置',
  USER: '用户管理',
  VULNERABILITY: '漏洞管理',
}

const highRiskActions = new Set<AuditAction>([
  AuditAction.AI_RETEST_DIRECT_ACTION_APPROVED,
  AuditAction.AI_RETEST_DIRECT_PROPOSAL_CONFIRMED,
  AuditAction.AI_RETEST_DIRECT_STARTED,
  AuditAction.AI_RETEST_CREDENTIAL_LEASED,
  AuditAction.AI_RETEST_PLAN_APPROVED,
  AuditAction.AI_RETEST_POLICY_UPDATED,
  AuditAction.AI_RETEST_RUNNER_STARTED,
  AuditAction.AI_RETEST_RUNNER_STEP_EXECUTED,
  AuditAction.CHANGE_SYSTEM_SETTING,
  AuditAction.CHANGE_USER_PERMISSION,
  AuditAction.ISSUE_CERTIFICATE,
  AuditAction.MANAGE_USER,
  AuditAction.REVIEW_VULNERABILITY,
  AuditAction.REVOKE_CERTIFICATE,
  AuditAction.VIEW_SENSITIVE_ATTACHMENT,
])

const mediumRiskActions = new Set<AuditAction>([
  AuditAction.AI_RETEST_ARTIFACT_VIEWED,
  AuditAction.AI_RETEST_BLOCKED,
  AuditAction.AI_RETEST_CANCELLED,
  AuditAction.AI_RETEST_CONTEXT_CREATED,
  AuditAction.AI_RETEST_CREATED,
  AuditAction.AI_RETEST_DIRECT_ACTION_REJECTED,
  AuditAction.AI_RETEST_DIRECT_ACTION_REQUESTED,
  AuditAction.AI_RETEST_DIRECT_BLOCKED,
  AuditAction.AI_RETEST_DIRECT_EVENT_RECORDED,
  AuditAction.AI_RETEST_DIRECT_FINISHED,
  AuditAction.AI_RETEST_DIRECT_PROPOSAL_CREATED,
  AuditAction.AI_RETEST_CREDENTIAL_CREATED,
  AuditAction.AI_RETEST_CREDENTIAL_DESTROYED,
  AuditAction.AI_RETEST_EXPIRED,
  AuditAction.AI_RETEST_FAILED,
  AuditAction.AI_RETEST_PLAN_CREATED,
  AuditAction.AI_RETEST_POLICY_CHECKED,
  AuditAction.AI_RETEST_REPORT_ADOPTED,
  AuditAction.AI_RETEST_REPORT_CREATED,
  AuditAction.CALL_AI,
  AuditAction.MANAGE_LEARNING_RESOURCE,
  AuditAction.MANAGE_MALL,
  AuditAction.PUBLISH_ANNOUNCEMENT,
  AuditAction.SUBMIT_VULNERABILITY,
])

export function getAuditActionLabel(action: AuditAction) {
  return actionLabels[action] ?? action
}

export function getAuditModule(action: AuditAction): AuditModuleCode {
  const map: Record<AuditAction, AuditModuleCode> = {
    AI_RETEST_ARTIFACT_VIEWED: 'AI',
    AI_RETEST_BLOCKED: 'AI',
    AI_RETEST_CANCELLED: 'AI',
    AI_RETEST_CONTEXT_CREATED: 'AI',
    AI_RETEST_CREATED: 'AI',
    AI_RETEST_DIRECT_ACTION_APPROVED: 'AI',
    AI_RETEST_DIRECT_ACTION_REJECTED: 'AI',
    AI_RETEST_DIRECT_ACTION_REQUESTED: 'AI',
    AI_RETEST_DIRECT_BLOCKED: 'AI',
    AI_RETEST_DIRECT_EVENT_RECORDED: 'AI',
    AI_RETEST_DIRECT_FINISHED: 'AI',
    AI_RETEST_DIRECT_PROPOSAL_CONFIRMED: 'AI',
    AI_RETEST_DIRECT_PROPOSAL_CREATED: 'AI',
    AI_RETEST_DIRECT_STARTED: 'AI',
    AI_RETEST_CREDENTIAL_CREATED: 'AI',
    AI_RETEST_CREDENTIAL_DESTROYED: 'AI',
    AI_RETEST_CREDENTIAL_LEASED: 'AI',
    AI_RETEST_EXPIRED: 'AI',
    AI_RETEST_FAILED: 'AI',
    AI_RETEST_PLAN_APPROVED: 'AI',
    AI_RETEST_PLAN_CREATED: 'AI',
    AI_RETEST_POLICY_CHECKED: 'AI',
    AI_RETEST_POLICY_UPDATED: 'AI',
    AI_RETEST_REPORT_ADOPTED: 'AI',
    AI_RETEST_REPORT_CREATED: 'AI',
    AI_RETEST_RUNNER_STARTED: 'AI',
    AI_RETEST_RUNNER_STEP_EXECUTED: 'AI',
    CALL_AI: 'AI',
    CHANGE_SYSTEM_SETTING: 'SYSTEM',
    CHANGE_USER_PERMISSION: 'USER',
    CHANGE_VULNERABILITY_STATUS: 'VULNERABILITY',
    CREATE_VULNERABILITY: 'VULNERABILITY',
    ISSUE_CERTIFICATE: 'CERTIFICATE',
    LOGIN: 'AUTH',
    LOGOUT: 'AUTH',
    MANAGE_LEARNING_RESOURCE: 'LEARNING',
    MANAGE_MALL: 'MALL',
    MANAGE_USER: 'USER',
    PUBLISH_ANNOUNCEMENT: 'ANNOUNCEMENT',
    REVIEW_VULNERABILITY: 'VULNERABILITY',
    REVOKE_CERTIFICATE: 'CERTIFICATE',
    SUBMIT_VULNERABILITY: 'VULNERABILITY',
    VIEW_SENSITIVE_ATTACHMENT: 'ATTACHMENT',
  }

  return map[action] ?? 'SYSTEM'
}

export function getAuditModuleLabel(module: AuditModuleCode) {
  return moduleLabels[module] ?? module
}

export function getAuditRiskLevel(action: AuditAction, result: string): AuditRiskLevel {
  if (action === AuditAction.LOGIN && result.toLowerCase() !== 'success') return 'HIGH'
  if (highRiskActions.has(action)) return 'HIGH'
  if (mediumRiskActions.has(action)) return 'MEDIUM'
  return 'LOW'
}

export function getRiskActionList(riskLevel: AuditRiskLevel) {
  if (riskLevel === 'HIGH') return Array.from(highRiskActions)
  if (riskLevel === 'MEDIUM') return Array.from(mediumRiskActions)
  return Object.values(AuditAction).filter(
    (action) => !highRiskActions.has(action) && !mediumRiskActions.has(action),
  )
}

export function getModuleActionList(module: AuditModuleCode) {
  return Object.values(AuditAction).filter((action) => getAuditModule(action) === module)
}

export function mapAuditLogItem(log: AuditLogWithActor): AuditLogListItem {
  const module = getAuditModule(log.action)
  const riskLevel = getAuditRiskLevel(log.action, log.result)

  return {
    action: log.action,
    actionLabel: getAuditActionLabel(log.action),
    actor: log.actor
      ? {
          email: log.actor.email,
          id: log.actor.id,
          name: log.actor.name,
          role: log.actor.role.code,
          roleLabel: log.actor.role.name,
          unifiedCode: log.actor.unifiedCode,
        }
      : null,
    createdAt: log.createdAt,
    id: log.id,
    ipAddress: log.ipAddress ?? '',
    module,
    moduleLabel: getAuditModuleLabel(module),
    requestPath: log.requestPath ?? '',
    result: log.result,
    resultLabel: formatAuditResult(log.result),
    riskLabel: formatRiskLevel(riskLevel),
    riskLevel,
    summary: buildAuditSummary(log),
    targetId: log.targetId ?? '',
    targetLabel: formatTarget(log.targetType, log.targetId),
    targetType: log.targetType,
    userAgent: log.userAgent ?? '',
  }
}

export function mapAuditLogDetail(log: AuditLogWithActor): AuditLogDetail {
  return {
    ...mapAuditLogItem(log),
    metadata: sanitizeAuditMetadata(log.metadata),
  }
}

export function formatRiskLevel(level: AuditRiskLevel) {
  if (level === 'HIGH') return '高风险'
  if (level === 'MEDIUM') return '重要'
  return '普通'
}

export function formatAuditResult(result: string) {
  const normalized = result.toLowerCase()
  if (normalized === 'success' || normalized === 'ok') return '成功'
  if (normalized === 'blocked' || normalized === 'intercepted') return '已拦截'
  if (normalized === 'failed' || normalized === 'failure' || normalized === 'error') return '失败'
  return result || '未知'
}

export function getAuditActionLabelMatches(keyword: string) {
  const normalized = keyword.trim().toLowerCase()
  if (!normalized) return []

  return Object.values(AuditAction).filter((action) => {
    const module = getAuditModule(action)
    return (
      action.toLowerCase().includes(normalized) ||
      getAuditActionLabel(action).toLowerCase().includes(normalized) ||
      getAuditModuleLabel(module).toLowerCase().includes(normalized)
    )
  })
}

function buildAuditSummary(log: AuditLogWithActor) {
  const actor = log.actor?.name ?? '系统或未知用户'
  const target = formatTarget(log.targetType, log.targetId)
  const reason = readMetadataText(log.metadata, ['reason', 'remark', 'note'])
  const base = `${actor}执行“${getAuditActionLabel(log.action)}”，目标为 ${target}，结果：${formatAuditResult(log.result)}。`

  return reason ? `${base}原因：${reason}` : base
}

function formatTarget(targetType: string, targetId: string | null) {
  if (!targetId) return targetType || '未记录目标'
  return `${targetType || 'Target'} / ${targetId}`
}

function readMetadataText(metadata: Prisma.JsonValue, keys: string[]) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return ''
  }

  const record = metadata as Record<string, unknown>
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim().slice(0, 200)
    }
  }

  return ''
}
