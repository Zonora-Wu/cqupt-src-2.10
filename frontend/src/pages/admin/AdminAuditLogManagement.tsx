import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  FileSpreadsheet,
  Filter,
  KeyRound,
  MonitorCog,
  RefreshCw,
  SearchCheck,
  ShieldAlert,
  ShieldCheck,
  UserCog,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { AlertMessage } from '../../components/ui/AlertMessage'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { PaginationBar } from '../../components/ui/PaginationBar'
import { SearchInput } from '../../components/ui/SearchInput'
import { SelectInput } from '../../components/ui/SelectInput'
import { SurfacePanel } from '../../components/ui/SurfacePanel'
import { getAuditLogDetail, getAuditLogStats, listAuditLogs } from '../../services/auditLogs'
import type { AuditLogDetail, AuditLogItem, AuditRiskLevel, AuditLogStats } from '../../services/auditLogs'
import { platformNotice } from '../../services/platformNotice'

const moduleOptions = ['全部模块', '认证登录', '漏洞管理', '敏感附件', '证书管理', '公告管理', '学习管理', '积分商城', '用户管理', '系统设置', 'AI 调用']
const levelOptions = ['全部等级', '普通', '重要', '高风险']
const resultOptions = ['全部结果', '成功', '失败', '已拦截']
const defaultPageSize = 20
const exportBatchSize = 100
type AuditSortKey = 'actor' | 'createdAt' | 'module' | 'result' | 'riskLevel' | 'summary' | 'source'
type SortDirection = 'asc' | 'desc'
const defaultSort: { direction: SortDirection; key: AuditSortKey } = { direction: 'desc', key: 'createdAt' }

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
  const [pageSize, setPageSize] = useState(defaultPageSize)
  const [logs, setLogs] = useState<AuditLogItem[]>([])
  const [stats, setStats] = useState<AuditLogStats | null>(null)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedLog, setSelectedLog] = useState<AuditLogDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)
  const [refreshNonce, setRefreshNonce] = useState(0)
  const [sortKey, setSortKey] = useState<AuditSortKey | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaultSort.direction)

  const query = useMemo(
    () => ({
      keyword: keyword.trim() || undefined,
      module,
      page,
      pageSize,
      result,
      riskLevel: level,
    }),
    [keyword, level, module, page, pageSize, result],
  )

  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (active) setPage(1)
    })
    return () => {
      active = false
    }
  }, [keyword, level, module, pageSize, result])

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
  }, [query, refreshNonce])

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

  async function exportFilteredLogs() {
    setError('')
    setExporting(true)
    try {
      const firstResponse = await listAuditLogs({
        keyword: query.keyword,
        module: query.module,
        page: 1,
        pageSize: exportBatchSize,
        result: query.result,
        riskLevel: query.riskLevel,
      })
      const exportItems = [...firstResponse.items]
      for (let nextPage = 2; nextPage <= firstResponse.pagination.totalPages; nextPage += 1) {
        const response = await listAuditLogs({
          keyword: query.keyword,
          module: query.module,
          page: nextPage,
          pageSize: exportBatchSize,
          result: query.result,
          riskLevel: query.riskLevel,
        })
        exportItems.push(...response.items)
      }
      downloadAuditCsv(exportItems)
      platformNotice.success(`已导出 ${exportItems.length} 条审计日志。`, {
        title: '审计日志导出成功',
      })
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : '审计日志导出失败')
    } finally {
      setExporting(false)
    }
  }

  const currentFilterLabels = [
    keyword.trim() ? `关键词：${keyword.trim()}` : '',
    module !== '全部模块' ? `模块：${module}` : '',
    level !== '全部等级' ? `等级：${level}` : '',
    result !== '全部结果' ? `结果：${result}` : '',
  ].filter(Boolean)
  const resultDistribution = resultOptions
    .filter((item) => item !== '全部结果')
    .map((label) => ({
      count: stats?.resultGroups.find((group) => group.result === label || group.result === resultLabelToCode(label))?.count ?? logs.filter((item) => item.resultLabel === label).length,
      label,
    }))
  const moduleDistribution = moduleOptions
    .filter((item) => item !== '全部模块')
    .map((label) => ({
      count: logs.filter((item) => item.moduleLabel === label).length,
      label,
    }))
    .filter((item) => item.count > 0)
    .slice(0, 5)
  const sortedLogs = useMemo(
    () => [...logs].sort((a, b) => compareAuditLogs(a, b, sortKey ?? defaultSort.key, sortKey ? sortDirection : defaultSort.direction)),
    [logs, sortDirection, sortKey],
  )

  function changeSort(nextKey: AuditSortKey) {
    if (sortKey !== nextKey) {
      setSortKey(nextKey)
      setSortDirection('asc')
    } else if (sortDirection === 'asc') {
      setSortDirection('desc')
    } else {
      setSortKey(null)
      setSortDirection(defaultSort.direction)
    }
  }

  if (selectedId) {
    const log = selectedLog
    const Icon = log ? moduleIcons[log.module] ?? Activity : Activity

    return (
      <section className="relative z-10 mx-auto max-w-[1360px] px-4 pb-8 pt-32 sm:px-5 md:px-8 md:pt-24">
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
    <section className="relative z-10 mx-auto max-w-[1360px] px-4 pb-8 pt-32 sm:px-5 md:px-8 md:pt-24">
      <PageHeader
        title="审计日志"
        description="追踪关键操作、来源环境、风险等级和执行结果，支持按筛选条件导出表格。"
      />

      <SurfacePanel className="relative z-30 mt-6 p-5">
        <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_380px]">
          <div>
            <div className="grid gap-4 xl:grid-cols-[minmax(320px,1fr)_160px_140px_140px] xl:items-end">
              <SearchInput
                label="搜索日志"
                onChange={setKeyword}
                placeholder="操作、操作人、统一认证码、目标、IP 或路径"
                value={keyword}
              />
              <SelectInput label="业务模块" onChange={setModule} options={moduleOptions} value={module} />
              <SelectInput label="风险等级" onChange={setLevel} options={levelOptions} value={level} />
              <SelectInput label="执行结果" onChange={setResult} options={resultOptions} value={result} />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-black/10 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
                onClick={resetFilters}
                type="button"
              >
                <Filter className="h-4 w-4" />
                重置
              </button>
              <button
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-brand-600/20 bg-brand-600/10 px-4 py-3 text-sm font-semibold text-brand-800 transition hover:bg-brand-600/15 disabled:cursor-not-allowed disabled:opacity-60 dark:text-brand-200"
                disabled={loading}
                onClick={() => setRefreshNonce((current) => current + 1)}
                type="button"
              >
                <RefreshCw className="h-4 w-4" />
                刷新
              </button>
              <button
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={exporting || loading}
                onClick={() => void exportFilteredLogs()}
                type="button"
              >
                <Download className="h-4 w-4" />
                {exporting ? '导出中...' : '导出表格'}
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-black/10 pt-4 text-xs dark:border-white/10">
              <span className="rounded-md border border-brand-600/20 bg-brand-600/10 px-2.5 py-1 font-medium text-brand-800 dark:text-brand-200">
                当前结果 {total}
              </span>
              <span className="rounded-md border border-red-500/20 bg-red-500/10 px-2.5 py-1 font-medium text-red-700 dark:text-red-300">
                高风险 {stats?.highRisk ?? 0}
              </span>
              <span className="rounded-md border border-slate-500/20 bg-slate-500/10 px-2.5 py-1 font-medium text-slate-700 dark:text-slate-300">
                今日新增 {stats?.today ?? 0}
              </span>
              {currentFilterLabels.length > 0 ? (
                currentFilterLabels.map((item) => (
                  <span className="rounded-md border border-black/10 bg-[var(--app-panel-muted-bg)] px-2.5 py-1 text-slate-600 dark:border-white/10 dark:text-slate-300" key={item}>
                    {item}
                  </span>
                ))
              ) : (
                <span className="text-slate-500 dark:text-slate-400">当前展示全部审计日志</span>
              )}
            </div>
          </div>

          <div className="border-t border-black/10 pt-4 dark:border-white/10 2xl:border-l 2xl:border-t-0 2xl:pl-5 2xl:pt-0">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">结果分布</h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">按当前筛选统计</p>
              </div>
              <FileSpreadsheet className="h-5 w-5 text-brand-700 dark:text-brand-300" />
            </div>
            <div className="mt-4 space-y-3">
              {resultDistribution.map((item) => (
                <DistributionRow count={item.count} key={item.label} label={item.label} total={Math.max(total, 1)} />
              ))}
            </div>
          </div>
        </div>
      </SurfacePanel>

      {error && <AlertMessage className="mt-5" message={error} onClose={() => setError('')} variant="error" />}

      <SurfacePanel className="mt-5 overflow-hidden p-0">
        <div className="flex items-center justify-between gap-4 border-b border-black/10 px-4 py-3 dark:border-white/10">
          <div>
            <h2 className="text-sm font-semibold">审计日志台账</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">共 {total} 条，默认按时间倒序展示，可按当前筛选导出 CSV</p>
          </div>
          <div className="hidden flex-wrap justify-end gap-2 lg:flex">
            {moduleDistribution.map((item) => (
              <span className="rounded-md bg-[var(--app-panel-muted-bg)] px-2.5 py-1 text-xs text-slate-500 dark:text-slate-400" key={item.label}>
                {item.label} {item.count}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-[156px_minmax(0,1fr)_72px] gap-4 border-b border-black/10 bg-brand-600/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-brand-900 dark:border-white/10 dark:text-brand-200 xl:grid-cols-[168px_minmax(0,1fr)_116px_132px_156px_90px]">
          <SortHeaderButton active={(sortKey ?? defaultSort.key) === 'createdAt'} direction={sortKey ? sortDirection : defaultSort.direction} label="时间" onClick={() => changeSort('createdAt')} />
          <SortHeaderButton active={(sortKey ?? defaultSort.key) === 'summary'} direction={sortKey ? sortDirection : defaultSort.direction} label="事件 / 编号" onClick={() => changeSort('summary')} />
          <SortHeaderButton active={(sortKey ?? defaultSort.key) === 'module'} className="hidden xl:inline-flex" direction={sortKey ? sortDirection : defaultSort.direction} label="模块" onClick={() => changeSort('module')} />
          <SortHeaderButton active={(sortKey ?? defaultSort.key) === 'actor'} className="hidden xl:inline-flex" direction={sortKey ? sortDirection : defaultSort.direction} label="操作人" onClick={() => changeSort('actor')} />
          <SortHeaderButton active={(sortKey ?? defaultSort.key) === 'source'} className="hidden xl:inline-flex" direction={sortKey ? sortDirection : defaultSort.direction} label="来源" onClick={() => changeSort('source')} />
          <span className="text-right">操作</span>
        </div>

        {loading ? (
          <div className="p-8 text-sm text-slate-500 dark:text-slate-400">正在加载审计日志...</div>
        ) : sortedLogs.length > 0 ? (
          <div className="divide-y divide-black/10 dark:divide-white/10">
            {sortedLogs.map((item) => {
              return (
                <div
                  className="grid grid-cols-[156px_minmax(0,1fr)_72px] gap-4 px-3 py-3 text-sm transition hover:bg-brand-600/[0.055] xl:grid-cols-[168px_minmax(0,1fr)_116px_132px_156px_90px] xl:items-center dark:hover:bg-brand-300/[0.06]"
                  key={item.id}
                >
                  <div className="text-xs text-slate-500 dark:text-slate-400">
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
                  <div className="hidden items-center gap-2 text-slate-600 xl:flex dark:text-slate-300">
                    {item.moduleLabel}
                  </div>
                  <div className="hidden xl:block">
                    <p>{item.actor?.name ?? '系统'}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.actor?.roleLabel ?? '未认证'}</p>
                  </div>
                  <div className="hidden text-xs text-slate-500 xl:block dark:text-slate-400">
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

        <PaginationBar
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          page={Math.min(page, totalPages)}
          pageSize={pageSize}
          total={total}
        />
      </SurfacePanel>
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

function SortHeaderButton({
  active,
  className = '',
  direction,
  label,
  onClick,
}: {
  active: boolean
  className?: string
  direction: SortDirection
  label: string
  onClick: () => void
}) {
  const Icon = active ? direction === 'asc' ? ChevronUp : ChevronDown : ArrowUpDown
  return (
    <button
      className={`group -ml-1 inline-flex min-w-0 items-center gap-1 rounded-md px-1.5 py-1 text-left transition hover:bg-black/5 hover:text-brand-950 dark:hover:bg-white/10 dark:hover:text-white ${className}`}
      onClick={onClick}
      title={`按${label}排序`}
      type="button"
    >
      <span className="truncate">{label}</span>
      <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-brand-700 dark:text-brand-300' : 'opacity-45 group-hover:opacity-80'}`} />
    </button>
  )
}

function compareAuditLogs(a: AuditLogItem, b: AuditLogItem, key: AuditSortKey, direction: SortDirection) {
  const modifier = direction === 'asc' ? 1 : -1
  const result = compareAuditValue(a, b, key)
  if (result !== 0) return result * modifier
  return compareTimeValue(b.createdAt, a.createdAt) || compareTextValue(a.id, b.id)
}

function compareAuditValue(a: AuditLogItem, b: AuditLogItem, key: AuditSortKey) {
  switch (key) {
    case 'actor':
      return compareTextValue(a.actor?.name ?? '', b.actor?.name ?? '') || compareTextValue(a.actor?.unifiedCode ?? '', b.actor?.unifiedCode ?? '')
    case 'createdAt':
      return compareTimeValue(a.createdAt, b.createdAt)
    case 'module':
      return compareTextValue(a.moduleLabel, b.moduleLabel)
    case 'result':
      return compareTextValue(a.resultLabel, b.resultLabel)
    case 'riskLevel':
      return getRiskRank(a.riskLevel) - getRiskRank(b.riskLevel)
    case 'summary':
      return compareTextValue(a.actionLabel, b.actionLabel) || compareTextValue(a.summary, b.summary)
    case 'source':
      return compareTextValue(a.ipAddress || '', b.ipAddress || '') || compareTextValue(a.requestPath || '', b.requestPath || '')
  }
}

function getRiskRank(level: AuditRiskLevel) {
  if (level === 'HIGH') return 3
  if (level === 'MEDIUM') return 2
  return 1
}

function compareTextValue(a: string, b: string) {
  if (!a && !b) return 0
  if (!a) return 1
  if (!b) return -1
  return a.localeCompare(b, 'zh-Hans-CN', { numeric: true, sensitivity: 'base' })
}

function compareTimeValue(a: string | null | undefined, b: string | null | undefined) {
  const left = a ? new Date(a).getTime() : Number.NaN
  const right = b ? new Date(b).getTime() : Number.NaN
  const leftValid = Number.isFinite(left)
  const rightValid = Number.isFinite(right)
  if (!leftValid && !rightValid) return 0
  if (!leftValid) return 1
  if (!rightValid) return -1
  return left - right
}

function DistributionRow({ count, label, total }: { count: number; label: string; total: number }) {
  const width = count === 0 ? 0 : Math.max(3, Math.round((count / total) * 100))
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-slate-600 dark:text-slate-300">{label}</span>
        <span className="font-mono text-slate-500 dark:text-slate-400">{count}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--app-panel-muted-bg)]">
        <div className="h-full rounded-full bg-brand-600" style={{ width: `${width}%` }} />
      </div>
    </div>
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

function resultLabelToCode(label: string) {
  if (label === '成功') return 'SUCCESS'
  if (label === '失败') return 'FAILED'
  if (label === '已拦截') return 'BLOCKED'
  return label
}

function downloadAuditCsv(items: AuditLogItem[]) {
  const headers = ['时间', '事件', '摘要', '模块', '风险等级', '执行结果', '操作人', '角色', '统一认证码', '来源 IP', '请求路径', '目标类型', '目标 ID', '目标', '日志 ID']
  const rows = items.map((item) => [
    formatDateTime(item.createdAt),
    item.actionLabel,
    item.summary,
    item.moduleLabel,
    item.riskLabel,
    item.resultLabel,
    item.actor?.name ?? '系统',
    item.actor?.roleLabel ?? '未认证',
    item.actor?.unifiedCode ?? '',
    item.ipAddress || '',
    item.requestPath || '',
    item.targetType || '',
    item.targetId || '',
    item.targetLabel || '',
    item.id,
  ])
  const csv = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(',')).join('\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function escapeCsvCell(value: string | number) {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}
