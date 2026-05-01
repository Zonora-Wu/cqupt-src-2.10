import {
  Award,
  CalendarClock,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  FileCheck2,
  Medal,
  ShieldCheck,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
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

const statusOptions = ['全部状态', '已签发', '已撤销']

const certStatusStyles: Record<string, string> = {
  已撤销: 'border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300',
  已签发: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  待签发: 'border-black/10 bg-black/[0.035] text-slate-600 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300',
}

export function UserCertificates() {
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('全部状态')
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
  const previewUrlRef = useRef<string | null>(null)

  useEffect(() => {
    void loadCertificates()

    return releasePreviewUrl
  }, [])

  const filteredCertificates = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()

    return certificates.filter((item) => {
      const matchesKeyword =
        !normalizedKeyword ||
        item.certificateNo.toLowerCase().includes(normalizedKeyword) ||
        item.verifyCode.toLowerCase().includes(normalizedKeyword) ||
        item.vulnerability.reportNo.toLowerCase().includes(normalizedKeyword) ||
        item.vulnerability.title.toLowerCase().includes(normalizedKeyword)
      const matchesStatus = status === '全部状态' || item.status === status

      return matchesKeyword && matchesStatus
    })
  }, [certificates, keyword, status])

  const certificateStats = [
    { label: '证书总数', value: String(stats.total), hint: '已获得贡献证明', icon: Award },
    { label: '已签发', value: String(stats.issued), hint: '可下载证书', icon: ShieldCheck },
    { label: '电子证书', value: String(stats.issued), hint: '线上发放保存', icon: CalendarClock },
    { label: '可公开查询', value: String(certificates.filter((item) => item.publicVerify && item.status === '已签发').length), hint: '支持编号核验', icon: FileCheck2 },
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

  async function copyVerifyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code)
      setMessage('查询码已复制。')
      window.setTimeout(() => setMessage(''), 1800)
    } catch {
      setError('复制失败，请手动复制查询码')
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
          eyebrowIcon={<Medal className="h-3.5 w-3.5" />}
          title="我的证书"
          description="查看漏洞贡献证书、预览完整 PDF、下载电子证明，并通过证书编号完成公开核验。"
        />
        <button
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-brand-700"
          onClick={() => setQueryOpen(true)}
          type="button"
        >
          <Award className="h-4 w-4" />
          证书查询
        </button>
      </div>

      {error && <AlertMessage className="mt-5" message={error} onClose={() => setError('')} variant="error" />}
      {message && <AlertMessage className="mt-5" message={message} onClose={() => setMessage('')} variant="success" />}

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        {certificateStats.map((item) => {
          const Icon = item.icon
          return (
            <SurfacePanel className="p-5" key={item.label}>
              <div className="flex items-start justify-between gap-4">
                <Icon className="h-5 w-5 text-brand-700 dark:text-green-300" />
                <span className="text-3xl font-semibold">{item.value}</span>
              </div>
              <p className="mt-3 text-sm font-medium">{item.label}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.hint}</p>
            </SurfacePanel>
          )
        })}
      </div>

      <SurfacePanel className="relative z-30 mt-6 p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px] lg:items-end">
          <SearchInput
            label="搜索我的证书"
            onChange={setKeyword}
            placeholder="输入证书编号、查询码、漏洞编号或标题"
            value={keyword}
          />
          <SelectInput label="证书状态" onChange={setStatus} options={statusOptions} value={status} />
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
                className="min-w-0 flex-1 rounded-lg border border-black/10 bg-white/70 px-3 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/30"
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
              <div className="mt-4 rounded-lg border border-black/5 bg-black/[0.025] p-4 dark:border-white/10 dark:bg-white/[0.035]">
                {queryResult ? (
                  <>
                    <div className="flex items-center gap-2 text-sm font-medium text-brand-700 dark:text-green-300">
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
            <SurfacePanel className="overflow-hidden p-0 transition hover:border-brand-600/25 hover:bg-white/85 dark:hover:bg-white/[0.055]" key={item.id}>
              <div className="grid gap-0 lg:grid-cols-[300px_minmax(0,1fr)]">
                <div className="relative min-h-56 overflow-hidden bg-gradient-to-br from-emerald-100 via-white to-amber-50 dark:from-emerald-950/40 dark:via-white/[0.06] dark:to-amber-950/25">
                  <div className="absolute inset-6 rounded-lg border border-white/70 bg-white/45 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/[0.06]" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-lg bg-brand-600 text-white shadow-sm">
                        <Award className="h-8 w-8" />
                      </div>
                      <p className="mt-4 text-xs font-medium uppercase tracking-[0.18em] text-brand-700 dark:text-green-300">
                        CQUPT-SRC
                      </p>
                      <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-200">PDF Certificate</p>
                    </div>
                  </div>
                </div>

                <div className="p-5">
                  <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_260px]">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{item.certificateNo}</span>
                        {item.vulnerability.finalSeverity && (
                          <SeverityBadge level={item.vulnerability.finalSeverity as SeverityLevel} />
                        )}
                        <span className={`rounded-md border px-2 py-1 text-xs font-medium ${certStatusStyles[item.status]}`}>
                          {item.status}
                        </span>
                      </div>
                      <h2 className="mt-3 text-xl font-semibold tracking-tight">{item.contribution}</h2>
                      <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-300">{item.vulnerability.title}</p>
                      <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
                        该证书由 CQUPT-SRC 线上签发，PDF 文件由后端根据当前证书模板生成并受控存储。
                      </p>
                      <div className="mt-4 grid gap-2 text-sm text-slate-500 sm:grid-cols-2 dark:text-slate-400">
                        <p>关联漏洞：{item.vulnerability.reportNo}</p>
                        <p>签发人：{item.issuer ?? '平台'}</p>
                        <p>签发日期：{formatDate(item.issuedAt)}</p>
                        <p>查询码：{item.verifyCode}</p>
                      </div>
                    </div>

                    <div className="rounded-lg border border-black/5 bg-black/[0.025] p-4 dark:border-white/10 dark:bg-white/[0.035]">
                      <p className="text-sm font-medium">证书操作</p>
                      <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                        预览会打开完整 PDF；下载会保存后端生成的电子证书文件。
                      </p>
                      <div className="mt-4 grid gap-2">
                        <button
                          className="inline-flex items-center justify-center gap-2 rounded-lg border border-brand-600/20 bg-brand-600/10 px-3 py-2 text-sm font-medium text-brand-800 transition hover:bg-brand-600/15 disabled:cursor-not-allowed disabled:opacity-55 dark:text-green-300"
                          disabled={item.status !== '已签发' || isPreviewLoading}
                          onClick={() => void previewCertificate(item)}
                          type="button"
                        >
                          <Eye className="h-4 w-4" />
                          {isPreviewLoading ? '加载中...' : '预览 PDF'}
                        </button>
                        <button
                          className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-55"
                          disabled={item.status !== '已签发' || downloadingId === item.id}
                          onClick={() => void downloadCertificate(item)}
                          type="button"
                        >
                          <Download className="h-4 w-4" />
                          {downloadingId === item.id ? '下载中...' : '下载 PDF'}
                        </button>
                        <button
                          className="inline-flex items-center justify-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
                          onClick={() => void copyVerifyCode(item.verifyCode)}
                          type="button"
                        >
                          <Copy className="h-4 w-4" />
                          复制查询码
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </SurfacePanel>
          ))
        ) : (
          <EmptyState
            icon={<CheckCircle2 className="h-10 w-10" />}
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
