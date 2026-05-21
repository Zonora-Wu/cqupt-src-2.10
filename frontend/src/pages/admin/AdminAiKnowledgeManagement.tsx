import { Bot, CheckCircle2, DatabaseZap, FileText, Hammer, PackageCheck, RefreshCw, ShieldCheck, Sparkles, XCircle } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { FloatingNotice } from '../../components/ui/FloatingNotice'
import { SurfacePanel } from '../../components/ui/SurfacePanel'
import {
  createAiSkillCandidate,
  getAiKnowledgeStats,
  installAiSkillCandidate,
  listAiKnowledge,
  listAiKnowledgeCaptureJobs,
  listAiSkillCandidates,
  processAiKnowledgeCaptures,
  reviewAiKnowledge,
  reviewAiSkillCandidate,
  type AiKnowledgeEntry,
  type AiKnowledgeStats,
  type AiKnowledgeStatus,
  type AiSkillCandidate,
} from '../../services/aiKnowledge'

const statusLabels: Record<string, string> = {
  APPROVED: '已批准',
  ARCHIVED: '已归档',
  AUTO_APPROVED: '自动批准',
  CANDIDATE: '候选',
  COMPLETED: '已完成',
  DISCARDED: '已丢弃',
  FAILED: '失败',
  INSTALLED: '已安装',
  NEEDS_REVIEW: '待审核',
  PENDING: '待处理',
  PROCESSING: '处理中',
  PROMOTED_TO_SKILL: '已晋升 Skill',
  REJECTED: '已拒绝',
}

const roleScopeLabels: Record<string, string> = {
  ADMIN: '管理员',
  ALL: '全部角色',
  AUDITOR: '审核员',
  STUDENT: '学生',
}

type KnowledgeStatusFilter = AiKnowledgeStatus | 'ALL'

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

export function AdminAiKnowledgeManagement() {
  const [entries, setEntries] = useState<AiKnowledgeEntry[]>([])
  const [candidates, setCandidates] = useState<AiSkillCandidate[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [stats, setStats] = useState<AiKnowledgeStats | null>(null)
  const [captureJobs, setCaptureJobs] = useState<AiKnowledgeStats['recentQueue']>([])
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
      const [statsData, entriesData, candidatesData, jobsData] = await Promise.all([
        getAiKnowledgeStats(),
        listAiKnowledge({ page: 1, pageSize: 20, status: status === 'ALL' ? undefined : status, keyword }),
        listAiSkillCandidates(),
        listAiKnowledgeCaptureJobs({ page: 1, pageSize: 8 }),
      ])
      setStats(statsData)
      setEntries(entriesData.items)
      setCandidates(candidatesData)
      setCaptureJobs(jobsData.items)
      setSelectedIds((current) => current.filter((id) => entriesData.items.some((entry) => entry.id === id && promotableStatuses.has(entry.status))))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'AI 知识库数据加载失败')
    } finally {
      setLoading(false)
    }
  }, [keyword, status])

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

  return (
    <section className="relative z-10 mx-auto max-w-[1360px] px-5 pb-8 pt-24 md:px-8">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-brand-700 dark:text-green-300">
            <Bot className="h-3.5 w-3.5" /> AI Knowledge Ops
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">AI 知识沉淀审核</h1>
          <p className="mt-3 max-w-3xl leading-7 text-slate-600 dark:text-slate-400">
            审核从 AI 对话中沉淀出的通用知识，确认脱敏、泛化和安全边界后再进入生产知识库；稳定方法论可二次审批晋升为 Hermes Skill。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="rounded-lg border border-black/10 px-4 py-2 text-sm font-medium hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10" onClick={() => void loadAll()} type="button">
            <RefreshCw className="mr-2 inline h-4 w-4" />刷新
          </button>
          <button
            className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60 dark:bg-green-500 dark:text-[#07100a]"
            disabled={busy === 'process'}
            onClick={() => void runAction('process', processAiKnowledgeCaptures, '捕获队列处理完成')}
            type="button"
          >
            <DatabaseZap className="mr-2 inline h-4 w-4" />处理捕获队列
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
        <StatCard icon={FileText} label="待审核知识" value={stats?.totals.needsReview ?? 0} />
        <StatCard icon={ShieldCheck} label="已批准知识" value={stats?.totals.approved ?? 0} />
        <StatCard icon={Sparkles} label="24h 命中" value={stats?.totals.recentHits ?? 0} />
        <StatCard icon={PackageCheck} label="已安装 Skill" value={stats?.totals.installedSkills ?? 0} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <SurfacePanel className="p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold">知识审核队列</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">只批准已脱敏、可泛化、可撤回的长期知识。</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <input className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-brand-600 dark:border-white/10 dark:bg-[#101711]" onChange={(event) => setKeyword(event.target.value)} placeholder="搜索问题/答案" value={keyword} />
                <select className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-[#101711]" onChange={(event) => setStatus(event.target.value as KnowledgeStatusFilter)} value={status}>
                  <option value="NEEDS_REVIEW">待审核</option>
                  <option value="APPROVED">已批准</option>
                  <option value="REJECTED">已拒绝</option>
                  <option value="ALL">全部</option>
                </select>
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
                      className={`rounded-lg border px-2.5 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50 ${selectedIds.includes(entry.id) ? 'border-brand-600 bg-brand-600/10 text-brand-700 dark:text-green-200' : 'border-black/10 dark:border-white/10'}`}
                      disabled={!promotableStatuses.has(entry.status)}
                      onClick={() => toggleSelected(entry)}
                      title={promotableStatuses.has(entry.status) ? '选择用于生成候选 Skill' : '需先批准后才能晋升 Skill'}
                      type="button"
                    >
                      {selectedIds.includes(entry.id) ? '已选择' : promotableStatuses.has(entry.status) ? '选择晋升' : '需先批准'}
                    </button>
                    <StatusBadge status={entry.status} />
                    <span className="rounded-lg bg-black/[0.04] px-2.5 py-1 text-xs dark:bg-white/[0.06]">{categoryLabels[entry.category] ?? entry.category}</span>
                    <span className="rounded-lg bg-black/[0.04] px-2.5 py-1 text-xs dark:bg-white/[0.06]">{roleScopeLabels[entry.roleScope] ?? entry.roleScope}</span>
                  </div>
                  <h3 className="mt-3 text-lg font-semibold">{entry.title}</h3>
                  <p className="mt-3 rounded-lg border border-black/5 bg-black/[0.025] p-3 text-sm leading-6 text-slate-700 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-300">{entry.canonicalQuestion}</p>
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
                    <CheckCircle2 className="mr-1.5 inline h-4 w-4" />批准
                  </button>
                  <button className="rounded-lg border border-red-500/20 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 dark:text-red-200 dark:hover:bg-red-950/30" disabled={busy === entry.id || entry.status === 'REJECTED'} onClick={() => void runAction(entry.id, () => reviewAiKnowledge(entry.id, 'REJECTED', '未达到沉淀标准或存在风险'), '知识条目已拒绝')} type="button">
                    <XCircle className="mr-1.5 inline h-4 w-4" />拒绝
                  </button>
                </div>
              </div>
            </SurfacePanel>
          ))}
        </div>

        <aside className="space-y-6">
          <SurfacePanel className="p-5">
            <h2 className="text-lg font-semibold">Skill 晋升</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">选择已批准知识，生成候选 Skill；批准后才能安装到平台 Hermes 容器挂载目录。</p>
            <div className="mt-4 space-y-3">
              <input className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-brand-600 dark:border-white/10 dark:bg-[#101711]" onChange={(event) => setSkillName(event.target.value)} placeholder="skill-name" value={skillName} />
              <textarea className="min-h-24 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-brand-600 dark:border-white/10 dark:bg-[#101711]" onChange={(event) => setSkillDescription(event.target.value)} placeholder="描述这个 Skill 解决什么稳定问题" value={skillDescription} />
              <div className="rounded-lg bg-black/[0.035] p-3 text-xs text-slate-500 dark:bg-white/[0.04] dark:text-slate-400">已选择 {selectedEntries.length} 条：{selectedEntries.map((entry) => entry.title).join('、') || '暂无'}</div>
              <button className="w-full rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 dark:bg-green-500 dark:text-[#07100a]" disabled={selectedIds.length === 0 || !skillName || !skillDescription || selectedIds.some((id) => !visiblePromotableIds.has(id)) || busy === 'candidate'} onClick={() => void runAction('candidate', createCandidate, 'Skill 候选已创建，等待二次审核')} type="button">
                <Hammer className="mr-2 inline h-4 w-4" />生成候选 Skill
              </button>
            </div>
          </SurfacePanel>

          <SurfacePanel className="p-5">
            <h2 className="text-lg font-semibold">候选 Skill</h2>
            <div className="mt-4 space-y-3">
              {candidates.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">暂无候选 Skill。</p> : null}
              {candidates.map((candidate) => (
                <div className="rounded-lg border border-black/5 bg-black/[0.025] p-3 dark:border-white/10 dark:bg-white/[0.035]" key={candidate.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{candidate.name}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{candidate.description}</p>
                    </div>
                    <StatusBadge status={candidate.status} />
                  </div>
                  {candidate.installedPath ? <p className="mt-2 break-all text-xs text-slate-500 dark:text-slate-400">安装路径：{candidate.installedPath}</p> : null}
                  {candidate.installError ? <p className="mt-2 text-xs text-red-600 dark:text-red-300">{candidate.installError}</p> : null}
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <button className="rounded-lg border border-emerald-500/20 px-2 py-1.5 text-xs text-emerald-700 disabled:opacity-60 dark:text-emerald-200" disabled={candidate.status === 'APPROVED' || candidate.status === 'INSTALLED'} onClick={() => void runAction(candidate.id, () => reviewAiSkillCandidate(candidate.id, 'APPROVED', '允许安装到平台 Hermes'), 'Skill 候选已批准')} type="button">批准</button>
                    <button className="rounded-lg border border-red-500/20 px-2 py-1.5 text-xs text-red-700 disabled:opacity-60 dark:text-red-200" disabled={candidate.status === 'REJECTED'} onClick={() => void runAction(candidate.id, () => reviewAiSkillCandidate(candidate.id, 'REJECTED', '暂不晋升 Skill'), 'Skill 候选已拒绝')} type="button">拒绝</button>
                    <button className="rounded-lg border border-brand-600/20 px-2 py-1.5 text-xs text-brand-700 disabled:opacity-60 dark:text-green-200" disabled={candidate.status !== 'APPROVED'} onClick={() => { if (window.confirm(`确认安装 Skill ${candidate.name} 到平台 Hermes skills 目录？安装后会影响平台 Agent 可加载能力。`)) void runAction(candidate.id, () => installAiSkillCandidate(candidate.id), 'Skill 已安装到平台 Hermes 目录') }} type="button">安装</button>
                  </div>
                </div>
              ))}
            </div>
          </SurfacePanel>

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
      </div>
    </section>
  )
}

function StatCard({ icon: Icon, label, value }: { icon: typeof FileText; label: string; value: number }) {
  return (
    <SurfacePanel className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-semibold">{value}</p>
        </div>
        <Icon className="h-7 w-7 text-brand-700 dark:text-green-300" />
      </div>
    </SurfacePanel>
  )
}

function StatusBadge({ status }: { status: string }) {
  return <span className="rounded-lg border border-black/10 px-2.5 py-1 text-xs font-medium dark:border-white/10">{statusLabels[status] ?? status}</span>
}

function Metric({ inverse, label, raw, value }: { inverse?: boolean; label: string; raw?: boolean; value: number }) {
  const display = raw ? String(value) : `${Math.round((value ?? 0) * 100)}%`
  const width = raw ? Math.min(value * 8, 100) : Math.round((inverse ? 1 - value : value) * 100)
  return (
    <div className="rounded-lg bg-black/[0.035] p-2 dark:bg-white/[0.04]">
      <div className="flex items-center justify-between gap-2"><span>{label}</span><span>{display}</span></div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10"><div className="h-full rounded-full bg-brand-600 dark:bg-green-400" style={{ width: `${Math.max(4, width)}%` }} /></div>
    </div>
  )
}
