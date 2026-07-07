import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Globe,
  KeyRound,
  LogIn,
  LogOut,
  Monitor,
  RefreshCcw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useState } from 'react'
import { PageHeader } from '../../components/ui/PageHeader'
import { SurfacePanel } from '../../components/ui/SurfacePanel'
import { getMyAuditLogs, type MyAuditLogItem, type MyAuditLogQuery } from '../../services/account'

type SecurityTab = 'overview' | 'login' | 'operations'

const TABS: { description: string; icon: ReactNode; id: SecurityTab; label: string }[] = [
  { id: 'overview', label: '安全概览', icon: <ShieldCheck className="h-4 w-4" />, description: '账号安全状态' },
  { id: 'login', label: '登录记录', icon: <LogIn className="h-4 w-4" />, description: '登录与登出历史' },
  { id: 'operations', label: '操作日志', icon: <Activity className="h-4 w-4" />, description: '账号操作记录' },
]

const MODULE_OPTIONS = ['全部', 'AUTH', 'VULNERABILITY', 'CERTIFICATE', 'ANNOUNCEMENT', 'LEARNING', 'MALL', 'AI', 'SYSTEM']
const MODULE_LABELS: Record<string, string> = {
  '全部': '全部模块',
  AUTH: '认证登录',
  VULNERABILITY: '漏洞管理',
  CERTIFICATE: '证书管理',
  ANNOUNCEMENT: '公告管理',
  LEARNING: '学习管理',
  MALL: '积分商城',
  AI: 'AI 调用',
  SYSTEM: '系统设置',
}
const RESULT_OPTIONS = ['全部', 'success', 'failure']
const RESULT_LABELS: Record<string, string> = { '全部': '全部结果', success: '成功', failure: '失败' }

export function UserAccountSecurity() {
  const [activeTab, setActiveTab] = useState<SecurityTab>('overview')

  return (
    <section className="relative z-10 mx-auto max-w-[1360px] px-5 pb-8 pt-24 md:px-8">
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <PageHeader
          eyebrow="Account Security"
          eyebrowIcon={<Shield className="h-3.5 w-3.5" />}
          title="账号安全"
          description="查看你的登录历史和账号操作记录，及时发现异常。所有记录均来自服务端，无法伪造。"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="xl:sticky xl:top-24 xl:self-start">
          <SurfacePanel className="overflow-hidden p-0">
            <div className="border-b border-black/10 px-4 py-3 dark:border-white/10">
              <p className="text-sm font-semibold">安全中心</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">账号安全记录查询</p>
            </div>
            <div className="p-2">
              {TABS.map((tab) => (
                <button
                  className={`flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition ${
                    activeTab === tab.id
                      ? 'bg-brand-600 text-white'
                      : 'text-slate-700 hover:bg-black/5 dark:text-slate-300 dark:hover:bg-white/10'
                  }`}
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  type="button"
                >
                  <span className="mt-0.5">{tab.icon}</span>
                  <span>
                    <span className="block text-sm font-semibold">{tab.label}</span>
                    <span
                      className={`mt-1 block text-xs leading-5 ${
                        activeTab === tab.id ? 'text-white/75' : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {tab.description}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </SurfacePanel>
        </aside>

        <div>
          {activeTab === 'overview' && <SecurityOverview onViewLogin={() => setActiveTab('login')} onViewOps={() => setActiveTab('operations')} />}
          {activeTab === 'login' && <LoginHistory />}
          {activeTab === 'operations' && <OperationLogs />}
        </div>
      </div>
    </section>
  )
}

// ─── 安全概览 ──────────────────────────────────────────────────────────────────

function SecurityOverview({
  onViewLogin,
  onViewOps,
}: {
  onViewLogin: () => void
  onViewOps: () => void
}) {
  const [loginLogs, setLoginLogs] = useState<MyAuditLogItem[]>([])
  const [recentOps, setRecentOps] = useState<MyAuditLogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loginFailCount, setLoginFailCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    Promise.all([
      getMyAuditLogs({ module: 'AUTH', pageSize: 5 }),
      getMyAuditLogs({ pageSize: 8 }),
      getMyAuditLogs({ module: 'AUTH', result: 'failure', pageSize: 50 }),
    ]).then(([authRes, opsRes, failRes]) => {
      if (cancelled) return
      setLoginLogs(authRes.items)
      setRecentOps(opsRes.items.filter((l) => l.module !== 'AUTH').slice(0, 5))
      setLoginFailCount(failRes.pagination.total)
      setLoading(false)
    }).catch(() => {
      if (!cancelled) setLoading(false)
    })

    return () => { cancelled = true }
  }, [])

  const lastLogin = loginLogs.find((l) => l.action === 'LOGIN' && l.result === 'success')
  const hasRecentFail = loginFailCount > 0

  return (
    <div className="space-y-5">
      <SurfacePanel className="overflow-hidden p-0">
        <div className="border-b border-black/10 px-6 py-5 dark:border-white/10">
          <div className="flex items-center gap-2 text-brand-700 dark:text-brand-300">
            <ShieldCheck className="h-5 w-5" />
            <h2 className="text-xl font-semibold text-slate-950 dark:text-white">安全状态</h2>
          </div>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">当前账号安全评估，如发现异常请及时修改密码或联系管理员。</p>
        </div>
        <div className="grid gap-0 divide-y divide-black/10 dark:divide-white/10 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <SecurityMetric
            icon={hasRecentFail ? <ShieldAlert className="h-5 w-5 text-amber-500" /> : <ShieldCheck className="h-5 w-5 text-emerald-500" />}
            label="登录失败次数"
            loading={loading}
            status={hasRecentFail ? 'warn' : 'ok'}
            value={loading ? '—' : String(loginFailCount)}
          />
          <SecurityMetric
            icon={<Clock className="h-5 w-5 text-brand-600 dark:text-brand-300" />}
            label="上次成功登录"
            loading={loading}
            status="info"
            value={loading ? '—' : (lastLogin ? formatRelativeTime(lastLogin.createdAt) : '无记录')}
          />
          <SecurityMetric
            icon={<Activity className="h-5 w-5 text-brand-600 dark:text-brand-300" />}
            label="最近操作数"
            loading={loading}
            status="info"
            value={loading ? '—' : String(recentOps.length)}
          />
        </div>
      </SurfacePanel>

      {hasRecentFail && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3.5 text-sm text-amber-700 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>检测到 <strong>{loginFailCount}</strong> 次登录失败。如果不是你本人操作，建议立即修改密码并检查账号安全。</span>
        </div>
      )}

      <SurfacePanel className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-black/10 px-6 py-4 dark:border-white/10">
          <p className="font-semibold text-slate-950 dark:text-white">最近登录</p>
          <button className="text-xs text-brand-600 hover:underline dark:text-brand-300" onClick={onViewLogin} type="button">
            查看全部
          </button>
        </div>
        <div className="divide-y divide-black/10 dark:divide-white/10">
          {loading ? (
            <LoadingRows count={3} />
          ) : loginLogs.length === 0 ? (
            <EmptyHint label="暂无登录记录" />
          ) : (
            loginLogs.map((log) => <LogRow key={log.id} log={log} compact />)
          )}
        </div>
      </SurfacePanel>

      <SurfacePanel className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-black/10 px-6 py-4 dark:border-white/10">
          <p className="font-semibold text-slate-950 dark:text-white">最近操作</p>
          <button className="text-xs text-brand-600 hover:underline dark:text-brand-300" onClick={onViewOps} type="button">
            查看全部
          </button>
        </div>
        <div className="divide-y divide-black/10 dark:divide-white/10">
          {loading ? (
            <LoadingRows count={3} />
          ) : recentOps.length === 0 ? (
            <EmptyHint label="暂无操作记录" />
          ) : (
            recentOps.map((log) => <LogRow key={log.id} log={log} compact />)
          )}
        </div>
      </SurfacePanel>
    </div>
  )
}

// ─── 登录记录 ──────────────────────────────────────────────────────────────────

function LoginHistory() {
  const [logs, setLogs] = useState<MyAuditLogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [resultFilter, setResultFilter] = useState('全部')

  const fetchLogs = useCallback(
    (p: number, result: string) => {
      setLoading(true)
      const q: MyAuditLogQuery = { module: 'AUTH', page: p, pageSize: 20 }
      if (result !== '全部') q.result = result
      getMyAuditLogs(q)
        .then((res) => {
          setLogs(res.items)
          setPage(res.pagination.page)
          setTotalPages(res.pagination.totalPages)
          setTotal(res.pagination.total)
        })
        .finally(() => setLoading(false))
    },
    [],
  )

  useEffect(() => { fetchLogs(1, resultFilter) }, [fetchLogs, resultFilter])

  return (
    <SurfacePanel className="overflow-hidden p-0">
      <div className="border-b border-black/10 px-6 py-5 dark:border-white/10">
        <div className="flex items-center gap-2 text-brand-700 dark:text-brand-300">
          <LogIn className="h-5 w-5" />
          <h2 className="text-xl font-semibold text-slate-950 dark:text-white">登录记录</h2>
        </div>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          当前账号的所有登录与登出操作记录，包含 IP 地址和设备信息。共 {total} 条。
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {RESULT_OPTIONS.map((opt) => (
            <button
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                resultFilter === opt
                  ? 'bg-brand-600 text-white'
                  : 'bg-black/5 text-slate-600 hover:bg-black/10 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/15'
              }`}
              key={opt}
              onClick={() => { setResultFilter(opt); setPage(1) }}
              type="button"
            >
              {RESULT_LABELS[opt] ?? opt}
            </button>
          ))}
          <button
            className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-500 transition hover:bg-black/5 dark:text-slate-400 dark:hover:bg-white/10"
            onClick={() => fetchLogs(page, resultFilter)}
            type="button"
          >
            <RefreshCcw className="h-3.5 w-3.5" /> 刷新
          </button>
        </div>
      </div>

      <div className="divide-y divide-black/10 dark:divide-white/10">
        {loading ? (
          <LoadingRows count={8} />
        ) : logs.length === 0 ? (
          <EmptyHint label="暂无登录记录" />
        ) : (
          logs.map((log) => <LogRow key={log.id} log={log} />)
        )}
      </div>

      {!loading && totalPages > 1 && (
        <Pagination
          onPageChange={(p) => { setPage(p); fetchLogs(p, resultFilter) }}
          page={page}
          totalPages={totalPages}
        />
      )}
    </SurfacePanel>
  )
}

// ─── 操作日志 ──────────────────────────────────────────────────────────────────

function OperationLogs() {
  const [logs, setLogs] = useState<MyAuditLogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [moduleFilter, setModuleFilter] = useState('全部')
  const [resultFilter, setResultFilter] = useState('全部')

  const fetchLogs = useCallback(
    (p: number, mod: string, result: string) => {
      setLoading(true)
      const q: MyAuditLogQuery = { page: p, pageSize: 20 }
      if (mod !== '全部') q.module = mod
      if (result !== '全部') q.result = result
      getMyAuditLogs(q)
        .then((res) => {
          setLogs(res.items)
          setPage(res.pagination.page)
          setTotalPages(res.pagination.totalPages)
          setTotal(res.pagination.total)
        })
        .finally(() => setLoading(false))
    },
    [],
  )

  useEffect(() => { fetchLogs(1, moduleFilter, resultFilter) }, [fetchLogs, moduleFilter, resultFilter])

  return (
    <SurfacePanel className="overflow-hidden p-0">
      <div className="border-b border-black/10 px-6 py-5 dark:border-white/10">
        <div className="flex items-center gap-2 text-brand-700 dark:text-brand-300">
          <Activity className="h-5 w-5" />
          <h2 className="text-xl font-semibold text-slate-950 dark:text-white">操作日志</h2>
        </div>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          当前账号的所有操作记录，包含漏洞提交、证书、积分商城等操作。共 {total} 条。
        </p>
        <div className="mt-4 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400">模块：</span>
            {MODULE_OPTIONS.map((opt) => (
              <button
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  moduleFilter === opt
                    ? 'bg-brand-600 text-white'
                    : 'bg-black/5 text-slate-600 hover:bg-black/10 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/15'
                }`}
                key={opt}
                onClick={() => { setModuleFilter(opt); setPage(1) }}
                type="button"
              >
                {MODULE_LABELS[opt] ?? opt}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400">结果：</span>
            {RESULT_OPTIONS.map((opt) => (
              <button
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  resultFilter === opt
                    ? 'bg-brand-600 text-white'
                    : 'bg-black/5 text-slate-600 hover:bg-black/10 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/15'
                }`}
                key={opt}
                onClick={() => { setResultFilter(opt); setPage(1) }}
                type="button"
              >
                {RESULT_LABELS[opt] ?? opt}
              </button>
            ))}
            <button
              className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-500 transition hover:bg-black/5 dark:text-slate-400 dark:hover:bg-white/10"
              onClick={() => fetchLogs(page, moduleFilter, resultFilter)}
              type="button"
            >
              <RefreshCcw className="h-3.5 w-3.5" /> 刷新
            </button>
          </div>
        </div>
      </div>

      <div className="divide-y divide-black/10 dark:divide-white/10">
        {loading ? (
          <LoadingRows count={8} />
        ) : logs.length === 0 ? (
          <EmptyHint label="暂无操作记录" />
        ) : (
          logs.map((log) => <LogRow key={log.id} log={log} />)
        )}
      </div>

      {!loading && totalPages > 1 && (
        <Pagination
          onPageChange={(p) => { setPage(p); fetchLogs(p, moduleFilter, resultFilter) }}
          page={page}
          totalPages={totalPages}
        />
      )}
    </SurfacePanel>
  )
}

// ─── 子组件 ────────────────────────────────────────────────────────────────────

function LogRow({ compact = false, log }: { compact?: boolean; log: MyAuditLogItem }) {
  const isLoginAction = log.action === 'LOGIN' || log.action === 'LOGOUT'
  const icon = isLoginAction
    ? log.action === 'LOGIN'
      ? <LogIn className="h-4 w-4 shrink-0" />
      : <LogOut className="h-4 w-4 shrink-0" />
    : <KeyRound className="h-4 w-4 shrink-0" />

  const statusColor = log.result === 'success'
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-red-600 dark:text-red-400'

  const ua = parseUA(log.userAgent)

  return (
    <div className="px-6 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 shrink-0 text-slate-400 dark:text-slate-500">{icon}</span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-slate-950 dark:text-white">{log.actionLabel}</span>
              <span className={`inline-flex items-center gap-1 text-xs font-medium ${statusColor}`}>
                {log.result === 'success'
                  ? <CheckCircle2 className="h-3.5 w-3.5" />
                  : <XCircle className="h-3.5 w-3.5" />
                }
                {log.resultLabel}
              </span>
              <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs text-slate-500 dark:bg-white/10 dark:text-slate-400">
                {log.moduleLabel}
              </span>
            </div>
            {log.summary && (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{log.summary}</p>
            )}
            {!compact && (
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 dark:text-slate-500">
                <span className="flex items-center gap-1">
                  <Globe className="h-3.5 w-3.5" /> {log.ipAddress || '—'}
                </span>
                <span className="flex items-center gap-1">
                  <Monitor className="h-3.5 w-3.5" /> {ua}
                </span>
                {log.requestPath && (
                  <span className="font-mono">{log.requestPath}</span>
                )}
              </div>
            )}
            {compact && (
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-400 dark:text-slate-500">
                <span className="flex items-center gap-1">
                  <Globe className="h-3 w-3" /> {log.ipAddress || '—'}
                </span>
                <span className="flex items-center gap-1">
                  <Monitor className="h-3 w-3" /> {ua}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <time className="block text-xs text-slate-400 dark:text-slate-500" dateTime={log.createdAt}>
            {formatDateTime(log.createdAt)}
          </time>
          <span className="mt-1 block text-xs text-slate-300 dark:text-slate-600">
            {formatRelativeTime(log.createdAt)}
          </span>
        </div>
      </div>
    </div>
  )
}

function SecurityMetric({
  icon,
  label,
  loading,
  status,
  value,
}: {
  icon: ReactNode
  label: string
  loading: boolean
  status: 'ok' | 'warn' | 'info'
  value: string
}) {
  const valueClass =
    status === 'warn'
      ? 'text-amber-600 dark:text-amber-400'
      : status === 'ok'
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-slate-950 dark:text-white'

  return (
    <div className="flex flex-col items-center px-6 py-5 text-center">
      <div className="mb-3">{icon}</div>
      {loading ? (
        <div className="h-7 w-12 animate-pulse rounded bg-black/10 dark:bg-white/10" />
      ) : (
        <p className={`text-2xl font-bold ${valueClass}`}>{value}</p>
      )}
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  )
}

function Pagination({
  onPageChange,
  page,
  totalPages,
}: {
  onPageChange: (page: number) => void
  page: number
  totalPages: number
}) {
  return (
    <div className="flex items-center justify-between border-t border-black/10 px-6 py-3 dark:border-white/10">
      <span className="text-xs text-slate-400 dark:text-slate-500">
        第 {page} / {totalPages} 页
      </span>
      <div className="flex items-center gap-2">
        <button
          className="flex h-7 w-7 items-center justify-center rounded-md border border-black/10 text-slate-600 transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          type="button"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          className="flex h-7 w-7 items-center justify-center rounded-md border border-black/10 text-slate-600 transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          type="button"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

function LoadingRows({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
        <div className="flex items-center gap-4 px-6 py-4" key={i}>
          <div className="h-4 w-4 animate-pulse rounded bg-black/10 dark:bg-white/10" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-1/3 animate-pulse rounded bg-black/10 dark:bg-white/10" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-black/10 dark:bg-white/10" />
          </div>
          <div className="h-3 w-16 animate-pulse rounded bg-black/10 dark:bg-white/10" />
        </div>
      ))}
    </>
  )
}

function EmptyHint({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-slate-400 dark:text-slate-500">
      <Search className="h-8 w-8 opacity-40" />
      <p className="text-sm">{label}</p>
    </div>
  )
}

// ─── 工具函数 ──────────────────────────────────────────────────────────────────

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function formatRelativeTime(iso: string) {
  try {
    const diff = Date.now() - new Date(iso).getTime()
    const minutes = Math.floor(diff / 60_000)
    if (minutes < 1) return '刚刚'
    if (minutes < 60) return `${minutes} 分钟前`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours} 小时前`
    const days = Math.floor(hours / 24)
    if (days < 30) return `${days} 天前`
    return `${Math.floor(days / 30)} 个月前`
  } catch {
    return ''
  }
}

function parseUA(ua: string | undefined | null) {
  if (!ua) return '未知设备'
  if (/mobile/i.test(ua)) {
    if (/iphone|ipad/i.test(ua)) return 'iOS 设备'
    if (/android/i.test(ua)) return 'Android 设备'
    return '移动设备'
  }
  if (/windows/i.test(ua)) return 'Windows'
  if (/mac os/i.test(ua)) return 'macOS'
  if (/linux/i.test(ua)) return 'Linux'
  return '桌面设备'
}
