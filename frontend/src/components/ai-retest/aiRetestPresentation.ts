import type { AiRetestJobStatus, AiRetestMode } from '../../services/aiRetests'

const terminalStatuses = new Set<AiRetestJobStatus>([
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
  'BLOCKED',
  'EXPIRED',
])

const statusPresentation: Record<AiRetestJobStatus, {
  description: string
  label: string
  tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger'
}> = {
  PENDING: { description: '任务已创建，等待进入后台队列。', label: '等待入队', tone: 'neutral' },
  QUEUED: { description: '任务已入队，等待生成复测方案。', label: '排队中', tone: 'info' },
  PLANNING: { description: 'Hermes 正在根据脱敏上下文生成结构化复测方案。', label: '生成方案', tone: 'info' },
  POLICY_CHECK: { description: '平台正在校验目标、工具、风险和请求预算。', label: '安全策略检查', tone: 'info' },
  PLAN_REVIEW: { description: '中风险 Runner 步骤需要人工确认后才能执行。', label: '等待方案审批', tone: 'warning' },
  DIRECT_PLAN_REVIEW: { description: 'Hermes Direct 初始方案需要确认目标、影响和工具范围。', label: '等待 Direct 方案审批', tone: 'warning' },
  DIRECT_RUNNING: { description: 'Hermes Direct 正在批准范围内执行并回传审计事件。', label: 'Direct 执行中', tone: 'info' },
  DIRECT_ACTION_REVIEW: { description: 'Hermes 请求执行新的高风险动作，当前已暂停等待审批。', label: '等待高风险动作审批', tone: 'warning' },
  ADVISORY_ONLY: { description: '平台不会自动执行，正在生成人工复测建议。', label: '人工计划', tone: 'warning' },
  RUNNING: { description: '受限 Runner 正在执行低风险内置验证模板。', label: 'Runner 执行中', tone: 'info' },
  CANCELLING: { description: '平台正在停止执行并清理临时会话。', label: '取消中', tone: 'warning' },
  REPORTING: { description: '平台正在依据已审计证据生成结构化报告。', label: '生成报告', tone: 'info' },
  SUCCEEDED: { description: '报告已生成，最终结论仍需人工确认。', label: '已完成', tone: 'success' },
  FAILED: { description: '任务执行失败，请查看失败原因后重新评估是否启动。', label: '执行失败', tone: 'danger' },
  CANCELLED: { description: '任务已取消，平台不会继续执行。', label: '已取消', tone: 'neutral' },
  BLOCKED: { description: '任务命中平台安全策略，未执行被禁止的复测动作。', label: '策略阻断', tone: 'danger' },
  EXPIRED: { description: '任务或审批窗口已过期，需要重新启动复测。', label: '已过期', tone: 'warning' },
}

export function describeAiRetestStatus(status: AiRetestJobStatus) {
  return statusPresentation[status]
}

export function isAiRetestActive(status: AiRetestJobStatus) {
  return !terminalStatuses.has(status)
}

export function shouldPollAiRetest(status: AiRetestJobStatus) {
  return isAiRetestActive(status)
}

export function getAiRetestChannel(mode: AiRetestMode) {
  if (mode === 'HERMES_DIRECT') return 'Hermes Direct'
  if (mode === 'PLAN_ONLY') return '人工计划'
  return '受限 Runner'
}
