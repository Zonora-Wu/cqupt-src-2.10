import {
  Award,
  Ban,
  CalendarClock,
  CheckCircle2,
  Download,
  Eye,
  FileCheck2,
  Filter,
  Medal,
  RefreshCw,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { CopyableCode } from '../../components/ui/CopyableCode'
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

const statusOptions = ['全部状态', '待签发', '已签发', '已撤销']
const levelOptions = ['全部等级', '严重', '高危', '中危', '低危', '信息']
const defaultPageSize = 10

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

export function AdminCertificateManagement() {
  const [items, setItems] = useState<ManagedCertificateItem[]>([])
  const [stats, setStats] = useState({ total: 0, pending: 0, issued: 0, revoked: 0 })
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('全部状态')
  const [level, setLevel] = useState('全部等级')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(defaultPageSize)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

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
    void loadCertificates()
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

  useEffect(() => {
    setPage(1)
  }, [keyword, status, level, pageSize])

  const totalPages = Math.max(1, Math.ceil(filteredCertificates.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paginatedCertificates = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return filteredCertificates.slice(start, start + pageSize)
  }, [filteredCertificates, pageSize, safePage])

  const selectedCertificate = selectedId ? items.find((item) => item.id === selectedId) ?? null : null

  async function previewPdf(certificate: ManagedCertificateItem) {
    if (!certificate.certificateId) {
      setMessage('请先签发证书，再预览 PDF。')
      return
    }

    setMessage('')
    try {
      await openCertificatePreview(certificate.certificateId)
    } catch (previewError) {
      setMessage(previewError instanceof Error ? previewError.message : '证书 PDF 预览失败')
    }
  }

  async function handleRevoke(certificate: ManagedCertificateItem) {
    if (!certificate.certificateId || certificate.status !== '已签发') {
      setMessage('只有已签发证书可以撤销。')
      return
    }

    const reason = window.prompt('请输入撤销原因')
    if (!reason?.trim()) return
    if (!window.confirm('确认撤销该证书？撤销后公开核验将不可用。')) return

    setMessage('')
    try {
      await revokeCertificate(certificate.certificateId, reason.trim())
      setMessage('证书已撤销。')
      await loadCertificates()
    } catch (revokeError) {
      setMessage(revokeError instanceof Error ? revokeError.message : '证书撤销失败')
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

        {message && (
          <div className="mt-4 rounded-lg border border-brand-600/20 bg-brand-600/10 px-4 py-3 text-sm text-brand-700 dark:text-brand-300">
            {message}
          </div>
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

        {message && (
          <div className="mt-4 rounded-lg border border-brand-600/20 bg-brand-600/10 px-4 py-3 text-sm text-brand-700 dark:text-brand-300">
            {message}
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
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
            <span>漏洞编号 / 状态</span>
            <span>证书类型 / 关联漏洞</span>
            <span className="hidden xl:block">获得者</span>
            <span className="hidden xl:block">签发时间</span>
            <span className="hidden xl:block">签发人</span>
            <span className="hidden xl:block">公开核验</span>
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
