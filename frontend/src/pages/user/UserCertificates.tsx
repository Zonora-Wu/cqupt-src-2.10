import {
  CheckCircle2,
  Copy,
  Download,
  Eye,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageSection } from '../../components/layout/PageSection'
import { AlertMessage } from '../../components/ui/AlertMessage'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { SearchInput } from '../../components/ui/SearchInput'
import { SelectInput } from '../../components/ui/SelectInput'
import { SeverityBadge } from '../../components/ui/SeverityBadge'
import { SurfacePanel } from '../../components/ui/SurfacePanel'
import {
  createCertificatePreviewUrl,
  downloadCertificatePdf,
  listMyCertificates,
  publicVerifyCertificate,
  type IssuedCertificate,
  type PublicCertificateVerifyResult,
} from '../../services/certificates'
import type { SeverityLevel } from '../../utils/severity'
import { markNotificationEntityRead } from '../../services/notifications'
import { NOTIFICATION_READ_STATE_EVENT } from '../../services/notificationReadState'

const statusOptions = ['全部状态', '已签发', '已撤销']

const certStatusStyles: Record<string, string> = {
  已撤销: 'border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300',
  已签发: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  待签发: 'border-black/10 bg-[var(--app-panel-muted-bg)] text-slate-600 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300',
}

export function UserCertificates() {
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('全部状态')
  const [issuedDate, setIssuedDate] = useState('')
  const [queryCode, setQueryCode] = useState('')
  const [queryResult, setQueryResult] = useState<PublicCertificateVerifyResult | null>(null)
  const [queryTouched, setQueryTouched] = useState(false)
  const [queryOpen, setQueryOpen] = useState(false)
  const [certificates, setCertificates] = useState<IssuedCertificate[]>([])
  const [stats, setStats] = useState({ issued: 0, revoked: 0, total: 0 })
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [previewState, setPreviewState] = useState<{
    certificate: IssuedCertificate
    url: string
  } | null>(null)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [downloadingId, setDownloadingId] = useState('')
  const [copiedCertificateNo, setCopiedCertificateNo] = useState<string | null>(null)
  const previewUrlRef = useRef<string | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    void loadCertificates()

    return releasePreviewUrl
  }, [])

  useEffect(() => {
    const certificateId = searchParams.get('certificateId')
    if (!certificateId || certificates.length === 0) return
    const certificate = certificates.find((item) => item.id === certificateId)
    if (!certificate) return
    void previewCertificate(certificate)
    setSearchParams({}, { replace: true })
  // URL consumption is keyed by route state; previewCertificate intentionally uses current component state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [certificates, searchParams, setSearchParams])

  const filteredCertificates = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()

    return certificates.filter((item) => {
      const matchesKeyword =
        !normalizedKeyword ||
        item.certificateNo.toLowerCase().includes(normalizedKeyword) ||
        item.vulnerability.reportNo.toLowerCase().includes(normalizedKeyword) ||
        item.vulnerability.title.toLowerCase().includes(normalizedKeyword)
      const matchesStatus = status === '全部状态' || item.status === status
      const matchesDate = isOnDate(item.issuedAt, issuedDate)

      return matchesKeyword && matchesStatus && matchesDate
    })
  }, [certificates, issuedDate, keyword, status])

  const certificateStats = [
    { label: '证书总数', value: String(stats.total), hint: '已获得贡献证明' },
    { label: '已签发', value: String(stats.issued), hint: '可下载证书' },
    { label: '电子证书', value: String(stats.issued), hint: '线上发放保存' },
    { label: '可公开查询', value: String(certificates.filter((item) => item.publicVerify && item.status === '已签发').length), hint: '支持编号核验' },
  ]

  async function loadCertificates() {
    try {
      setIsLoading(true)
      setError('')
      const result = await listMyCertificates()
      setCertificates(result.items)
      setStats(result.stats)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '证书列表加载失败')
    } finally {
      setIsLoading(false)
    }
  }

  async function searchCertificate() {
    const normalizedCode = queryCode.trim()
    setQueryTouched(true)
    setQueryResult(null)

    if (!normalizedCode) {
      return
    }

    try {
      const result = await publicVerifyCertificate(normalizedCode)
      setQueryResult(result)
    } catch {
      setQueryResult(null)
    }
  }

  async function previewCertificate(certificate: IssuedCertificate) {
    try {
      setIsPreviewLoading(true)
      setError('')
      const url = await createCertificatePreviewUrl(certificate.id)
      releasePreviewUrl()
      previewUrlRef.current = url
      setPreviewState({ certificate, url })
      await markNotificationEntityRead('Certificate', certificate.id)
      window.dispatchEvent(new Event(NOTIFICATION_READ_STATE_EVENT))
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : '证书 PDF 预览失败')
    } finally {
      setIsPreviewLoading(false)
    }
  }

  async function downloadCertificate(certificate: IssuedCertificate) {
    try {
      setDownloadingId(certificate.id)
      setError('')
      await downloadCertificatePdf(certificate.id, certificate.certificateNo)
      setMessage('证书 PDF 已开始下载。')
      window.setTimeout(() => setMessage(''), 2200)
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : '证书下载失败')
    } finally {
      setDownloadingId('')
    }
  }

  async function copyCertificateNo(certificateNo: string) {
    try {
      await navigator.clipboard.writeText(certificateNo)
      setCopiedCertificateNo(certificateNo)
      window.setTimeout(() => setCopiedCertificateNo((current) => current === certificateNo ? null : current), 1600)
      setMessage('证书编号已复制。')
      window.setTimeout(() => setMessage(''), 1800)
    } catch {
      setError('复制失败，请手动复制证书编号')
    }
  }

  function closePreview() {
    releasePreviewUrl()
    setPreviewState(null)
  }

  function releasePreviewUrl() {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
  }

  return (
    <PageSection>
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <PageHeader
          eyebrow="My Certificates"
          title="我的证书"
          description="查看漏洞贡献证书、预览完整 PDF、下载电子证明，并通过证书编号完成公开核验。"
        />
        <button
          className="rounded-lg bg-brand-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-brand-700"
          onClick={() => setQueryOpen(true)}
          type="button"
        >
          证书查询
        </button>
      </div>

      {error && <AlertMessage className="mt-5" message={error} onClose={() => setError('')} variant="error" />}
      {message && <AlertMessage className="mt-5" message={message} onClose={() => setMessage('')} variant="success" />}

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        {certificateStats.map((item) => (
          <SurfacePanel className="p-5" key={item.label}>
            <p className="text-3xl font-semibold">{item.value}</p>
            <p className="mt-2 text-sm font-medium">{item.label}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.hint}</p>
          </SurfacePanel>
        ))}
      </div>

      <SurfacePanel className="relative z-30 mt-6 p-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_180px_150px] xl:items-end">
          <SearchInput
            label="搜索我的证书"
            onChange={setKeyword}
            placeholder="输入证书编号、漏洞编号或标题"
            value={keyword}
          />
          <SelectInput label="证书状态" onChange={setStatus} options={statusOptions} value={status} />
          <DateFilter label="签发日期" onChange={setIssuedDate} value={issuedDate} />
        </div>
      </SurfacePanel>

      {queryOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 px-5 backdrop-blur-sm">
          <SurfacePanel className="w-full max-w-[560px] p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">公开核验</p>
                <h2 className="mt-1 text-xl font-semibold">证书查询</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                  输入证书编号，核验证书是否由 CQUPT-SRC 签发。公开核验只展示脱敏信息。
                </p>
              </div>
              <button
                aria-label="关闭证书查询"
                className="rounded-lg p-2 text-slate-500 transition hover:bg-black/5 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
                onClick={() => setQueryOpen(false)}
                type="button"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-5 flex gap-2">
              <input
                autoCapitalize="characters"
                autoComplete="off"
                className="min-w-0 flex-1 rounded-lg border border-black/10 bg-[var(--app-panel-bg)] px-3 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10  dark:text-white dark:placeholder:text-white/30"
                maxLength={26}
                onChange={(event) => setQueryCode(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void searchCertificate()
                }}
                placeholder="证书编号"
                value={queryCode}
              />
              <button
                className="rounded-lg bg-brand-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-700"
                onClick={() => void searchCertificate()}
                type="button"
              >
                查询
              </button>
            </div>

            {queryTouched && (
              <div className="mt-4 rounded-lg border border-black/5 bg-[var(--app-panel-muted-bg)] p-4 dark:border-white/10 ">
                {queryResult ? (
                  <>
                    <div className="flex items-center gap-2 text-sm font-medium text-brand-700 dark:text-brand-300">
                      <CheckCircle2 className="h-4 w-4" />
                      查询有效
                    </div>
                    <p className="mt-2 text-sm font-medium">{queryResult.certificateNo}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      获得者：{queryResult.recipientName} · 关联漏洞：{queryResult.vulnerability.reportNo}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium">未查询到有效证书</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">请检查编号是否完整，或联系平台管理员核验。</p>
                  </>
                )}
              </div>
            )}
          </SurfacePanel>
        </div>
      )}

      <div className="mt-6 grid gap-5">
        {isLoading ? (
          <SurfacePanel className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">正在加载证书...</SurfacePanel>
        ) : filteredCertificates.length > 0 ? (
          filteredCertificates.map((item) => (
            <SurfacePanel className="p-4" key={item.id}>
              <article className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-stretch">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{item.certificateNo}</span>
                    <button aria-label={copiedCertificateNo === item.certificateNo ? '证书编号已复制' : '复制证书编号'} className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-500 transition hover:bg-black/5 hover:text-brand-700 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-brand-300" onClick={() => void copyCertificateNo(item.certificateNo)} title={copiedCertificateNo === item.certificateNo ? '已复制' : '复制证书编号'} type="button">{copiedCertificateNo === item.certificateNo ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}</button>
                    {item.vulnerability.finalSeverity ? <SeverityBadge level={item.vulnerability.finalSeverity as SeverityLevel} /> : null}
                    <span className={`rounded-md border px-2 py-1 text-xs font-medium ${certStatusStyles[item.status]}`}>{item.status}</span>
                  </div>
                  <h2 className="mt-2 truncate text-base font-semibold">{item.contribution}</h2>
                  <p className="mt-1 truncate text-sm text-slate-700 dark:text-slate-300">{item.vulnerability.title}</p>
                  <dl className="mt-3 grid gap-x-5 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                    <CertificateData label="关联漏洞" value={item.vulnerability.reportNo} />
                    <CertificateData label="签发人" value={item.issuer ?? '平台'} />
                    <CertificateData label="签发日期" value={formatDate(item.issuedAt)} />
                    <CertificateData label="公开核验" value={item.publicVerify ? '支持' : '不支持'} />
                  </dl>
                </div>
                <div className="flex shrink-0 flex-wrap content-end justify-end gap-2 lg:self-end">
                  <button className="inline-flex items-center gap-2 rounded-lg border border-brand-600/20 px-3 py-2 text-sm font-medium text-brand-800 transition hover:bg-brand-600/10 disabled:cursor-not-allowed disabled:opacity-55 dark:text-brand-300" disabled={item.status !== '已签发' || isPreviewLoading} onClick={() => void previewCertificate(item)} type="button"><Eye className="h-4 w-4" />{isPreviewLoading ? '加载中' : '预览'}</button>
                  <button className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-55" disabled={item.status !== '已签发' || downloadingId === item.id} onClick={() => void downloadCertificate(item)} type="button"><Download className="h-4 w-4" />{downloadingId === item.id ? '下载中' : '下载 PDF'}</button>
                </div>
              </article>
            </SurfacePanel>
          ))
        ) : (
          <EmptyState
            icon={null}
            title="没有匹配的证书"
            description="调整关键词或证书状态后再试一次。"
          />
        )}
      </div>

      {previewState && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 px-4 py-5 backdrop-blur-sm">
          <SurfacePanel className="flex h-[92vh] w-full max-w-[1180px] flex-col overflow-hidden p-0">
            <div className="flex items-center justify-between gap-4 border-b border-black/10 px-5 py-4 dark:border-white/10">
              <div className="min-w-0">
                <p className="text-sm text-slate-500 dark:text-slate-400">完整 PDF 预览</p>
                <h2 className="mt-1 truncate text-xl font-semibold">{previewState.certificate.certificateNo}</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
                  onClick={() => void downloadCertificate(previewState.certificate)}
                  type="button"
                >
                  <Download className="h-4 w-4" />
                  下载
                </button>
                <button
                  aria-label="关闭证书预览"
                  className="rounded-lg p-2 text-slate-500 transition hover:bg-black/5 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
                  onClick={closePreview}
                  type="button"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <iframe
              className="min-h-0 flex-1 bg-white"
              src={`${previewState.url}#toolbar=1&navpanes=0&view=FitH`}
              title={`证书 PDF 预览 ${previewState.certificate.certificateNo}`}
            />
          </SurfacePanel>
        </div>
      )}
    </PageSection>
  )
}

function formatDate(value: string | null) {
  if (!value) return '未签发'
  return new Date(value).toLocaleDateString('zh-CN')
}

function isOnDate(value: string | null, targetDate: string) {
  if (!targetDate) return true
  if (!value) return false
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return false
  return date.toLocaleDateString('en-CA') === targetDate
}

function DateFilter({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return <label className="block text-sm font-medium text-slate-700 dark:text-slate-300"><span>{label}</span><input className="mt-2 h-11 w-full rounded-lg border border-black/10 bg-[var(--app-panel-bg)] px-3 text-sm outline-none transition focus:border-brand-600 dark:border-white/10 dark:text-slate-100" onChange={(event) => onChange(event.target.value)} type="date" value={value} /></label>
}

function CertificateData({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="mt-1 truncate font-medium text-slate-800 dark:text-slate-200" title={value}>{value}</dd>
    </div>
  )
}
