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
  AuditAction.CHANGE_SYSTEM_SETTING,
  AuditAction.CHANGE_USER_PERMISSION,
  AuditAction.ISSUE_CERTIFICATE,
  AuditAction.MANAGE_USER,
  AuditAction.REVIEW_VULNERABILITY,
  AuditAction.REVOKE_CERTIFICATE,
  AuditAction.VIEW_SENSITIVE_ATTACHMENT,
])

const mediumRiskActions = new Set<AuditAction>([
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
