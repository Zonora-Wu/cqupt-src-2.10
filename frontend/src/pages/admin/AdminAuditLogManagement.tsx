import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  Eye,
  Filter,
  KeyRound,
  MonitorCog,
  SearchCheck,
  ShieldAlert,
  ShieldCheck,
  UserCog,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { AlertMessage } from '../../components/ui/AlertMessage'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { SearchInput } from '../../components/ui/SearchInput'
import { SelectInput } from '../../components/ui/SelectInput'
import { SurfacePanel } from '../../components/ui/SurfacePanel'
import { getAuditLogDetail, getAuditLogStats, listAuditLogs } from '../../services/auditLogs'
import type { AuditLogDetail, AuditLogItem, AuditRiskLevel, AuditLogStats } from '../../services/auditLogs'

const moduleOptions = ['全部模块', '认证登录', '漏洞管理', '敏感附件', '证书管理', '公告管理', '学习管理', '积分商城', '用户管理', '系统设置', 'AI 调用']
const levelOptions = ['全部等级', '普通', '重要', '高风险']
const resultOptions = ['全部结果', '成功', '失败', '已拦截']

const riskStyleMap: Record<AuditRiskLevel, string> = {
  HIGH: 'border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300',
  LOW: 'border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-300',
  MEDIUM: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
}

const resultStyles: Record<string, string> = {
  成功: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  失败: 'border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300',
  已拦截: 'border-orange-500/25 bg-orange-500/10 text-orange-700 dark:text-orange-300',
}

const moduleIcons: Record<string, typeof Activity> = {
  AI: Activity,
  ANNOUNCEMENT: Activity,
  ATTACHMENT: ShieldAlert,
  AUTH: KeyRound,
  CERTIFICATE: ShieldCheck,
  LEARNING: SearchCheck,
  MALL: Activity,
  SYSTEM: MonitorCog,
  USER: UserCog,
  VULNERABILITY: ShieldAlert,
}

export function AdminAuditLogManagement() {
  const [keyword, setKeyword] = useState('')
  const [module, setModule] = useState('全部模块')
  const [level, setLevel] = useState('全部等级')
  const [result, setResult] = useState('全部结果')
  const [page, setPage] = useState(1)
  const [logs, setLogs] = useState<AuditLogItem[]>([])
  const [stats, setStats] = useState<AuditLogStats | null>(null)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedLog, setSelectedLog] = useState<AuditLogDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')

  const query = useMemo(
    () => ({
      keyword: keyword.trim() || undefined,
      module,
      page,
      pageSize: 20,
      result,
      riskLevel: level,
    }),
    [keyword, level, module, page, result],
  )

  useEffect(() => {
    setPage(1)
  }, [keyword, level, module, result])

  useEffect(() => {
    let ignore = false

    async function loadLogs() {
      setError('')
      setLoading(true)
      try {
        const [listResponse, statsResponse] = await Promise.all([
          listAuditLogs(query),
          getAuditLogStats({
            keyword: query.keyword,
            module: query.module,
            result: query.result,
            riskLevel: query.riskLevel,
          }),
        ])
        if (ignore) return
        setLogs(listResponse.items)
        setStats(statsResponse)
        setTotal(listResponse.pagination.total)
        setTotalPages(listResponse.pagination.totalPages)
      } catch (loadError) {
        if (!ignore) {
          setError(loadError instanceof Error ? loadError.message : '审计日志加载失败')
        }
      } finally {
        if (!ignore) {
          setLoading(false)
        }
      }
    }

    void loadLogs()
    return () => {
      ignore = true
    }
  }, [query])

  async function openDetail(id: string) {
    setError('')
    setDetailLoading(true)
    setSelectedId(id)
    try {
      const detail = await getAuditLogDetail(id)
      setSelectedLog(detail)
    } catch (detailError) {
      setError(detailError instanceof Error ? detailError.message : '审计详情加载失败')
      setSelectedId(null)
    } finally {
      setDetailLoading(false)
    }
  }

  function resetFilters() {
    setKeyword('')
    setModule('全部模块')
    setLevel('全部等级')
    setResult('全部结果')
    setPage(1)
  }

  if (selectedId) {
    const log = selectedLog
    const Icon = log ? moduleIcons[log.module] ?? Activity : Activity

    return (
      <section className="relative z-10 mx-auto max-w-[1360px] px-5 pb-8 pt-24 md:px-8">
        <button
          className="inline-flex items-center gap-2 rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
          onClick={() => {
            setSelectedId(null)
            setSelectedLog(null)
          }}
          type="button"
        >
          <ArrowLeft className="h-4 w-4" />
          返回审计日志
        </button>

        {detailLoading && (
          <SurfacePanel className="mt-5 p-8 text-sm text-slate-500 dark:text-slate-400">正在加载审计详情...</SurfacePanel>
        )}

        {log && (
          <div className="mt-5 grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
            <SurfacePanel className="p-6 xl:sticky xl:top-24 xl:self-start">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-600/10 text-brand-700 dark:text-brand-300">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-mono text-xs text-slate-500 dark:text-slate-400">{log.id}</p>
                  <h1 className="mt-0 text-2xl font-semibold">{log.actionLabel}</h1>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <RiskBadge log={log} />
                <ResultBadge result={log.resultLabel} />
                <span className="rounded-md border border-black/10 px-2 py-1 text-xs font-medium text-slate-600 dark:border-white/10 dark:text-slate-300">
                  {log.moduleLabel}
                </span>
              </div>
              <div className="mt-5 space-y-3 border-t border-black/10 pt-5 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                <p>操作人：{log.actor ? `${log.actor.name}（${log.actor.roleLabel}）` : '系统或未知用户'}</p>
                <p>统一认证码：{log.actor?.unifiedCode || '未记录'}</p>
                <p>目标：{log.targetLabel}</p>
                <p>时间：{formatDateTime(log.createdAt)}</p>
                <p>来源 IP：{log.ipAddress || '未记录'}</p>
                <p>请求路径：{log.requestPath || '未记录'}</p>
              </div>
            </SurfacePanel>

            <div className="space-y-6">
              <SurfacePanel className="p-6">
                <h2 className="text-xl font-semibold">事件摘要</h2>
                <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-400">{log.summary}</p>
              </SurfacePanel>

              <SurfacePanel className="p-6">
                <h2 className="text-xl font-semibold">来源环境</h2>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <InfoBox label="来源 IP" value={log.ipAddress || '未记录'} />
                  <InfoBox label="请求路径" value={log.requestPath || '未记录'} />
                  <InfoBox label="目标类型" value={log.targetType || '未记录'} />
                  <InfoBox label="目标 ID" value={log.targetId || '未记录'} />
                </div>
                <p className="mt-4 break-all rounded-lg border border-black/10 bg-[var(--app-panel-muted-bg)] p-4 text-sm text-slate-600 dark:border-white/10  dark:text-slate-400">
                  {log.userAgent || '未记录 User-Agent'}
                </p>
              </SurfacePanel>

              <SurfacePanel className="p-6">
                <h2 className="text-xl font-semibold">脱敏元数据</h2>
                <pre className="mt-5 max-h-[520px] overflow-auto rounded-lg border border-black/10 bg-slate-950 p-4 text-sm leading-7 text-green-100 dark:border-white/10">
                  {JSON.stringify(log.metadata ?? {}, null, 2)}
                </pre>
              </SurfacePanel>
            </div>
          </div>
        )}
      </section>
    )
  }

  return (
    <section className="relative z-10 mx-auto max-w-[1360px] px-5 pb-8 pt-24 md:px-8">
      <PageHeader
        eyebrowIcon={<Activity className="h-3.5 w-3.5" />}
        title="审计日志"
        description="追踪登录认证、漏洞审核、敏感附件、证书签发、用户权限和系统设置等关键操作，所有记录默认按时间倒序保留。"
      />

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <StatCard label="日志总数" value={stats?.total ?? 0} hint="当前筛选范围" />
        <StatCard label="今日新增" value={stats?.today ?? 0} hint="从今日 00:00 起" />
        <StatCard label="高风险" value={stats?.highRisk ?? 0} hint="敏感或权限操作" />
        <StatCard label="当前结果" value={total} hint="列表匹配数量" />
      </div>

      <SurfacePanel className="relative z-30 mt-5 p-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_170px_150px_150px_auto] xl:items-end">
          <SearchInput
            label="搜索日志"
            onChange={setKeyword}
            placeholder="操作、操作人、统一认证码、目标、IP 或路径"
            value={keyword}
          />
          <SelectInput label="业务模块" onChange={setModule} options={moduleOptions} value={module} />
          <SelectInput label="风险等级" onChange={setLevel} options={levelOptions} value={level} />
          <SelectInput label="执行结果" onChange={setResult} options={resultOptions} value={result} />
          <button
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-black/10 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
            onClick={resetFilters}
            type="button"
          >
            <Filter className="h-4 w-4" />
            重置
          </button>
        </div>
      </SurfacePanel>

      {error && <AlertMessage className="mt-5" message={error} onClose={() => setError('')} variant="error" />}

      <SurfacePanel className="mt-5 overflow-hidden p-0">
        <div className="hidden grid-cols-[170px_minmax(0,1fr)_120px_130px_150px_100px] gap-4 border-b border-black/10 px-4 py-3 text-xs font-medium text-slate-500 md:grid dark:border-white/10 dark:text-slate-400">
          <span>时间</span>
          <span>事件</span>
          <span>模块</span>
          <span>操作人</span>
          <span>来源</span>
          <span className="text-right">操作</span>
        </div>

        {loading ? (
          <div className="p-8 text-sm text-slate-500 dark:text-slate-400">正在加载审计日志...</div>
        ) : logs.length > 0 ? (
          <div className="divide-y divide-black/10 dark:divide-white/10">
            {logs.map((item) => {
              const Icon = moduleIcons[item.module] ?? Activity
              return (
                <div
                  className="grid gap-4 px-4 py-4 text-sm transition hover:bg-[var(--app-panel-muted-bg)] md:grid-cols-[170px_minmax(0,1fr)_120px_130px_150px_100px] md:items-center dark:hover:bg-white/[0.035]"
                  key={item.id}
                >
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    <CalendarClock className="mb-1 h-4 w-4" />
                    {formatDateTime(item.createdAt)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{item.actionLabel}</span>
                      <RiskBadge log={item} />
                      <ResultBadge result={item.resultLabel} />
                    </div>
                    <p className="mt-1 line-clamp-1 text-xs text-slate-500 dark:text-slate-400">{item.summary}</p>
                    <p className="mt-1 font-mono text-xs text-slate-400">{item.id}</p>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <Icon className="h-4 w-4 text-brand-700 dark:text-brand-300" />
                    {item.moduleLabel}
                  </div>
                  <div>
                    <p>{item.actor?.name ?? '系统'}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.actor?.roleLabel ?? '未认证'}</p>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    <p>{item.ipAddress || '未记录'}</p>
                    <p className="mt-1 line-clamp-1">{item.requestPath || item.targetType}</p>
                  </div>
                  <div className="text-right">
                    <button
                      className="inline-flex items-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
                      onClick={() => void openDetail(item.id)}
                      type="button"
                    >
                      <Eye className="h-4 w-4" />
                      详情
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <EmptyState
            description="调整关键词、模块、风险等级或执行结果后再试一次。"
            icon={<AlertTriangle className="h-10 w-10" />}
            title="没有匹配的审计日志"
          />
        )}
      </SurfacePanel>

      <div className="mt-5 flex flex-col gap-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between dark:text-slate-400">
        <span>
          第 {page} / {totalPages} 页，共 {total} 条
        </span>
        <div className="flex items-center gap-2">
          <button
            className="rounded-lg border border-black/10 px-4 py-2 font-medium text-slate-700 transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
            disabled={page <= 1 || loading}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            type="button"
          >
            上一页
          </button>
          <button
            className="rounded-lg border border-black/10 px-4 py-2 font-medium text-slate-700 transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            type="button"
          >
            下一页
          </button>
        </div>
      </div>
    </section>
  )
}

function RiskBadge({ log }: { log: AuditLogItem }) {
  return <span className={`rounded-md border px-2 py-1 text-xs font-medium ${riskStyleMap[log.riskLevel]}`}>{log.riskLabel}</span>
}

function ResultBadge({ result }: { result: string }) {
  return (
    <span className={`rounded-md border px-2 py-1 text-xs font-medium ${resultStyles[result] ?? resultStyles.成功}`}>
      {result}
    </span>
  )
}

function StatCard({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <SurfacePanel className="p-4">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>
    </SurfacePanel>
  )
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-black/10 bg-[var(--app-panel-muted-bg)] p-4 dark:border-white/10 ">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 break-all text-sm font-medium">{value}</p>
    </div>
  )
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    second: '2-digit',
    year: 'numeric',
  }).format(date)
}
