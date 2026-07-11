import {
  ArrowUpDown,
  Award,
  Ban,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  FileCheck2,
  Filter,
  Medal,
  RefreshCw,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { CopyableCode } from '../../components/ui/CopyableCode'
import { AlertMessage } from '../../components/ui/AlertMessage'
import { PageHeader } from '../../components/ui/PageHeader'
import { PaginationBar } from '../../components/ui/PaginationBar'
import { SearchInput } from '../../components/ui/SearchInput'
import { SelectInput } from '../../components/ui/SelectInput'
import { SurfacePanel } from '../../components/ui/SurfacePanel'
import {
  listManagedCertificates,
  openCertificatePreview,
  revokeCertificate,
} from '../../services/certificates'
import type { ManagedCertificateItem, SeverityLabel } from '../../services/certificates'

type CertificateStatus = '待签发' | '已签发' | '已撤销'
type NoticeState = { text: string; variant: 'error' | 'info' | 'success' | 'warning' }

const statusOptions = ['全部状态', '待签发', '已签发', '已撤销']
const levelOptions = ['全部等级', '严重', '高危', '中危', '低危', '信息']
const defaultPageSize = 10
type CertificateSortKey = 'issueDate' | 'issuer' | 'publicVerify' | 'recipient' | 'status' | 'type'
type SortDirection = 'asc' | 'desc'

const defaultSort: { direction: SortDirection; key: CertificateSortKey } = {
  direction: 'desc',
  key: 'issueDate',
}

const certificateSortColumns: Array<{ className?: string; key: CertificateSortKey; label: string }> = [
  { key: 'status', label: '漏洞状态' },
  { key: 'type', label: '证书类型 / 关联漏洞' },
  { className: 'hidden xl:flex', key: 'recipient', label: '获得者' },
  { className: 'hidden xl:flex', key: 'issueDate', label: '签发时间' },
  { className: 'hidden xl:flex', key: 'issuer', label: '签发人' },
  { className: 'hidden xl:flex', key: 'publicVerify', label: '公开核验' },
]

const certificateStatusRank: Record<CertificateStatus, number> = {
  待签发: 1,
  已签发: 2,
  已撤销: 0,
}

const levelClassMap: Record<SeverityLabel, string> = {
  严重: 'bg-red-600 text-white',
  高危: 'bg-orange-500 text-white',
  中危: 'bg-amber-500 text-white',
  低危: 'bg-slate-500 text-white',
  信息: 'bg-blue-500 text-white',
}

const statusClassMap: Record<CertificateStatus, string> = {
  待签发: 'border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  已签发: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  已撤销: 'border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300',
}

function LevelBadge({ level }: { level: SeverityLabel | null }) {
  if (!level) {
    return <span className="rounded-md bg-slate-500 px-2 py-1 text-xs font-medium text-white">未定级</span>
  }

  return <span className={`rounded-md px-2 py-1 text-xs font-medium ${levelClassMap[level]}`}>{level}</span>
}

function CertificateStatusBadge({ status }: { status: CertificateStatus }) {
  return <span className={`rounded-md border px-2 py-1 text-xs font-medium ${statusClassMap[status]}`}>{status}</span>
}

function LedgerCell({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">{label}</p>
      <p className={`mt-1 truncate text-sm ${strong ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>
        {value || '—'}
      </p>
    </div>
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
      className={`group -ml-1 inline-flex min-w-0 items-center gap-1 rounded-md px-1.5 py-1 text-left transition hover:bg-black/5 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-200 ${className}`}
      onClick={onClick}
      title={`按${label}排序`}
      type="button"
    >
      <span className="truncate">{label}</span>
      <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-brand-700 dark:text-brand-300' : 'opacity-45 group-hover:opacity-80'}`} />
    </button>
  )
}

export function AdminCertificateManagement() {
  const [items, setItems] = useState<ManagedCertificateItem[]>([])
  const [stats, setStats] = useState({ total: 0, pending: 0, issued: 0, revoked: 0 })
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('全部状态')
  const [level, setLevel] = useState('全部等级')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(defaultPageSize)
  const [sortKey, setSortKey] = useState<CertificateSortKey>(defaultSort.key)
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaultSort.direction)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState<NoticeState | null>(null)

  async function loadCertificates() {
    setError('')
    setLoading(true)
    try {
      const response = await listManagedCertificates()
      setItems(response.items)
      setStats(response.stats)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '证书列表加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (active) void loadCertificates()
    })
    return () => {
      active = false
    }
  }, [])

  const filteredCertificates = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()

    return items.filter((item) => {
      const matchesKeyword =
        !normalizedKeyword ||
        item.id.toLowerCase().includes(normalizedKeyword) ||
        item.vulnId.toLowerCase().includes(normalizedKeyword) ||
        item.vulnTitle.toLowerCase().includes(normalizedKeyword) ||
        item.recipient.toLowerCase().includes(normalizedKeyword) ||
        item.verifyCode.toLowerCase().includes(normalizedKeyword)
      const matchesStatus = status === '全部状态' || item.status === status
      const matchesLevel = level === '全部等级' || item.level === level

      return matchesKeyword && matchesStatus && matchesLevel
    })
  }, [items, keyword, level, status])

  const sortedCertificates = useMemo(() => {
    return [...filteredCertificates].sort((a, b) => compareCertificateItems(a, b, sortKey, sortDirection))
  }, [filteredCertificates, sortDirection, sortKey])

  const changeSort = (nextKey: CertificateSortKey) => {
    setSortKey((currentKey) => {
      if (currentKey !== nextKey) {
        setSortDirection(getDefaultSortDirection(nextKey))
        return nextKey
      }
      setSortDirection((currentDirection) => currentDirection === 'asc' ? 'desc' : 'asc')
      return currentKey
    })
    setPage(1)
  }

  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (active) setPage(1)
    })
    return () => {
      active = false
    }
  }, [keyword, status, level, pageSize])

  const totalPages = Math.max(1, Math.ceil(sortedCertificates.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paginatedCertificates = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return sortedCertificates.slice(start, start + pageSize)
  }, [pageSize, safePage, sortedCertificates])

  const selectedCertificate = selectedId ? items.find((item) => item.id === selectedId) ?? null : null

  async function previewPdf(certificate: ManagedCertificateItem) {
    if (!certificate.certificateId) {
      setNotice({ text: '请先签发证书，再预览 PDF。', variant: 'warning' })
      return
    }

    setNotice(null)
    try {
      await openCertificatePreview(certificate.certificateId)
    } catch (previewError) {
      setNotice({ text: previewError instanceof Error ? previewError.message : '证书 PDF 预览失败', variant: 'error' })
    }
  }

  async function handleRevoke(certificate: ManagedCertificateItem) {
    if (!certificate.certificateId || certificate.status !== '已签发') {
      setNotice({ text: '只有已签发证书可以撤销。', variant: 'warning' })
      return
    }

    const reason = window.prompt('请输入撤销原因')
    if (!reason?.trim()) return
    if (!window.confirm('确认撤销该证书？撤销后公开核验将不可用。')) return

    setNotice(null)
    try {
      await revokeCertificate(certificate.certificateId, reason.trim())
      setNotice({ text: '证书已撤销。', variant: 'success' })
      await loadCertificates()
    } catch (revokeError) {
      setNotice({ text: revokeError instanceof Error ? revokeError.message : '证书撤销失败', variant: 'error' })
    }
  }

  if (selectedCertificate) {
    return (
      <section className="relative z-10 mx-auto max-w-[1540px] px-5 pb-8 pt-24 md:px-8">
        <button
          className="inline-flex items-center gap-2 rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
          onClick={() => setSelectedId(null)}
          type="button"
        >
          <FileCheck2 className="h-4 w-4" />
          返回证书列表
        </button>

        {notice && (
          <AlertMessage
            message={notice.text}
            onClose={() => setNotice(null)}
            variant={notice.variant}
          />
        )}

        <div className="mt-5 grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-6 xl:sticky xl:top-24 xl:self-start">
            <SurfacePanel className="p-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{selectedCertificate.vulnId}</span>
                <LevelBadge level={selectedCertificate.level} />
                <CertificateStatusBadge status={selectedCertificate.status} />
              </div>
              <h1 className="mt-0 text-2xl font-semibold leading-snug">{selectedCertificate.type}</h1>
              <div className="mt-5 space-y-3 text-sm text-slate-600 dark:text-slate-400">
                <p>获得者：{selectedCertificate.recipient}</p>
                <p>统一认证码：{selectedCertificate.unifiedCode}</p>
                <p>关联漏洞：{selectedCertificate.vulnId}</p>
                <p>签发时间：{formatDate(selectedCertificate.issueDate)}</p>
                <p>签发人：{selectedCertificate.issuer ?? '未签发'}</p>
                <p>公开核验：{selectedCertificate.publicVerify ? '已开启' : '未开启'}</p>
              </div>
            </SurfacePanel>

            <SurfacePanel className="p-4">
              <div className="grid gap-2">
                <button
                  className="rounded-lg border border-black/10 px-4 py-3 text-sm font-medium transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:hover:bg-white/10"
                  disabled={!selectedCertificate.certificateId}
                  onClick={() => void previewPdf(selectedCertificate)}
                  type="button"
                >
                  预览 PDF
                </button>
                <button
                  className="rounded-lg border border-red-500/20 px-4 py-3 text-sm font-medium text-red-700 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-300"
                  disabled={selectedCertificate.status !== '已签发'}
                  onClick={() => void handleRevoke(selectedCertificate)}
                  type="button"
                >
                  撤销证书
                </button>
              </div>
            </SurfacePanel>
          </div>

          <div className="space-y-6">
            <SurfacePanel className="p-6">
              <h2 className="text-xl font-semibold">关联漏洞信息</h2>
              <div className="mt-5 grid gap-3 text-sm text-slate-600 md:grid-cols-2 dark:text-slate-400">
                <p>漏洞编号：{selectedCertificate.vulnId}</p>
                <p>漏洞等级：{selectedCertificate.level ?? '未定级'}</p>
                <p>影响资产：{selectedCertificate.asset}</p>
                <p>责任单位：{selectedCertificate.owner ?? '未填写'}</p>
                <p className="md:col-span-2">漏洞标题：{selectedCertificate.vulnTitle}</p>
                <p>确认时间：{formatDate(selectedCertificate.archivedAt)}</p>
                <p>核验码：{selectedCertificate.verifyCode}</p>
              </div>
            </SurfacePanel>

            <SurfacePanel className="p-6">
              <h2 className="text-xl font-semibold">证书内容</h2>
              <div className="mt-5 rounded-lg border border-black/10 bg-[var(--app-panel-muted-bg)] p-5 dark:border-white/10 ">
                <p className="text-sm leading-7 text-slate-600 dark:text-slate-400">{selectedCertificate.contribution}</p>
              </div>
            </SurfacePanel>

            <SurfacePanel className="p-6">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-brand-700 dark:text-brand-300" />
                <h2 className="text-xl font-semibold">操作记录</h2>
              </div>
              <div className="mt-5 space-y-4">
                {selectedCertificate.records.map((record) => (
                  <div className="border-l border-brand-600/30 pl-4" key={`${record.action}-${record.time}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">{record.action}</p>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{formatDate(record.time)}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{record.actor}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{record.note ?? '无补充说明'}</p>
                  </div>
                ))}
              </div>
            </SurfacePanel>
          </div>
        </div>

      </section>
    )
  }

  return (
    <>
      <section className="relative z-10 mx-auto max-w-[1360px] px-5 pb-8 pt-24 md:px-8">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <PageHeader
            eyebrowIcon={<Medal className="h-3.5 w-3.5" />}
            title="证书管理"
            description="管理漏洞贡献证书的签发、PDF 预览、撤销与公开核验。证书模板在系统设置中统一维护。"
          />
          <button
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-black/10 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
            onClick={() => void loadCertificates()}
            type="button"
          >
            <RefreshCw className="h-4 w-4" />
            刷新
          </button>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-4">
          {[
            { label: '证书总数', value: stats.total, hint: '全部证书队列', icon: Medal },
            { label: '待签发', value: stats.pending, hint: '可生成正式证书', icon: Award },
            { label: '已签发', value: stats.issued, hint: '可公开核验', icon: CheckCircle2 },
            { label: '已撤销', value: stats.revoked, hint: '核验不可用', icon: Ban },
          ].map((item) => {
            const Icon = item.icon
            return (
              <SurfacePanel className="p-4" key={item.label}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-brand-700 dark:text-brand-300" />
                    <p className="text-sm font-medium">{item.label}</p>
                  </div>
                  <span className="text-2xl font-semibold">{item.value}</span>
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{item.hint}</p>
              </SurfacePanel>
            )
          })}
        </div>

        <SurfacePanel className="relative z-30 mt-6 p-5">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_170px_160px_auto] xl:items-end">
            <SearchInput
              label="搜索证书"
              onChange={setKeyword}
              placeholder="漏洞编号、标题、获得者或核验码"
              value={keyword}
            />
            <SelectInput label="证书状态" onChange={setStatus} options={statusOptions} value={status} />
            <SelectInput label="漏洞等级" onChange={setLevel} options={levelOptions} value={level} />
            <button
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-black/10 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
              onClick={() => {
                setKeyword('')
                setStatus('全部状态')
                setLevel('全部等级')
              }}
              type="button"
            >
              <Filter className="h-4 w-4" />
              重置
            </button>
          </div>
        </SurfacePanel>

        {notice && (
          <AlertMessage
            message={notice.text}
            onClose={() => setNotice(null)}
            variant={notice.variant}
          />
        )}

        {error && (
          <AlertMessage message={error} onClose={() => setError('')} variant="error" />
        )}

        <SurfacePanel className="mt-6 overflow-hidden p-0">
          <div className="flex items-center justify-between gap-4 border-b border-black/10 px-4 py-3 dark:border-white/10">
            <div>
              <h2 className="text-sm font-semibold">证书台账</h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">共 {filteredCertificates.length} 条，按当前筛选条件展示</p>
            </div>
            <span className="rounded-md bg-[var(--app-panel-muted-bg)] px-2.5 py-1 text-xs text-slate-500 dark:text-slate-400">
              紧凑列表
            </span>
          </div>

          <div className="grid grid-cols-[204px_minmax(0,1fr)_88px] gap-4 border-b border-black/10 bg-[var(--app-panel-muted-bg)] px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:border-white/10 dark:text-slate-500 xl:grid-cols-[204px_minmax(0,1fr)_112px_112px_112px_112px_88px] 2xl:grid-cols-[204px_minmax(0,1fr)_136px_112px_112px_112px_112px_112px_88px]">
            {certificateSortColumns.map((column) => (
              <SortHeaderButton
                active={sortKey === column.key}
                className={column.className}
                direction={sortDirection}
                key={column.key}
                label={column.label}
                onClick={() => changeSort(column.key)}
              />
            ))}
            <span className="hidden 2xl:block">责任单位</span>
            <span className="hidden 2xl:block">核验码</span>
            <span className="text-right">操作</span>
          </div>

          {loading && (
            <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">正在加载证书管理数据...</div>
          )}

          {!loading &&
            paginatedCertificates.map((item) => (
              <div
                className="grid grid-cols-[204px_minmax(0,1fr)_88px] gap-4 border-b border-black/10 px-3 py-2.5 transition last:border-b-0 hover:bg-black/[0.025] dark:border-white/10 dark:hover:bg-white/[0.045] xl:grid-cols-[204px_minmax(0,1fr)_112px_112px_112px_112px_88px] 2xl:grid-cols-[204px_minmax(0,1fr)_136px_112px_112px_112px_112px_112px_88px]"
                key={item.id}
              >
                <div className="min-w-0">
                  <CopyableCode value={item.vulnId} />
                  <div className="mt-2 flex items-center gap-1.5">
                      <LevelBadge level={item.level} />
                      <CertificateStatusBadge status={item.status} />
                    </div>
                  </div>

                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">{item.type}</p>
                  <div className="mt-1.5 flex min-w-0 items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="truncate">{item.vulnTitle}</span>
                    <span className="shrink-0 rounded-md border border-black/10 px-1.5 py-0.5 dark:border-white/10">
                      {item.publicVerify ? '可核验' : '未公开'}
                    </span>
                  </div>
                </div>

                <div className="hidden min-w-0 xl:block">
                  <LedgerCell label="获得者" value={`${item.recipient} ${item.unifiedCode}`} strong />
                </div>
                <div className="hidden min-w-0 xl:block">
                  <LedgerCell label="签发" value={formatCompactDate(item.issueDate)} />
                </div>
                <div className="hidden min-w-0 xl:block">
                  <LedgerCell label="签发人" value={item.issuer ?? '未签发'} />
                </div>
                <div className="hidden min-w-0 xl:block">
                  <LedgerCell label="核验" value={item.publicVerify ? '已开启' : '未开启'} />
                </div>
                <div className="hidden min-w-0 2xl:block">
                  <LedgerCell label="单位" value={item.owner ?? '未填写'} />
                </div>
                <div className="hidden min-w-0 2xl:block">
                  <LedgerCell label="核验码" value={item.verifyCode} />
                </div>

                <div className="flex items-center justify-end gap-1.5">
                    <button
                      aria-label="查看详情"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-black/10 text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
                      onClick={() => setSelectedId(item.id)}
                      title="查看详情"
                      type="button"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    {item.certificateId && (
                      <button
                        aria-label="预览 PDF"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-black/10 text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
                        onClick={() => void previewPdf(item)}
                        title="预览 PDF"
                        type="button"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    )}
                    {item.status === '已签发' && (
                      <button
                        aria-label="撤销证书"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-500/20 text-red-700 transition hover:bg-red-500/10 dark:text-red-300"
                        onClick={() => void handleRevoke(item)}
                        title="撤销证书"
                        type="button"
                      >
                        <Ban className="h-4 w-4" />
                      </button>
                    )}
                  </div>
              </div>
            ))}

          {!loading && filteredCertificates.length === 0 && (
            <div className="p-10 text-center">
              <Award className="mx-auto h-10 w-10 text-slate-400" />
              <h2 className="mt-4 text-xl font-semibold">没有匹配的证书记录</h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">已确认并定级的漏洞会进入证书管理队列。</p>
            </div>
          )}

          {!loading && filteredCertificates.length > 0 && (
            <PaginationBar
              onPageChange={setPage}
              onPageSizeChange={(nextPageSize) => {
                setPageSize(nextPageSize)
                setPage(1)
              }}
              page={safePage}
              pageSize={pageSize}
              total={filteredCertificates.length}
            />
          )}
        </SurfacePanel>
      </section>

    </>
  )
}

function formatDate(value: string | null) {
  if (!value) return '未签发'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleString('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatCompactDate(value: string | null) {
  if (!value) return '未签发'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function getDefaultSortDirection(key: CertificateSortKey): SortDirection {
  return key === 'issueDate' || key === 'publicVerify' || key === 'status' ? 'desc' : 'asc'
}

function compareCertificateItems(
  a: ManagedCertificateItem,
  b: ManagedCertificateItem,
  key: CertificateSortKey,
  direction: SortDirection,
) {
  const modifier = direction === 'asc' ? 1 : -1
  const result = compareCertificateValue(a, b, key)
  if (result !== 0) return result * modifier
  return compareTimeValue(b.issueDate, a.issueDate) || compareTextValue(a.vulnId, b.vulnId)
}

function compareCertificateValue(a: ManagedCertificateItem, b: ManagedCertificateItem, key: CertificateSortKey) {
  switch (key) {
    case 'issueDate':
      return compareTimeValue(a.issueDate, b.issueDate)
    case 'issuer':
      return compareTextValue(a.issuer ?? '', b.issuer ?? '')
    case 'publicVerify':
      return Number(a.publicVerify) - Number(b.publicVerify)
    case 'recipient':
      return compareTextValue(`${a.recipient} ${a.unifiedCode}`, `${b.recipient} ${b.unifiedCode}`)
    case 'status':
      return certificateStatusRank[a.status] - certificateStatusRank[b.status]
    case 'type':
      return compareTextValue(`${a.type} ${a.vulnTitle}`, `${b.type} ${b.vulnTitle}`)
  }
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
