import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  Loader2,
  ShieldBan,
  XCircle,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../../components/ui/PageHeader'
import { SurfacePanel } from '../../components/ui/SurfacePanel'
import {
  type AdminJobListItem,
  type AdminJobQuery,
  type AiRetestOverviewStats,
  getAiRetestStats,
  listAdminAiRetestJobs,
} from '../../services/aiRetestAdmin'
import type { AiRetestJobStatus } from '../../services/aiRetests'

const STATUS_LABELS: Record<string, string> = {
  ADVISORY_ONLY: '仅建议',
  BLOCKED: '已阻断',
  CANCELLED: '已取消',
  CANCELLING: '取消中',
  DIRECT_ACTION_REVIEW: '动作审批',
  DIRECT_PLAN_REVIEW: '方案审批',
  DIRECT_RUNNING: 'Direct 执行',
  EXPIRED: '已过期',
  FAILED: '失败',
  PENDING: '等待中',
  PLAN_REVIEW: '计划审批',
  PLANNING: '计划生成',
  POLICY_CHECK: '策略审查',
  QUEUED: '已入队',
  REPORTING: '报告生成',
  RUNNING: '执行中',
  SUCCEEDED: '成功',
}

const STATUS_COLORS: Record<string, string> = {
  BLOCKED: 'text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30',
  CANCELLED: 'text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800',
  FAILED: 'text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30',
  RUNNING: 'text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30',
  SUCCEEDED: 'text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30',
}

function StatusPill({ status }: { status: AiRetestJobStatus }) {
  const colorClass = STATUS_COLORS[status] ?? 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800'
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${minutes}m ${secs}s`
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

type FilterBarProps = {
  query: AdminJobQuery
  onChange: (q: AdminJobQuery) => void
  onRefresh: () => void
}

function FilterBar({ query, onChange, onRefresh }: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        aria-label="状态筛选"
        className="rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-sm text-slate-700 dark:border-white/[0.06] dark:bg-[#0f1511] dark:text-slate-300"
        onChange={(e) => onChange({ ...query, page: 1, status: e.target.value || undefined })}
        value={query.status ?? ''}
      >
        <option value="">全部状态</option>
        {Object.entries(STATUS_LABELS).map(([key, label]) => (
          <option key={key} value={key}>{label}</option>
        ))}
      </select>
      <select
        aria-label="通道筛选"
        className="rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-sm text-slate-700 dark:border-white/[0.06] dark:bg-[#0f1511] dark:text-slate-300"
        onChange={(e) => onChange({ ...query, page: 1, mode: e.target.value || undefined })}
        value={query.mode ?? ''}
      >
        <option value="">全部通道</option>
        <option value="CONTROLLED_RUN">Runner 可控执行</option>
        <option value="HERMES_DIRECT">Hermes Direct</option>
        <option value="PLAN_ONLY">仅计划</option>
      </select>
      <input
        aria-label="关键词搜索"
        className="rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 dark:border-white/[0.06] dark:bg-[#0f1511] dark:text-slate-300"
        onChange={(e) => onChange({ ...query, page: 1, keyword: e.target.value || undefined })}
        placeholder="搜索 jobId / 错误码 / traceId…"
        type="text"
        value={query.keyword ?? ''}
      />
      <button
        className="rounded-lg border border-black/[0.08] bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-white/[0.06] dark:bg-[#0f1511] dark:text-slate-300 dark:hover:bg-white/[0.04]"
        onClick={onRefresh}
        type="button"
      >
        刷新
      </button>
    </div>
  )
}

function StatCard({
  color,
  icon: Icon,
  label,
  value,
}: {
  color: string
  icon: React.ComponentType<{ className?: string; size?: number }>
  label: string
  value: number | string
}) {
  return (
    <SurfacePanel className="flex items-center gap-4 px-5 py-4">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${color}`}>
        <Icon className="text-white" size={20} />
      </div>
      <div>
        <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</div>
        <div className="text-2xl font-bold text-slate-900 dark:text-white">{value}</div>
      </div>
    </SurfacePanel>
  )
}

function DistributionBar({ data, label }: { data: Array<{ key: string; label: string; count: number; color: string }>; label: string }) {
  const total = data.reduce((sum, d) => sum + d.count, 0)
  if (total === 0) return null
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</div>
      <div className="flex h-4 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.06]">
        {data.map((d) => (
          <div
            key={d.key}
            className={`${d.color} transition-all`}
            style={{ width: `${Math.max(0, (d.count / total) * 100)}%` }}
            title={`${d.label}: ${d.count}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {data.map((d) => (
          <div key={d.key} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
            <span className={`inline-block h-2 w-2 rounded-full ${d.color}`} />
            {d.label} ({d.count})
          </div>
        ))}
      </div>
    </div>
  )
}

const STATUS_DIST_COLORS: Record<string, string> = {
  BLOCKED: 'bg-red-500',
  CANCELLED: 'bg-zinc-400',
  FAILED: 'bg-orange-500',
  RUNNING: 'bg-blue-500',
  SUCCEEDED: 'bg-emerald-500',
  other: 'bg-slate-300',
}

const RISK_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-600',
  HIGH: 'bg-orange-500',
  LOW: 'bg-emerald-500',
  MEDIUM: 'bg-amber-500',
}

export function AdminAiRetestDashboard() {
  const [stats, setStats] = useState<AiRetestOverviewStats | null>(null)
  const [jobs, setJobs] = useState<AdminJobListItem[]>([])
  const [jobTotal, setJobTotal] = useState(0)
  const [jobPage, setJobPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState<AdminJobQuery>({ page: 1, pageSize: 15 })

  const loadStats = useCallback(async () => {
    try {
      const data = await getAiRetestStats()
      setStats(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载统计数据失败')
    }
  }, [])

  const loadJobs = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listAdminAiRetestJobs(query)
      setJobs(data.items)
      setJobTotal(data.total)
      setJobPage(data.page)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载任务列表失败')
    } finally {
      setLoading(false)
    }
  }, [query])

  useEffect(() => { loadStats(); loadJobs() }, [loadStats, loadJobs])

  const statusDistribution = useMemo(() => {
    if (!stats) return []
    const entries: [string, number][] = [
      ['SUCCEEDED', stats.succeededJobs],
      ['FAILED', stats.failedJobs],
      ['BLOCKED', stats.blockedJobs],
      ['CANCELLED', stats.cancelledJobs],
      ['RUNNING', stats.activeJobs],
    ]
    return entries
      .filter(([, c]) => c > 0)
      .map(([key, count]) => ({
      key,
      count,
      label: STATUS_LABELS[key] ?? key,
      color: STATUS_DIST_COLORS[key] ?? STATUS_DIST_COLORS.other,
    }))
  }, [stats])

  const riskDistribution = useMemo(() => {
    if (!stats) return []
    return stats.byRiskLevel
      .filter((r) => r.count > 0)
      .map((r) => ({
        key: r.riskLevel,
        count: r.count,
        label: r.riskLevel === 'LOW' ? '低危' : r.riskLevel === 'MEDIUM' ? '中危' : r.riskLevel === 'HIGH' ? '高危' : r.riskLevel === 'CRITICAL' ? '严重' : r.riskLevel,
        color: RISK_COLORS[r.riskLevel] ?? 'bg-slate-300',
      }))
  }, [stats])

  return (
    <div>
      <PageHeader
        description="全局 AI 漏洞复测运营数据总览"
        eyebrow="管理员"
        eyebrowIcon={<BarChart3 className="h-12 w-12" />}
        title="AI 复测运营看板"
      />

      {error && (
        <SurfacePanel className="mb-6 border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/20 dark:text-red-400">
          <AlertTriangle className="mr-2 inline-block h-4 w-4" />
          {error}
        </SurfacePanel>
      )}

      {stats && (
        <>
          {/* Overview cards */}
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-6">
            <StatCard color="bg-slate-600" icon={BarChart3} label="总任务数（30天）" value={stats.totalJobs} />
            <StatCard color="bg-blue-500" icon={Loader2} label="活跃任务" value={stats.activeJobs} />
            <StatCard color="bg-emerald-500" icon={CheckCircle2} label="成功率" value={`${stats.successRate}%`} />
            <StatCard color="bg-red-500" icon={ShieldBan} label="阻断率" value={`${stats.blockRate}%`} />
            <StatCard color="bg-amber-500" icon={XCircle} label="失败任务" value={stats.failedJobs} />
            <StatCard color="bg-violet-500" icon={Clock} label="平均耗时" value={stats.avgDurationMs > 0 ? formatDuration(stats.avgDurationMs) : '—'} />
          </div>

          {/* Distributions */}
          <div className="mb-6 grid gap-6 lg:grid-cols-2">
            {statusDistribution.length > 0 && (
              <SurfacePanel className="p-5">
                <DistributionBar data={statusDistribution} label="任务状态分布" />
              </SurfacePanel>
            )}
            {riskDistribution.length > 0 && (
              <SurfacePanel className="p-5">
                <DistributionBar data={riskDistribution} label="风险等级分布" />
              </SurfacePanel>
            )}
          </div>

          {/* Channel and decision breakdown */}
          <div className="mb-6 grid gap-6 lg:grid-cols-2">
            {stats.byMode.length > 0 && (
              <SurfacePanel className="p-5">
                <div className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">执行通道</div>
                <div className="space-y-2">
                  {stats.byMode.map((m) => (
                    <div key={m.mode} className="flex items-center justify-between text-sm">
                      <span className="text-slate-700 dark:text-slate-300">
                        {m.mode === 'CONTROLLED_RUN' ? 'Runner 可控执行' : m.mode === 'HERMES_DIRECT' ? 'Hermes Direct' : m.mode === 'PLAN_ONLY' ? '仅计划' : m.mode}
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-white">{m.count}</span>
                    </div>
                  ))}
                </div>
              </SurfacePanel>
            )}
            {stats.byPolicyDecision.length > 0 && (
              <SurfacePanel className="p-5">
                <div className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">策略决策</div>
                <div className="space-y-2">
                  {stats.byPolicyDecision.map((d) => (
                    <div key={d.decision} className="flex items-center justify-between text-sm">
                      <span className="text-slate-700 dark:text-slate-300">
                        {d.decision === 'ALLOW' ? '允许执行' : d.decision === 'ALLOW_WITH_LIMITS' ? '受限执行' : d.decision === 'REQUIRE_HUMAN_APPROVAL' ? '需人工审批' : d.decision === 'ADVISORY_ONLY' ? '仅建议' : d.decision === 'BLOCK' ? '阻断' : d.decision}
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-white">{d.count}</span>
                    </div>
                  ))}
                </div>
              </SurfacePanel>
            )}
          </div>
        </>
      )}

      {/* Job list */}
      <SurfacePanel className="overflow-hidden p-0">
        <div className="border-b border-black/[0.06] px-5 py-4 dark:border-white/[0.06]">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              任务列表
              {jobTotal > 0 && <span className="ml-2 font-normal text-slate-500">({jobTotal} 条)</span>}
            </h2>
            <FilterBar
              onChange={setQuery}
              query={query}
              onRefresh={loadJobs}
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-sm text-slate-500">
            <Loader2 className="mr-2 inline-block h-4 w-4 animate-spin" /> 加载中…
          </div>
        ) : jobs.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">暂无数据</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-black/[0.06] bg-slate-50 dark:border-white/[0.06] dark:bg-white/[0.02]">
                    <th className="px-5 py-3 font-medium text-slate-500 dark:text-slate-400">Job ID</th>
                    <th className="px-5 py-3 font-medium text-slate-500 dark:text-slate-400">状态</th>
                    <th className="px-5 py-3 font-medium text-slate-500 dark:text-slate-400">通道</th>
                    <th className="px-5 py-3 font-medium text-slate-500 dark:text-slate-400">风险</th>
                    <th className="px-5 py-3 font-medium text-slate-500 dark:text-slate-400">策略决策</th>
                    <th className="px-5 py-3 font-medium text-slate-500 dark:text-slate-400">复现结论</th>
                    <th className="px-5 py-3 font-medium text-slate-500 dark:text-slate-400">发起人</th>
                    <th className="px-5 py-3 font-medium text-slate-500 dark:text-slate-400">创建时间</th>
                    <th className="px-5 py-3 font-medium text-slate-500 dark:text-slate-400">完成时间</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr
                      key={job.id}
                      className="border-b border-black/[0.04] transition hover:bg-slate-50 dark:border-white/[0.03] dark:hover:bg-white/[0.02]"
                    >
                      <td className="max-w-[160px] truncate px-5 py-3 font-mono text-xs text-slate-700 dark:text-slate-300" title={job.id}>
                        {job.id.slice(-12)}
                      </td>
                      <td className="px-5 py-3"><StatusPill status={job.status} /></td>
                      <td className="px-5 py-3 text-slate-600 dark:text-slate-400">
                        {job.mode === 'CONTROLLED_RUN' ? 'Runner' : job.mode === 'HERMES_DIRECT' ? 'Direct' : job.mode === 'PLAN_ONLY' ? '计划' : job.mode}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          job.riskLevel === 'CRITICAL' || job.riskLevel === 'HIGH' ? 'text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30' :
                          job.riskLevel === 'MEDIUM' ? 'text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30' :
                          'text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30'
                        }`}>
                          {job.riskLevel === 'LOW' ? '低' : job.riskLevel === 'MEDIUM' ? '中' : job.riskLevel === 'HIGH' ? '高' : job.riskLevel === 'CRITICAL' ? '严重' : '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-500 dark:text-slate-400">{job.policyDecision ?? '—'}</td>
                      <td className="px-5 py-3 text-xs text-slate-500 dark:text-slate-400">
                        {job.reproducibility === 'REPRODUCED' ? '已复现' : job.reproducibility === 'NOT_REPRODUCED' ? '未复现' : job.reproducibility === 'NOT_EXECUTED_PLATFORM_BLOCKED' ? '平台阻断' : job.reproducibility === 'BLOCKED_BY_POLICY' ? '策略阻断' : '—'}
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-600 dark:text-slate-400">
                        {job.requestedBy?.name ?? '—'}
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-500 dark:text-slate-400">{formatDate(job.createdAt)}</td>
                      <td className="px-5 py-3 text-xs text-slate-500 dark:text-slate-400">{formatDate(job.finishedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {jobTotal > (query.pageSize ?? 15) && (
              <div className="flex items-center justify-between border-t border-black/[0.06] px-5 py-3 dark:border-white/[0.06]">
                <div className="text-xs text-slate-500">
                  共 {jobTotal} 条，第 {jobPage} 页
                </div>
                <div className="flex gap-2">
                  <button
                    className="rounded-lg border border-black/[0.08] bg-white px-3 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-40 dark:border-white/[0.06] dark:bg-[#0f1511] dark:text-slate-300"
                    disabled={jobPage <= 1}
                    onClick={() => setQuery({ ...query, page: Math.max(1, jobPage - 1) })}
                    type="button"
                  >
                    上一页
                  </button>
                  <button
                    className="rounded-lg border border-black/[0.08] bg-white px-3 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-40 dark:border-white/[0.06] dark:bg-[#0f1511] dark:text-slate-300"
                    disabled={jobPage * (query.pageSize ?? 15) >= jobTotal}
                    onClick={() => setQuery({ ...query, page: jobPage + 1 })}
                    type="button"
                  >
                    下一页
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </SurfacePanel>
    </div>
  )
}
