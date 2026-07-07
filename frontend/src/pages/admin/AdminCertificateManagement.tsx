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
  ShieldCheck,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../../components/ui/PageHeader'
import { SearchInput } from '../../components/ui/SearchInput'
import { SelectInput } from '../../components/ui/SelectInput'
import { SurfacePanel } from '../../components/ui/SurfacePanel'
import {
  issueCertificate,
  listManagedCertificates,
  openCertificatePreview,
  revokeCertificate,
} from '../../services/certificates'
import type { ManagedCertificateItem, SeverityLabel } from '../../services/certificates'

type CertificateStatus = '待签发' | '已签发' | '已撤销'

const statusOptions = ['全部状态', '待签发', '已签发', '已撤销']
const levelOptions = ['全部等级', '严重', '高危', '中危', '低危', '信息']

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

export function AdminCertificateManagement() {
  const [items, setItems] = useState<ManagedCertificateItem[]>([])
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('全部状态')
  const [level, setLevel] = useState('全部等级')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [issueTarget, setIssueTarget] = useState<ManagedCertificateItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function loadCertificates() {
    setError('')
    setLoading(true)
    try {
      const response = await listManagedCertificates()
      setItems(response.items)
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
      <section className="relative z-10 mx-auto max-w-[1360px] px-5 pb-8 pt-24 md:px-8">
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
              <h1 className="mt-4 text-2xl font-semibold leading-snug">{selectedCertificate.type}</h1>
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
                {selectedCertificate.status === '待签发' && (
                  <button
                    className="rounded-lg bg-brand-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-700"
                    onClick={() => setIssueTarget(selectedCertificate)}
                    type="button"
                  >
                    签发证书
                  </button>
                )}
                <button
                  className="rounded-lg border border-black/10 px-4 py-3 text-sm font-medium transition hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
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

        <IssueCertificateModal
          certificate={issueTarget}
          onClose={() => setIssueTarget(null)}
          onIssued={async () => {
            setIssueTarget(null)
            setSelectedId(null)
            setMessage('证书已签发，PDF 已生成。')
            await loadCertificates()
          }}
        />
      </section>
    )
  }

  return (
    <>
      <section className="relative z-10 mx-auto max-w-[1360px] px-5 pb-8 pt-24 md:px-8">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <PageHeader
            eyebrow="Certificate Ops"
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

        <div className="mt-6 grid gap-5">
          {loading && (
            <SurfacePanel className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">正在加载证书管理数据...</SurfacePanel>
          )}

          {!loading &&
            filteredCertificates.map((item) => (
              <SurfacePanel className="p-5 transition hover:border-brand-600/25 hover:bg-white/85 dark:hover:bg-white/[0.055]" key={item.id}>
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{item.vulnId}</span>
                      <LevelBadge level={item.level} />
                      <CertificateStatusBadge status={item.status} />
                    </div>
                    <h2 className="mt-3 text-xl font-semibold tracking-tight">{item.type}</h2>
                    <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-300">{item.vulnTitle}</p>
                    <div className="mt-4 grid gap-2 text-sm text-slate-500 sm:grid-cols-2 dark:text-slate-400">
                      <p>获得者：{item.recipient}</p>
                      <p>统一认证码：{item.unifiedCode}</p>
                      <p>签发时间：{formatDate(item.issueDate)}</p>
                      <p>签发人：{item.issuer ?? '未签发'}</p>
                      <p>公开核验：{item.publicVerify ? '已开启' : '未开启'}</p>
                      <p>责任单位：{item.owner ?? '未填写'}</p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-black/5 bg-[var(--app-panel-muted-bg)] p-4 dark:border-white/10 ">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <ShieldCheck className="h-4 w-4 text-brand-700 dark:text-brand-300" />
                      证书内容
                    </div>
                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-500 dark:text-slate-400">{item.contribution}</p>
                    <p className="mt-4 font-mono text-xs text-slate-500 dark:text-slate-400">{item.verifyCode}</p>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-4 dark:border-white/10">
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <FileCheck2 className="h-4 w-4" />
                    签发、撤销、PDF 预览都会经过后端鉴权与审计记录
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="inline-flex items-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
                      onClick={() => setSelectedId(item.id)}
                      type="button"
                    >
                      <Eye className="h-4 w-4" />
                      查看详情
                    </button>
                    <button
                      className="inline-flex items-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
                      onClick={() => void previewPdf(item)}
                      type="button"
                    >
                      <Download className="h-4 w-4" />
                      预览 PDF
                    </button>
                    {item.status === '待签发' && (
                      <button
                        className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
                        onClick={() => setIssueTarget(item)}
                        type="button"
                      >
                        签发证书
                      </button>
                    )}
                    {item.status === '已签发' && (
                      <button
                        className="inline-flex items-center gap-2 rounded-lg border border-red-500/20 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-500/10 dark:text-red-300"
                        onClick={() => void handleRevoke(item)}
                        type="button"
                      >
                        <Ban className="h-4 w-4" />
                        撤销
                      </button>
                    )}
                  </div>
                </div>
              </SurfacePanel>
            ))}

          {!loading && filteredCertificates.length === 0 && (
            <SurfacePanel className="p-10 text-center">
              <Award className="mx-auto h-10 w-10 text-slate-400" />
              <h2 className="mt-4 text-xl font-semibold">没有匹配的证书记录</h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">已确认并定级的漏洞会进入证书管理队列。</p>
            </SurfacePanel>
          )}
        </div>
      </section>

      <IssueCertificateModal
        certificate={issueTarget}
        onClose={() => setIssueTarget(null)}
        onIssued={async () => {
          setIssueTarget(null)
          setMessage('证书已签发，PDF 已生成。')
          await loadCertificates()
        }}
      />
    </>
  )
}

function IssueCertificateModal({
  certificate,
  onClose,
  onIssued,
}: {
  certificate: ManagedCertificateItem | null
  onClose: () => void
  onIssued: () => Promise<void>
}) {
  const [contribution, setContribution] = useState('')
  const [publicVerify, setPublicVerify] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setContribution(certificate?.contribution ?? '')
    setPublicVerify(certificate?.publicVerify ?? true)
    setError('')
  }, [certificate])

  if (!certificate) return null

  async function confirmIssue() {
    if (!certificate) return
    setError('')
    setSubmitting(true)
    try {
      await issueCertificate({
        contribution,
        publicVerify,
        vulnerabilityId: certificate.vulnerabilityId,
      })
      await onIssued()
    } catch (issueError) {
      setError(issueError instanceof Error ? issueError.message : '证书签发失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/35 px-5 backdrop-blur-sm">
      <div className="w-full max-w-[620px] rounded-lg border border-black/10 bg-[var(--app-menu-bg)] p-6 shadow-2xl backdrop-blur-xl dark:border-white/10 ">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-brand-700 dark:text-brand-300">
              <Award className="h-5 w-5" />
              <span className="text-sm font-medium">Certificate Issue</span>
            </div>
            <h2 className="mt-2 text-2xl font-semibold">签发证书</h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              确认后将生成正式证书记录和 PDF，并写入审计日志。
            </p>
          </div>
          <button
            aria-label="关闭签发弹窗"
            className="rounded-lg p-2 text-slate-500 transition hover:bg-black/5 hover:text-slate-950 dark:hover:bg-white/10 dark:hover:text-white"
            onClick={onClose}
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 grid gap-4">
          <div className="rounded-lg border border-black/10 bg-[var(--app-panel-muted-bg)] p-4 dark:border-white/10 ">
            <p className="text-sm font-semibold">{certificate.type}</p>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{certificate.vulnTitle}</p>
            <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2 dark:text-slate-400">
              <p>获得者：{certificate.recipient}</p>
              <p>统一认证码：{certificate.unifiedCode}</p>
              <p>关联漏洞：{certificate.vulnId}</p>
              <p>公开核验：{publicVerify ? '开启' : '关闭'}</p>
            </div>
          </div>
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">贡献说明</span>
            <textarea
              className="mt-2 min-h-28 w-full resize-none rounded-lg border border-black/10 bg-[var(--app-panel-bg)] px-3 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10  dark:text-white"
              onChange={(event) => setContribution(event.target.value)}
              value={contribution}
            />
          </label>
          <label className="flex items-center gap-3 rounded-lg border border-black/10 bg-white/55 px-4 py-3 text-sm dark:border-white/10 ">
            <input
              checked={publicVerify}
              className="h-4 w-4 accent-brand-600"
              onChange={(event) => setPublicVerify(event.target.checked)}
              type="checkbox"
            />
            开启公开核验，访客可通过证书编号查询脱敏结果
          </label>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            className="rounded-lg border border-black/10 px-4 py-2.5 text-sm font-medium transition hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
            onClick={onClose}
            type="button"
          >
            取消
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={submitting}
            onClick={() => void confirmIssue()}
            type="button"
          >
            <CheckCircle2 className="h-4 w-4" />
            {submitting ? '签发中...' : '确认签发'}
          </button>
        </div>
      </div>
    </div>
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
