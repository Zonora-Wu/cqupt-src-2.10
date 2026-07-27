import { useCallback, useEffect, useMemo, useState } from 'react'
import { FloatingNotice } from '../../components/ui/FloatingNotice'
import { PageHeader } from '../../components/ui/PageHeader'
import { SelectInput } from '../../components/ui/SelectInput'
import { SurfacePanel } from '../../components/ui/SurfacePanel'
import { AdminSkillReviewPanel } from '../../components/ai/AdminSkillReviewPanel'
import { AdminSkillManagementPanel } from '../../components/ai/AdminSkillManagementPanel'
import { AdminAiModelConfigurationButton } from '../../components/ai/AiModelConfigurationLauncher'
import {
  createAiSkillCandidate,
  dismissAiKnowledgeMaintenanceTask,
  getAiKnowledgeStats,
  installAiSkillCandidate,
  listAiKnowledge,
  listAiKnowledgeCaptureJobs,
  listAiKnowledgeConversations,
  listAiKnowledgeMaintenanceTasks,
  listAiProblemSessionsForReview,
  listAiSkillAudit,
  listAiSkillCandidates,
  processAiKnowledgeCaptures,
  resolveAiKnowledgeMaintenanceTask,
  reviewAiKnowledge,
  reviewAiKnowledgeConversation,
  reviewAiProblemSession,
  reviewAiSkillCandidate,
  runAiKnowledgeMaintenance,
  summarizeAiKnowledgeConversation,
  summarizeAiProblemSession,
  type AiKnowledgeConversation,
  type AiKnowledgeEntry,
  type AiKnowledgeMaintenanceTask,
  type AiKnowledgeMaintenanceTaskPriority,
  type AiKnowledgeMaintenanceTaskStatus,
  type AiKnowledgeStats,
  type AiKnowledgeStatus,
  type AiProblemSession,
  type AiSkillCandidate,
  type AiSkillAudit,
} from '../../services/aiKnowledge'

const statusLabels: Record<string, string> = {
  APPROVED: '已批准',
  APPROVED_TO_KB: '已沉入知识库',
  ARCHIVED: '已归档',
  AUTO_APPROVED: '自动批准',
  CANDIDATE: '候选',
  COMPLETED: '已完成',
  DISCARDED: '已丢弃',
  DISMISSED: '已忽略',
  FAILED: '失败',
  INSTALLED: '已安装',
  NEEDS_REVIEW: '待审核',
  OPEN: '待处理',
  PENDING: '待处理',
  PROCESSING: '处理中',
  PROMOTED_TO_SKILL: '已晋升 Skill',
  READY_REVIEW: '待沉淀审核',
  REJECTED: '已拒绝',
  RESOLVED: '已解决',
  SKILL_CANDIDATE: 'Skill 候选会话',
}

const roleScopeLabels: Record<string, string> = {
  ADMIN: '管理员',
  ALL: '全部角色',
  AUDITOR: '审核员',
  STUDENT: '学生',
}

type KnowledgeStatusFilter = AiKnowledgeStatus | 'ALL'
type KnowledgeWorkspaceTab = 'AUTO_APPROVED' | 'ENTRIES' | 'MAINTENANCE' | 'REVIEW' | 'SKILLS'
type AdminAiWorkspace = 'KNOWLEDGE_REVIEW' | 'SKILL_MANAGEMENT' | 'SKILL_REVIEW'

const promotableStatuses = new Set<AiKnowledgeStatus>(['APPROVED', 'AUTO_APPROVED', 'PROMOTED_TO_SKILL'])

const categoryLabels: Record<string, string> = {
  ACCESS_CONTROL: '访问控制',
  ADMIN_ANALYTICS: '管理分析',
  AUDITOR_REVIEW: '审核经验',
  AUTHENTICATION: '认证安全',
  FILE_UPLOAD: '文件上传',
  PLATFORM_USAGE: '平台使用',
  SECURITY_LEARNING: '安全学习',
  SQL_INJECTION: 'SQL 注入',
  SRC_RULES: 'SRC 规则',
  SSRF: 'SSRF',
  VULNERABILITY_REPORTING: '漏洞报告',
  XSS: 'XSS',
}

const maintenanceTaskTypeLabels: Record<string, string> = {
  ARCHIVE: '待归档复审',
  DUPLICATE: '疑似重复',
  EXPIRY: '过期复审',
  LOW_QUALITY: '低质量复审',
  SECURITY: '安全复核',
  STALE_REVIEW: '过期内容复审',
}

const maintenanceStatusLabels: Record<string, string> = {
  ARCHIVED: '已归档',
  DUPLICATE_REVIEW: '重复复审',
  HEALTHY: '健康',
  LOW_QUALITY_REVIEW: '低质量复审',
  SECURITY_SUSPENDED: '安全暂停',
  STALE_REVIEW: '过期复审',
}

export function AdminAiKnowledgeManagement() {
  const [entries, setEntries] = useState<AiKnowledgeEntry[]>([])
  const [maintenanceTasks, setMaintenanceTasks] = useState<AiKnowledgeMaintenanceTask[]>([])
  const [maintenancePriority, setMaintenancePriority] = useState<AiKnowledgeMaintenanceTaskPriority | 'ALL'>('ALL')
  const [maintenanceStatus, setMaintenanceStatus] = useState<AiKnowledgeMaintenanceTaskStatus | 'ALL'>('OPEN')
  const [conversations, setConversations] = useState<AiKnowledgeConversation[]>([])
  const [problemSessions, setProblemSessions] = useState<AiProblemSession[]>([])
  const [candidates, setCandidates] = useState<AiSkillCandidate[]>([])
  const [skillAudit, setSkillAudit] = useState<AiSkillAudit[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [stats, setStats] = useState<AiKnowledgeStats | null>(null)
  const [captureJobs, setCaptureJobs] = useState<AiKnowledgeStats['recentQueue']>([])
  const [activeTab, setActiveTab] = useState<KnowledgeWorkspaceTab>('REVIEW')
  const [workspace, setWorkspace] = useState<AdminAiWorkspace>('KNOWLEDGE_REVIEW')
  const [status, setStatus] = useState<KnowledgeStatusFilter>('NEEDS_REVIEW')
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [skillName, setSkillName] = useState('')
  const [skillDescription, setSkillDescription] = useState('')

  const selectedEntries = useMemo(() => entries.filter((entry) => selectedIds.includes(entry.id)), [entries, selectedIds])
  const visiblePromotableIds = useMemo(() => new Set(entries.filter((entry) => promotableStatuses.has(entry.status)).map((entry) => entry.id)), [entries])

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [statsData, entriesData, candidatesData, skillAuditData, jobsData, conversationData, problemSessionData, maintenanceTaskData] = await Promise.all([
        getAiKnowledgeStats(),
        listAiKnowledge({ page: 1, pageSize: 20, status: activeTab === 'AUTO_APPROVED' ? 'AUTO_APPROVED' : activeTab === 'SKILLS' ? undefined : status === 'ALL' ? undefined : status, keyword }),
        listAiSkillCandidates(),
        listAiSkillAudit(),
        listAiKnowledgeCaptureJobs({ page: 1, pageSize: 8 }),
        listAiKnowledgeConversations({ page: 1, pageSize: 8 }),
        listAiProblemSessionsForReview({ page: 1, pageSize: 8 }),
        listAiKnowledgeMaintenanceTasks({ page: 1, pageSize: 30, priority: maintenancePriority, status: maintenanceStatus }),
      ])
      setStats(statsData)
      setEntries(entriesData.items)
      setCandidates(candidatesData)
      setSkillAudit(skillAuditData)
      setCaptureJobs(jobsData.items)
      setConversations(conversationData.items)
      setProblemSessions(problemSessionData.items)
      setMaintenanceTasks(maintenanceTaskData.items)
      setSelectedIds((current) => current.filter((id) => entriesData.items.some((entry) => entry.id === id && promotableStatuses.has(entry.status))))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'AI 知识库数据加载失败')
    } finally {
      setLoading(false)
    }
  }, [activeTab, keyword, maintenancePriority, maintenanceStatus, status])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadAll(), 0)
    return () => window.clearTimeout(timer)
  }, [loadAll])

  async function runAction(action: string, task: () => Promise<unknown>, success: string) {
    setBusy(action)
    setMessage('')
    setError('')
    try {
      await task()
      setMessage(success)
      await loadAll()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : '操作失败')
    } finally {
      setBusy('')
    }
  }

  function toggleSelected(entry: AiKnowledgeEntry) {
    if (!promotableStatuses.has(entry.status)) return
    setSelectedIds((current) => (current.includes(entry.id) ? current.filter((item) => item !== entry.id) : [...current, entry.id]))
  }

  async function createCandidate() {
    await createAiSkillCandidate({ description: skillDescription, name: skillName, sourceKnowledgeIds: selectedIds })
    setSelectedIds([])
    setSkillName('')
    setSkillDescription('')
  }

  function promptMaintenanceReason(defaultReason: string) {
    return window.prompt('请输入处理原因，将写入审计记录：', defaultReason)?.trim()
  }

  async function resolveMaintenance(task: AiKnowledgeMaintenanceTask) {
    const reason = promptMaintenanceReason('管理员确认维护事项已处理')
    if (reason === undefined) return
    await runAction(task.id, () => resolveAiKnowledgeMaintenanceTask(task.id, reason), '维护任务已解决')
  }

  async function dismissMaintenance(task: AiKnowledgeMaintenanceTask) {
    const reason = promptMaintenanceReason('管理员确认暂不处理该维护事项')
    if (reason === undefined) return
    await runAction(task.id, () => dismissAiKnowledgeMaintenanceTask(task.id, reason), '维护任务已忽略')
  }

  return (
    <section className="relative z-10 mx-auto max-w-[1360px] px-5 pb-8 pt-24 md:px-8">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <PageHeader
          title="AI 管理"
          description="配置平台模型，管理系统与用户 Skill，审核知识沉淀内容。"
        />
        <div className="flex flex-wrap gap-2">
          <AdminAiModelConfigurationButton
            trigger={(open) => (
              <button className="rounded-lg border border-black/10 px-4 py-2 text-sm font-medium transition hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10" onClick={open} type="button">
                配置平台模型
              </button>
            )}
          />
          <button className="rounded-lg border border-black/10 px-4 py-2 text-sm font-medium hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10" onClick={() => void loadAll()} type="button">
            刷新
          </button>
          <button
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
            disabled={busy === 'process'}
            onClick={() => void runAction('process', processAiKnowledgeCaptures, '捕获队列处理完成')}
            type="button"
          >
            处理捕获队列
          </button>
        </div>
      </div>

      {(message || error) && (
        <FloatingNotice
          message={error || message}
          onClose={() => {
            setMessage('')
            setError('')
          }}
          variant={error ? 'error' : 'success'}
        />
      )}

      <div className="mt-6 grid gap-3 md:grid-cols-4">
        <StatCard label="待审核知识" value={stats?.totals.needsReview ?? 0} />
        <StatCard label="已批准知识" value={stats?.totals.approved ?? 0} />
        <StatCard label="24h 命中" value={stats?.totals.recentHits ?? 0} />
        <StatCard label="已安装 Skill" value={stats?.totals.installedSkills ?? 0} />
      </div>

      <div className="mt-6 flex gap-1 border-b border-black/10 dark:border-white/10" role="tablist" aria-label="AI 知识库与 Skill 工作台">
        <PrimaryTab active={workspace === 'SKILL_MANAGEMENT'} label="Skill 管理" onClick={() => setWorkspace('SKILL_MANAGEMENT')} />
        <PrimaryTab active={workspace === 'SKILL_REVIEW'} label="Skill 审核" onClick={() => { setWorkspace('SKILL_REVIEW'); setActiveTab('SKILLS') }} />
        <PrimaryTab active={workspace === 'KNOWLEDGE_REVIEW'} label="知识审核" onClick={() => { setWorkspace('KNOWLEDGE_REVIEW'); if (activeTab === 'SKILLS') setActiveTab('REVIEW') }} />
      </div>

      {workspace === 'SKILL_MANAGEMENT' ? <div className="mt-6"><AdminSkillManagementPanel /></div> : (
      <>
      {workspace === 'SKILL_REVIEW' ? <div className="mt-6"><AdminSkillReviewPanel /></div> : (
      <div className="ai-chat-input-scroll mt-4 flex gap-2 overflow-x-auto border-b border-black/10 pb-3 dark:border-white/10" role="tablist" aria-label="知识审核分类">
        <WorkspaceTab active={activeTab === 'REVIEW'} label="待审核会话" onClick={() => setActiveTab('REVIEW')} />
        <WorkspaceTab active={activeTab === 'AUTO_APPROVED'} label="自动入库" onClick={() => setActiveTab('AUTO_APPROVED')} />
        <WorkspaceTab active={activeTab === 'ENTRIES'} label="知识库条目" onClick={() => setActiveTab('ENTRIES')} />
        <WorkspaceTab active={activeTab === 'MAINTENANCE'} label="待维护" onClick={() => setActiveTab('MAINTENANCE')} />
      </div>
      )}
      <div className={`mt-6 grid gap-6 ${activeTab === 'REVIEW' ? 'xl:grid-cols-[minmax(0,1fr)_340px]' : activeTab === 'SKILLS' ? 'xl:grid-cols-[minmax(0,1fr)_380px]' : ''}`}>
        <div className="space-y-6">
          {activeTab === 'REVIEW' ? (
            <>
          <SurfacePanel className="p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold">问题会话审核队列</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">用户确认已解决后生成结构化总结、规则评分和重复风险，管理员确认后才进入知识库。</p>
              </div>
              <button className="rounded-lg border border-black/10 px-3 py-2 text-sm hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10" onClick={() => void loadAll()} type="button">刷新会话</button>
            </div>
          </SurfacePanel>

          {problemSessions.map((session) => {
            const summary = session.summaryJson
            return (
              <SurfacePanel className="p-5" key={session.id}>
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={session.status} />
                      <span className="rounded-lg bg-[var(--app-panel-muted-bg)] px-2.5 py-1 text-xs dark:bg-white/[0.06]">{formatProblemSessionMode(session.mode)}</span>
                      <span className="rounded-lg bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-700 dark:text-emerald-200">用户已确认解决</span>
                      <span className="rounded-lg bg-[var(--app-panel-muted-bg)] px-2.5 py-1 text-xs dark:bg-white/[0.06]">{session.turnCount} 条 turn</span>
                      {summary ? <span className="rounded-lg bg-brand-700/10 px-2.5 py-1 text-xs text-brand-800 dark:text-brand-200">建议：{summary.recommendation}</span> : null}
                      {summary ? <span className="rounded-lg bg-[var(--app-panel-muted-bg)] px-2.5 py-1 text-xs dark:bg-white/[0.06]">重复风险 {formatPercent(getProblemSessionDuplicateRisk(summary))}</span> : null}
                    </div>
                    <h3 className="mt-3 text-lg font-semibold">{session.title || session.initialQuestion}</h3>
                    {summary ? (
                      <>
                        <div className="mt-3 grid gap-2 md:grid-cols-6">
                          <ScorePill label="质量" value={summary.scores.quality} />
                          <ScorePill label="复用" value={summary.scores.reuse} />
                          <ScorePill label="安全" value={summary.scores.safety} />
                          <ScorePill label="隐私风险" value={summary.scores.privacy} inverse />
                          <ScorePill label="投毒风险" value={summary.scores.poisoningRisk} inverse />
                          <ScorePill label="置信" value={summary.scores.confidence} />
                        </div>
                        <p className="mt-3 rounded-lg border border-black/5 bg-[var(--app-panel-muted-bg)] p-3 text-sm leading-6 text-slate-700 dark:border-white/10  dark:text-slate-300">{summary.resolution}</p>
                        {summary.rejectionReason ? <p className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-200">拒绝原因：{summary.rejectionReason}</p> : null}
                        {summary.pitfalls.length > 0 ? <TagList label="踩坑" items={summary.pitfalls} /> : null}
                        {summary.successfulSteps.length > 0 ? <TagList label="有效步骤" items={summary.successfulSteps} /> : null}
                        {summary.mergeSuggestion ? <p className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-100">{summary.mergeSuggestion}</p> : null}
                        {summary.similarKnowledgeMatches.length > 0 ? (
                          <div className="mt-3 grid gap-2 md:grid-cols-2">
                            {summary.similarKnowledgeMatches.map((match) => (
                              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs" key={match.id}>
                                <p className="font-medium text-slate-900 dark:text-slate-100">{match.title}</p>
                                <p className="mt-1 text-slate-500 dark:text-slate-400">相似度 {formatPercent(match.similarity)} · {statusLabels[match.status] ?? match.status}</p>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <p className="mt-3 rounded-lg border border-black/5 bg-[var(--app-panel-muted-bg)] p-3 text-sm leading-6 text-slate-700 dark:border-white/10  dark:text-slate-300">{session.initialQuestion}</p>
                    )}
                    {session.turns && session.turns.length > 0 ? (
                      <details className="mt-3 rounded-lg border border-black/5 p-3 text-xs dark:border-white/10">
                        <summary className="cursor-pointer font-medium">查看脱敏会话 turn</summary>
                        <div className="mt-3 space-y-2">
                          {session.turns.map((turn) => <p className="line-clamp-3 rounded-lg bg-[var(--app-panel-muted-bg)] p-2 " key={turn.id}><b>{turn.role}：</b>{turn.content}</p>)}
                        </div>
                      </details>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2 xl:w-40 xl:flex-col">
                    <button className="rounded-lg border border-brand-600/20 px-3 py-2 text-sm font-medium text-brand-700 disabled:opacity-60 dark:text-brand-200" disabled={busy === session.id} onClick={() => void runAction(session.id, () => summarizeAiProblemSession(session.id), '问题会话已重新总结')} type="button">重新总结</button>
                    <button className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60" disabled={busy === session.id || summary?.recommendation === 'DISCARD'} onClick={() => void runAction(session.id, () => reviewAiProblemSession(session.id, 'APPROVED_TO_KB', '管理员批准问题会话入库'), '问题会话已沉入知识库')} type="button">沉入知识库</button>
                    <button className="rounded-lg border border-amber-500/30 px-3 py-2 text-sm font-medium text-amber-700 disabled:opacity-60 dark:text-amber-200" disabled={busy === session.id} onClick={() => void runAction(session.id, () => reviewAiProblemSession(session.id, 'SKILL_CANDIDATE', '复杂流程，进入 Skill 候选'), '问题会话已标为 Skill 候选')} type="button">标为 Skill</button>
                    <button className="rounded-lg border border-red-500/20 px-3 py-2 text-sm font-medium text-red-700 disabled:opacity-60 dark:text-red-200" disabled={busy === session.id} onClick={() => void runAction(session.id, () => reviewAiProblemSession(session.id, 'DISCARDED', '不适合沉淀'), '问题会话已丢弃')} type="button">丢弃</button>
                  </div>
                </div>
              </SurfacePanel>
            )
          })}

          {problemSessions.length === 0 && !loading ? <SurfacePanel className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">暂无用户确认已解决的问题会话。</SurfacePanel> : null}

          <details>
            <summary className="cursor-pointer list-none">
              <SurfacePanel className="p-4 transition hover:border-brand-600/30">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold">旧版多轮会话沉淀队列</h2>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">兼容旧链路，默认收起。新会话统一进入上方问题会话审核队列。</p>
                  </div>
                  <span className="rounded-lg bg-[var(--app-panel-muted-bg)] px-2.5 py-1 text-xs text-slate-500 dark:bg-white/[0.06] dark:text-slate-400">{conversations.length} 条</span>
                </div>
              </SurfacePanel>
            </summary>
            <div className="mt-4 space-y-4">
          <SurfacePanel className="p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold">多轮会话沉淀队列</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">把用户从“提出问题 → 多次报错 → 最终解决”的完整路径沉淀为知识库；涉及脚本/信息收集的复杂流程先标为 Skill 候选。</p>
              </div>
              <button className="rounded-lg border border-black/10 px-3 py-2 text-sm hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10" onClick={() => void loadAll()} type="button">刷新会话</button>
            </div>
          </SurfacePanel>

          {conversations.map((conversation) => (
            <SurfacePanel className="p-5" key={conversation.id}>
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={conversation.status} />
                    <span className="rounded-lg bg-[var(--app-panel-muted-bg)] px-2.5 py-1 text-xs dark:bg-white/[0.06]">{conversation.aiSpace}</span>
                    <span className="rounded-lg bg-brand-700/10 px-2.5 py-1 text-xs text-brand-800 dark:text-brand-200">建议：{conversation.suggestedKnowledgeType === 'SKILL' ? 'Skill 候选' : conversation.suggestedKnowledgeType === 'DISCARD' ? '不建议沉淀' : '知识库'}</span>
                    <span className="rounded-lg bg-[var(--app-panel-muted-bg)] px-2.5 py-1 text-xs dark:bg-white/[0.06]">AI评分 {formatPercent(conversation.aiOverallScore)}</span>
                    <span className="rounded-lg bg-[var(--app-panel-muted-bg)] px-2.5 py-1 text-xs dark:bg-white/[0.06]">{conversation.turnCount} 轮</span>
                  </div>
                  <h3 className="mt-3 text-lg font-semibold">{conversation.title}</h3>
                  <div className="mt-3 grid gap-2 md:grid-cols-6">
                    <ScorePill label="综合" value={conversation.aiOverallScore} />
                    <ScorePill label="KB" value={conversation.aiKbScore} />
                    <ScorePill label="Skill" value={conversation.aiSkillScore} />
                    <ScorePill label="安全" value={conversation.aiSafetyScore} />
                    <ScorePill label="隐私风险" value={conversation.aiPrivacyRiskScore} inverse />
                    <ScorePill label="重复风险" value={conversation.duplicateRiskScore} inverse />
                  </div>
                  <p className="mt-3 rounded-lg border border-black/5 bg-[var(--app-panel-muted-bg)] p-3 text-sm leading-6 text-slate-700 dark:border-white/10  dark:text-slate-300">{conversation.resolutionSummary || conversation.problemStatement}</p>
                  {conversation.pitfalls.length > 0 ? <TagList label="踩坑" items={conversation.pitfalls} /> : null}
                  {conversation.successfulSteps.length > 0 ? <TagList label="有效步骤" items={conversation.successfulSteps} /> : null}
                  {conversation.mergeSuggestion ? (
                    <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm leading-6 text-amber-800 dark:text-amber-100">
                      <p className="font-medium">相似知识合并建议</p>
                      <p className="mt-1">{conversation.mergeSuggestion}</p>
                      {conversation.similarKnowledgeMatches?.length ? (
                        <div className="mt-2 grid gap-2 md:grid-cols-2">
                          {conversation.similarKnowledgeMatches.map((match) => (
                            <div className="rounded-lg border border-amber-500/20 bg-[var(--app-surface)]/70 p-2 text-xs dark:bg-black/15" key={match.id}>
                              <p className="font-medium text-slate-900 dark:text-slate-100">{match.title}</p>
                              <p className="mt-1 text-slate-600 dark:text-slate-300">相似度 {formatPercent(match.similarity)} · {statusLabels[match.status] ?? match.status} · 命中 {match.hitCount}</p>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {conversation.autoDecisionReason ? <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">自动判定：{conversation.autoDecisionReason}</p> : null}
                  {conversation.aiEvaluation?.signals?.length ? <TagList label="AI 证据" items={conversation.aiEvaluation.signals} /> : null}
                  {conversation.aiEvaluation?.risks?.length ? <TagList label="AI 风险" items={conversation.aiEvaluation.risks} /> : null}
                  {conversation.turns && conversation.turns.length > 0 ? (
                    <details className="mt-3 rounded-lg border border-black/5 p-3 text-xs dark:border-white/10">
                      <summary className="cursor-pointer font-medium">查看原始脱敏对话片段</summary>
                      <div className="mt-3 space-y-2">
                        {conversation.turns.map((turn) => <p className="line-clamp-3 rounded-lg bg-[var(--app-panel-muted-bg)] p-2 " key={turn.id}><b>{turn.role}：</b>{turn.content}</p>)}
                      </div>
                    </details>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2 xl:w-40 xl:flex-col">
                  <button className="rounded-lg border border-brand-600/20 px-3 py-2 text-sm font-medium text-brand-700 disabled:opacity-60 dark:text-brand-200" disabled={busy === conversation.id} onClick={() => void runAction(conversation.id, () => summarizeAiKnowledgeConversation(conversation.id), '会话已重新总结')} type="button">重新总结</button>
                  <button className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60" disabled={busy === conversation.id} onClick={() => void runAction(conversation.id, () => reviewAiKnowledgeConversation(conversation.id, 'APPROVED_TO_KB', '管理员批准沉入知识库'), '已沉入 AI 知识库')} type="button">沉入知识库</button>
                  <button className="rounded-lg border border-amber-500/30 px-3 py-2 text-sm font-medium text-amber-700 disabled:opacity-60 dark:text-amber-200" disabled={busy === conversation.id} onClick={() => void runAction(conversation.id, () => reviewAiKnowledgeConversation(conversation.id, 'SKILL_CANDIDATE', '复杂流程，进入 Skill 候选池'), '已标记为 Skill 候选会话')} type="button">标为 Skill</button>
                  <button className="rounded-lg border border-red-500/20 px-3 py-2 text-sm font-medium text-red-700 disabled:opacity-60 dark:text-red-200" disabled={busy === conversation.id} onClick={() => void runAction(conversation.id, () => reviewAiKnowledgeConversation(conversation.id, 'DISCARDED', '不适合沉淀'), '会话已丢弃')} type="button">丢弃</button>
                </div>
              </div>
            </SurfacePanel>
          ))}

          {conversations.length === 0 && !loading ? <SurfacePanel className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">暂无待沉淀的多轮会话。用户完成一次多轮排错后会自动出现在这里。</SurfacePanel> : null}
            </div>
          </details>
            </>
          ) : null}

          {activeTab === 'AUTO_APPROVED' || activeTab === 'ENTRIES' ? (
            <>
          <SurfacePanel className="p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold">{activeTab === 'AUTO_APPROVED' ? '自动入库知识' : '知识库条目'}</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{activeTab === 'AUTO_APPROVED' ? '集中复核系统自动沉淀的知识；当前可确认审核或归档，撤回与降级将在聚类链路完成后接入。' : '按状态检索知识条目，确认脱敏、泛化和适用边界。'}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <input className="rounded-lg border border-black/10 bg-[var(--app-panel-bg)] px-3 py-2 text-sm outline-none focus:border-brand-600 dark:border-white/10" onChange={(event) => setKeyword(event.target.value)} placeholder="搜索问题/答案" value={keyword} />
                {activeTab === 'ENTRIES' ? (
                <SelectInput
                  className="min-w-32"
                  onChange={(value) => setStatus(value as KnowledgeStatusFilter)}
                  options={[
                    { label: '待审核', value: 'NEEDS_REVIEW' },
                    { label: '已批准', value: 'APPROVED' },
                    { label: '已拒绝', value: 'REJECTED' },
                    { label: '全部', value: 'ALL' },
                  ]}
                  value={status}
                />
                ) : null}
                <button className="rounded-lg border border-black/10 px-3 py-2 text-sm hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10" onClick={() => void loadAll()} type="button">查询</button>
              </div>
            </div>
          </SurfacePanel>

          {loading ? <SurfacePanel className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">正在加载 AI 知识库...</SurfacePanel> : null}

          {!loading && entries.length === 0 ? <SurfacePanel className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">当前筛选条件下暂无知识条目。</SurfacePanel> : null}

          {entries.map((entry) => (
            <SurfacePanel className="p-5" key={entry.id}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      aria-pressed={selectedIds.includes(entry.id)}
                      className={`rounded-lg border px-2.5 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50 ${selectedIds.includes(entry.id) ? 'border-brand-600 bg-brand-600/10 text-brand-700 dark:text-brand-200' : 'border-black/10 dark:border-white/10'}`}
                      disabled={!promotableStatuses.has(entry.status)}
                      onClick={() => toggleSelected(entry)}
                      title={promotableStatuses.has(entry.status) ? '选择用于生成候选 Skill' : '需先批准后才能晋升 Skill'}
                      type="button"
                    >
                      {selectedIds.includes(entry.id) ? '已选择' : promotableStatuses.has(entry.status) ? '选择晋升' : '需先批准'}
                    </button>
                    <StatusBadge status={entry.status} />
                    <span className="rounded-lg bg-[var(--app-panel-muted-bg)] px-2.5 py-1 text-xs dark:bg-white/[0.06]">{categoryLabels[entry.category] ?? entry.category}</span>
                    <span className="rounded-lg bg-[var(--app-panel-muted-bg)] px-2.5 py-1 text-xs dark:bg-white/[0.06]">{roleScopeLabels[entry.roleScope] ?? entry.roleScope}</span>
                  </div>
                  <h3 className="mt-3 text-lg font-semibold">{entry.title}</h3>
                  <p className="mt-3 rounded-lg border border-black/5 bg-[var(--app-panel-muted-bg)] p-3 text-sm leading-6 text-slate-700 dark:border-white/10  dark:text-slate-300">{entry.canonicalQuestion}</p>
                  <p className="mt-3 line-clamp-4 text-sm leading-6 text-slate-600 dark:text-slate-400">{entry.canonicalAnswer}</p>
                  <div className="mt-4 grid gap-2 text-xs text-slate-500 sm:grid-cols-4 dark:text-slate-400">
                    <Metric label="安全" value={entry.safetyScore} />
                    <Metric label="隐私风险" value={entry.privacyRiskScore} inverse />
                    <Metric label="复用" value={entry.reuseValueScore} />
                    <Metric label="命中" value={entry.hitCount} raw />
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2 lg:w-36 lg:flex-col">
                  <button className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60" disabled={busy === entry.id || entry.status === 'APPROVED'} onClick={() => void runAction(entry.id, () => reviewAiKnowledge(entry.id, 'APPROVED', '管理员审核通过'), '知识条目已批准')} type="button">
                    批准
                  </button>
                  {activeTab === 'AUTO_APPROVED' ? (
                    <button className="rounded-lg border border-amber-500/20 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-60 dark:text-amber-200 dark:hover:bg-amber-950/30" disabled={busy === entry.id} onClick={() => void runAction(entry.id, () => reviewAiKnowledge(entry.id, 'ARCHIVED', '管理员归档自动入库知识'), '自动入库知识已归档')} type="button">
                      归档
                    </button>
                  ) : null}
                  <button className="rounded-lg border border-red-500/20 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 dark:text-red-200 dark:hover:bg-red-950/30" disabled={busy === entry.id || entry.status === 'REJECTED'} onClick={() => void runAction(entry.id, () => reviewAiKnowledge(entry.id, 'REJECTED', '未达到沉淀标准或存在风险'), '知识条目已拒绝')} type="button">
                    拒绝
                  </button>
                </div>
              </div>
            </SurfacePanel>
          ))}
            </>
          ) : null}

          {activeTab === 'MAINTENANCE' ? (
            <>
              <SurfacePanel className="p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">待维护任务</h2>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">按 P0-P4 优先级查看维护任务；解决或忽略会写入审计日志。修订、合并和回滚不在 KB-13 范围内。</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <SelectInput
                      className="min-w-32"
                      onChange={(value) => setMaintenanceStatus(value as AiKnowledgeMaintenanceTaskStatus | 'ALL')}
                      options={[
                        { label: '待处理', value: 'OPEN' },
                        { label: '已解决', value: 'RESOLVED' },
                        { label: '已忽略', value: 'DISMISSED' },
                        { label: '全部状态', value: 'ALL' },
                      ]}
                      value={maintenanceStatus}
                    />
                    <button className="rounded-lg border border-black/10 px-3 py-2 text-sm hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10" onClick={() => void loadAll()} type="button">查询</button>
                    <button
                      className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
                      disabled={busy === 'maintenance-run'}
                      onClick={() => void runAction('maintenance-run', runAiKnowledgeMaintenance, '维护扫描已完成')}
                      type="button"
                    >
                      运行扫描
                    </button>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(['ALL', 'P0', 'P1', 'P2', 'P3', 'P4'] as const).map((priority) => (
                    <button
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${maintenancePriority === priority ? 'border-brand-600/40 bg-brand-600/10 text-brand-800 dark:text-brand-200' : 'border-black/10 text-slate-500 hover:bg-black/5 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/10'}`}
                      key={priority}
                      onClick={() => setMaintenancePriority(priority)}
                      type="button"
                    >
                      {priority === 'ALL' ? '全部优先级' : priority}
                    </button>
                  ))}
                </div>
              </SurfacePanel>

              {loading ? <SurfacePanel className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">正在加载维护任务...</SurfacePanel> : null}
              {!loading && maintenanceTasks.length === 0 ? <SurfacePanel className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">当前筛选条件下暂无维护任务。</SurfacePanel> : null}

              {maintenanceTasks.map((task) => (
                <SurfacePanel className="p-5" key={task.id}>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <PriorityBadge priority={task.priority} />
                        <StatusBadge status={task.status} />
                        <span className="rounded-lg bg-[var(--app-panel-muted-bg)] px-2.5 py-1 text-xs dark:bg-white/[0.06]">{maintenanceTaskTypeLabels[task.taskType] ?? task.taskType}</span>
                        {task.knowledge ? <span className="rounded-lg bg-[var(--app-panel-muted-bg)] px-2.5 py-1 text-xs dark:bg-white/[0.06]">{categoryLabels[task.knowledge.category] ?? task.knowledge.category}</span> : null}
                      </div>
                      <h3 className="mt-3 text-lg font-semibold">{task.knowledge?.title ?? task.knowledgeId}</h3>
                      {task.knowledge ? (
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                          知识状态：{statusLabels[task.knowledge.status] ?? task.knowledge.status} · 维护状态：{maintenanceStatusLabels[task.knowledge.maintenanceStatus] ?? task.knowledge.maintenanceStatus} · 检索 {task.knowledge.retrievalEnabled ? '开启' : '关闭'} · 直接回答 {task.knowledge.directAnswerEnabled ? '开启' : '关闭'} · Agent 注入 {task.knowledge.agentInjectEnabled ? '开启' : '关闭'}
                        </p>
                      ) : null}
                      <p className="mt-3 whitespace-pre-wrap rounded-lg border border-black/5 bg-[var(--app-panel-muted-bg)] p-3 text-sm leading-6 text-slate-700 dark:border-white/10  dark:text-slate-300">{task.reason}</p>
                      <p className="mt-3 break-all text-xs text-slate-500 dark:text-slate-400">
                        dedupeKey: {task.dedupeKey} · 创建：{formatDateTime(task.createdAt)}
                        {task.resolvedAt ? ` · 处理：${formatDateTime(task.resolvedAt)}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2 lg:w-36 lg:flex-col">
                      <button className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60" disabled={busy === task.id || task.status !== 'OPEN'} onClick={() => void resolveMaintenance(task)} type="button">解决</button>
                      <button className="rounded-lg border border-amber-500/30 px-3 py-2 text-sm font-medium text-amber-700 disabled:opacity-60 dark:text-amber-200" disabled={busy === task.id || task.status !== 'OPEN'} onClick={() => void dismissMaintenance(task)} type="button">忽略</button>
                    </div>
                  </div>
                </SurfacePanel>
              ))}
            </>
          ) : null}

          {activeTab === 'SKILLS' ? (
            <SurfacePanel className="p-5">
              <h2 className="text-lg font-semibold">可晋升知识</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">选择已批准或自动入库的稳定知识，再在右侧生成候选 Skill。</p>
              <div className="mt-4 space-y-2">
                {entries.filter((entry) => promotableStatuses.has(entry.status)).length === 0 ? <p className="py-4 text-sm text-slate-500 dark:text-slate-400">暂无可晋升知识条目。</p> : null}
                {entries.filter((entry) => promotableStatuses.has(entry.status)).map((entry) => (
                  <button
                    aria-pressed={selectedIds.includes(entry.id)}
                    className={`flex w-full items-start justify-between gap-4 rounded-lg border p-3 text-left transition ${selectedIds.includes(entry.id) ? 'border-brand-600/40 bg-brand-600/10' : 'border-black/10 hover:border-brand-600/30 hover:bg-brand-600/5 dark:border-white/10'}`}
                    key={entry.id}
                    onClick={() => toggleSelected(entry)}
                    type="button"
                  >
                    <span>
                      <span className="block text-sm font-medium">{entry.title}</span>
                      <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{categoryLabels[entry.category] ?? entry.category} · 命中 {entry.hitCount} · 有用 {entry.helpfulCount}</span>
                    </span>
                    <span className="shrink-0 rounded-lg border border-black/10 px-2 py-1 text-xs dark:border-white/10">{selectedIds.includes(entry.id) ? '已选择' : '选择'}</span>
                  </button>
                ))}
              </div>
            </SurfacePanel>
          ) : null}
        </div>

        {activeTab === 'SKILLS' ? (
        <aside className="space-y-6">
          <SurfacePanel className="p-5">
            <h2 className="text-lg font-semibold">Skill 晋升</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">选择已批准知识，生成候选 Skill；批准后才能安装到平台 Hermes 容器挂载目录。</p>
            <div className="mt-4 space-y-3">
              <input className="w-full rounded-lg border border-black/10 bg-[var(--app-panel-bg)] px-3 py-2 text-sm outline-none focus:border-brand-600 dark:border-white/10" onChange={(event) => setSkillName(event.target.value)} placeholder="skill-name" value={skillName} />
              <textarea className="min-h-24 w-full rounded-lg border border-black/10 bg-[var(--app-panel-bg)] px-3 py-2 text-sm outline-none focus:border-brand-600 dark:border-white/10" onChange={(event) => setSkillDescription(event.target.value)} placeholder="描述这个 Skill 解决什么稳定问题" value={skillDescription} />
              <div className="rounded-lg bg-[var(--app-panel-muted-bg)] p-3 text-xs text-slate-500  dark:text-slate-400">已选择 {selectedEntries.length} 条：{selectedEntries.map((entry) => entry.title).join('、') || '暂无'}</div>
              <button className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60" disabled={selectedIds.length === 0 || !skillName || !skillDescription || selectedIds.some((id) => !visiblePromotableIds.has(id)) || busy === 'candidate'} onClick={() => void runAction('candidate', createCandidate, 'Skill 候选已创建，等待二次审核')} type="button">
                生成候选 Skill
              </button>
            </div>
          </SurfacePanel>

          <SurfacePanel className="p-5">
            <h2 className="text-lg font-semibold">候选 Skill</h2>
            <div className="mt-4 space-y-3">
              {candidates.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">暂无候选 Skill。</p> : null}
              {candidates.map((candidate) => (
                <div className="rounded-lg border border-black/5 bg-[var(--app-panel-muted-bg)] p-3 dark:border-white/10 " key={candidate.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{candidate.name}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{candidate.description}</p>
                    </div>
                    <StatusBadge status={candidate.status} />
                  </div>
                  {candidate.installedPath ? <p className="mt-2 break-all text-xs text-slate-500 dark:text-slate-400">安装路径：{candidate.installedPath}</p> : null}
                  {candidate.installError ? <p className="mt-2 text-xs text-red-600 dark:text-red-300">{candidate.installError}</p> : null}
                  {candidate.origin ? <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{candidate.origin === 'AUTO_APPROVAL' ? '自动入库' : candidate.origin === 'MANUAL_REVIEW' ? '人工入库草案' : '管理员创建'} · {candidate.operation === 'UPDATE' ? '更新已有 Skill' : '新建 Skill'}{candidate.decisionScore !== undefined && candidate.decisionScore !== null ? ` · 匹配 ${(candidate.decisionScore * 100).toFixed(0)}%` : ''}</p> : null}
                  {candidate.decisionReason ? <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">判定：{candidate.decisionReason}</p> : null}
                  {candidate.targetSkill ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">目标：{candidate.targetSkill.title} v{candidate.targetSkill.version} · {candidate.targetSkill.lifecycleStatus}</p> : null}
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <button className="rounded-lg border border-emerald-500/20 px-2 py-1.5 text-xs text-emerald-700 disabled:opacity-60 dark:text-emerald-200" disabled={candidate.status === 'APPROVED' || candidate.status === 'INSTALLED'} onClick={() => void runAction(candidate.id, () => reviewAiSkillCandidate(candidate.id, 'APPROVED', '允许安装到平台 Hermes'), 'Skill 候选已批准')} type="button">批准</button>
                    <button className="rounded-lg border border-red-500/20 px-2 py-1.5 text-xs text-red-700 disabled:opacity-60 dark:text-red-200" disabled={candidate.status === 'REJECTED'} onClick={() => void runAction(candidate.id, () => reviewAiSkillCandidate(candidate.id, 'REJECTED', '暂不晋升 Skill'), 'Skill 候选已拒绝')} type="button">拒绝</button>
                    <button className="rounded-lg border border-brand-600/20 px-2 py-1.5 text-xs text-brand-700 disabled:opacity-60 dark:text-brand-200" disabled={candidate.status !== 'APPROVED'} onClick={() => { if (window.confirm(`确认安装 Skill ${candidate.name} 到平台 Hermes skills 目录？安装后会影响平台 Agent 可加载能力。`)) void runAction(candidate.id, () => installAiSkillCandidate(candidate.id), 'Skill 已安装到平台 Hermes 目录') }} type="button">安装</button>
                  </div>
                </div>
              ))}
            </div>
          </SurfacePanel>

          <SurfacePanel className="p-5">
            <h2 className="text-lg font-semibold">发布与版本审计</h2>
            <div className="mt-4 space-y-3">
              {skillAudit.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">暂无 Skill 生命周期记录。</p> : null}
              {skillAudit.map((skill) => (
                <div className="rounded-lg border border-black/5 p-3 text-sm dark:border-white/10" key={skill.id}>
                  <div className="flex items-center justify-between gap-3"><span className="font-medium">{skill.title}</span><StatusBadge status={skill.lifecycleStatus} /></div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{skill.slug || skill.id} · v{skill.version} · 来源知识 {skill.sourceKnowledgeIds.length} 条</p>
                  {skill.syncError ? <p className="mt-1 text-xs text-red-600 dark:text-red-300">同步异常：{skill.syncError}</p> : null}
                  {skill.revisions.slice(0, 3).map((revision) => <p className="mt-1 text-xs text-slate-500 dark:text-slate-400" key={`${skill.id}-${revision.version}`}>v{revision.version} · {revision.operation === 'UPDATE' ? '更新' : '新建'} · {new Date(revision.createdAt).toLocaleString()}</p>)}
                </div>
              ))}
            </div>
          </SurfacePanel>

        </aside>
        ) : null}

        {activeTab === 'REVIEW' ? (
        <aside className="space-y-6">
          <SurfacePanel className="p-5">
            <h2 className="text-lg font-semibold">捕获队列</h2>
            <div className="mt-4 space-y-2">
              {captureJobs.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">暂无捕获任务。</p> : null}
              {captureJobs.map((job) => (
                <div className="rounded-lg border border-black/5 p-3 text-sm dark:border-white/10" key={job.id}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-500 dark:text-slate-400">{job.aiSpace}</span>
                    <StatusBadge status={job.status} />
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-600 dark:text-slate-400">{job.questionSummary}</p>
                  {job.error ? <p className="mt-2 text-xs text-red-600 dark:text-red-300">{job.error}</p> : null}
                </div>
              ))}
            </div>
          </SurfacePanel>
        </aside>
        ) : null}
      </div>
      </>
      )}
    </section>
  )
}

function PrimaryTab({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <button aria-selected={active} className={`border-b-2 px-4 py-3 text-sm font-semibold transition ${active ? 'border-brand-600 text-brand-800 dark:text-brand-200' : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`} onClick={onClick} role="tab" type="button">{label}</button>
}

function WorkspaceTab({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      aria-selected={active}
      className={`inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${active ? 'border-brand-600/30 bg-brand-600/10 text-brand-800 dark:border-brand-300/20 dark:text-brand-200' : 'border-transparent text-slate-500 hover:border-black/10 hover:bg-[var(--app-panel-muted-bg)] hover:text-slate-900 dark:text-slate-400 dark:hover:border-white/10 dark:hover:bg-white/[0.05] dark:hover:text-white'}`}
      onClick={onClick}
      role="tab"
      type="button"
    >
      {label}
    </button>
  )
}

function TagList({ items, label }: { items: string[]; label: string }) {
  return (
    <div className="mt-3">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.slice(0, 8).map((item) => <span className="rounded-lg bg-[var(--app-panel-muted-bg)] px-2.5 py-1 text-xs leading-5 dark:bg-white/[0.06]" key={item}>{item}</span>)}
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <SurfacePanel className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-semibold">{value}</p>
        </div>
      </div>
    </SurfacePanel>
  )
}

function StatusBadge({ status }: { status: string }) {
  return <span className="rounded-lg border border-black/10 px-2.5 py-1 text-xs font-medium dark:border-white/10">{statusLabels[status] ?? status}</span>
}

function PriorityBadge({ priority }: { priority: string }) {
  const tone =
    priority === 'P0'
      ? 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-200'
      : priority === 'P1'
        ? 'border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-200'
        : priority === 'P2'
          ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200'
          : 'border-black/10 bg-[var(--app-panel-muted-bg)] text-slate-600 dark:border-white/10  dark:text-slate-300'
  return <span className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${tone}`}>{priority}</span>
}

function ScorePill({ inverse, label, value }: { inverse?: boolean; label: string; value: number }) {
  const effective = inverse ? 1 - (value ?? 0) : (value ?? 0)
  const tone = effective >= 0.82 ? 'text-emerald-700 dark:text-emerald-200' : effective >= 0.62 ? 'text-amber-700 dark:text-amber-200' : 'text-red-700 dark:text-red-200'
  return (
    <div className="rounded-lg border border-black/5 bg-[var(--app-panel-muted-bg)] p-2 dark:border-white/10 ">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-slate-500 dark:text-slate-400">{label}</span>
        <span className={`font-semibold ${tone}`}>{formatPercent(value)}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
        <div className="h-full rounded-full bg-brand-600 dark:bg-brand-400" style={{ width: `${Math.max(4, Math.round(effective * 100))}%` }} />
      </div>
    </div>
  )
}

function formatPercent(value: number) {
  return `${Math.round((value ?? 0) * 100)}%`
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

function formatProblemSessionMode(mode: string) {
  return mode === 'admin' ? '管理员' : mode === 'auditor' ? '审核员' : '学生'
}

function getProblemSessionDuplicateRisk(summary: AiProblemSession['summaryJson']) {
  return Math.max(0, ...(summary?.similarKnowledgeMatches ?? []).map((match) => match.similarity))
}

function Metric({ inverse, label, raw, value }: { inverse?: boolean; label: string; raw?: boolean; value: number }) {
  const display = raw ? String(value) : `${Math.round((value ?? 0) * 100)}%`
  const width = raw ? Math.min(value * 8, 100) : Math.round((inverse ? 1 - value : value) * 100)
  return (
    <div className="rounded-lg bg-[var(--app-panel-muted-bg)] p-2 ">
      <div className="flex items-center justify-between gap-2"><span>{label}</span><span>{display}</span></div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10"><div className="h-full rounded-full bg-brand-600 dark:bg-brand-400" style={{ width: `${Math.max(4, width)}%` }} /></div>
    </div>
  )
}
