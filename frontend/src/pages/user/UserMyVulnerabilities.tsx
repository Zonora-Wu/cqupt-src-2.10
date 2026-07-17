import { Check, Copy, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageSection } from '../../components/layout/PageSection'
import { AlertMessage } from '../../components/ui/AlertMessage'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { SearchInput } from '../../components/ui/SearchInput'
import { SelectInput } from '../../components/ui/SelectInput'
import { SeverityBadge } from '../../components/ui/SeverityBadge'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { SurfacePanel } from '../../components/ui/SurfacePanel'
import {
  getMyVulnerabilityDetail,
  listMyVulnerabilities,
  openAttachmentPreview,
  supplementVulnerability,
  uploadVulnerabilityAttachment,
} from '../../services/vulnerabilities'
import type { MyVulnerabilityDetail, MyVulnerabilityItem, MyVulnerabilityListResponse } from '../../services/vulnerabilities'

const statusOptions = ['全部状态', '草稿', '待审核', '审核中', '待补充', '已确认', '修复中', '已归档']
const levelOptions = ['全部等级', '严重', '高危', '中危', '低危', '信息']

export function UserMyVulnerabilities() {
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('全部状态')
  const [level, setLevel] = useState('全部等级')
  const [submittedDate, setSubmittedDate] = useState('')
  const [data, setData] = useState<MyVulnerabilityListResponse | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [previewingAttachmentId, setPreviewingAttachmentId] = useState<string | null>(null)
  const [copiedReportNo, setCopiedReportNo] = useState<string | null>(null)
  const navigate = useNavigate()

  /* 详情抽屉 */
  const [detailTarget, setDetailTarget] = useState<MyVulnerabilityItem | null>(null)
  const [detail, setDetail] = useState<MyVulnerabilityDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')

  /* 补充材料弹窗 */
  const [supplementTarget, setSupplementTarget] = useState<MyVulnerabilityItem | null>(null)
  const [supplementNote, setSupplementNote] = useState('')
  const [supplementFile, setSupplementFile] = useState<File | null>(null)
  const [supplementFileError, setSupplementFileError] = useState('')
  const [supplementSubmitting, setSupplementSubmitting] = useState(false)
  const [supplementError, setSupplementError] = useState('')

  const loadReports = async () => {
    setIsLoading(true)
    setErrorMessage('')

    try {
      const result = await listMyVulnerabilities()
      setData(result)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '漏洞列表加载失败')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadReports()
  }, [])

  const vulnerabilityStats = useMemo(() => {
    const stats = data?.stats ?? { confirmed: 0, needSupplement: 0, pending: 0, total: 0 }

    return [
      { label: '累计提交', value: String(stats.total), hint: '漏洞报告' },
      { label: '待处理', value: String(stats.pending), hint: '审核或修复中' },
      { label: '已确认', value: String(stats.confirmed), hint: '通过审核' },
      { label: '需补充', value: String(stats.needSupplement), hint: '等待完善材料' },
    ]
  }, [data?.stats])

  const filteredVulnerabilities = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()
    const vulnerabilities = data?.items ?? []

    return vulnerabilities.filter((item) => {
      const matchesKeyword =
        !normalizedKeyword ||
        item.title.toLowerCase().includes(normalizedKeyword) ||
        item.assetName.toLowerCase().includes(normalizedKeyword) ||
        item.reportNo.toLowerCase().includes(normalizedKeyword)
      const matchesStatus = status === '全部状态' || item.status === status
      const displaySeverity = item.finalSeverity ?? item.selfSeverity
      const matchesLevel = level === '全部等级' || displaySeverity === level
      const matchesDate = isOnDate(item.submittedAt, submittedDate)

      return matchesKeyword && matchesStatus && matchesLevel && matchesDate
    })
  }, [data?.items, keyword, level, status, submittedDate])

  const handlePreviewAttachment = async (attachmentId: string) => {
    setPreviewingAttachmentId(attachmentId)
    setErrorMessage('')

    try {
      await openAttachmentPreview(attachmentId)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'PDF 预览失败')
    } finally {
      setPreviewingAttachmentId(null)
    }
  }

  const copyReportNo = async (reportNo: string) => {
    try {
      await navigator.clipboard.writeText(reportNo)
      setCopiedReportNo(reportNo)
      window.setTimeout(() => setCopiedReportNo((current) => current === reportNo ? null : current), 1600)
    } catch {
      setErrorMessage('复制漏洞编号失败，请手动复制。')
    }
  }

  const openAiAdvice = (item: MyVulnerabilityItem) => {
    navigate('/user/ai', {
      state: {
        aiPrompt: `请基于以下漏洞报告给出材料完善建议，不要编造平台实时数据。报告编号：${item.reportNo}；标题：${item.title}；影响资产：${item.assetName}；漏洞类型：${item.vulnerabilityType}；当前状态：${item.status}。请重点检查复现材料、影响说明和修复建议是否完整。`,
      },
    })
  }

  const openDetail = async (item: MyVulnerabilityItem) => {
    setDetailTarget(item)
    setDetail(null)
    setDetailError('')
    setDetailLoading(true)
    try {
      const d = await getMyVulnerabilityDetail(item.id)
      setDetail(d)
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : '详情加载失败')
    } finally {
      setDetailLoading(false)
    }
  }

  const closeDetail = () => {
    setDetailTarget(null)
    setDetail(null)
  }

  const openSupplement = (item: MyVulnerabilityItem) => {
    setSupplementTarget(item)
    setSupplementNote('')
    setSupplementFile(null)
    setSupplementFileError('')
    setSupplementError('')
  }

  const closeSupplement = () => {
    setSupplementTarget(null)
  }

  const handleSupplementFileChange = (file: File | undefined) => {
    setSupplementFile(null)
    setSupplementFileError('')
    if (!file) return
    if (file.type !== 'application/pdf') {
      setSupplementFileError('仅支持上传 PDF 文件')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setSupplementFileError('单个 PDF 文件不能超过 10MB')
      return
    }
    setSupplementFile(file)
  }

  const handleSupplementSubmit = async () => {
    if (!supplementTarget) return
    if (supplementNote.trim().length < 5) {
      setSupplementError('请填写补充说明（至少5字）')
      return
    }
    setSupplementError('')
    setSupplementSubmitting(true)
    try {
      if (supplementFile) {
        await uploadVulnerabilityAttachment(supplementTarget.id, supplementFile)
      }
      await supplementVulnerability(supplementTarget.id, supplementNote.trim())
      closeSupplement()
      await loadReports()
    } catch (err) {
      setSupplementError(err instanceof Error ? err.message : '补充材料提交失败，请重试')
    } finally {
      setSupplementSubmitting(false)
    }
  }

  return (
    <PageSection>
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <PageHeader
          eyebrow="My Reports"
          title="我的漏洞"
          description="查看你提交的漏洞报告、审核状态、积分奖励和 AI 材料建议，按流程完成补充、复测与归档。"
        />
        <button
          className="rounded-lg bg-brand-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-brand-700"
          onClick={() => void loadReports()}
          type="button"
        >
          {isLoading ? '刷新中' : '刷新列表'}
        </button>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        {vulnerabilityStats.map((item) => (
          <SurfacePanel className="p-5" key={item.label}>
            <p className="text-3xl font-semibold">{item.value}</p>
            <p className="mt-2 text-sm font-medium">{item.label}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.hint}</p>
          </SurfacePanel>
        ))}
      </div>

      <SurfacePanel className="relative z-30 mt-6 p-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_160px_160px_150px_auto] xl:items-end">
          <SearchInput
            label="搜索漏洞"
            onChange={setKeyword}
            placeholder="输入漏洞编号、标题或影响资产"
            value={keyword}
          />
          <SelectInput label="审核状态" onChange={setStatus} options={statusOptions} value={status} />
          <SelectInput label="风险等级" onChange={setLevel} options={levelOptions} value={level} />
          <DateFilter label="提交日期" onChange={setSubmittedDate} value={submittedDate} />
          <button
            className="rounded-lg border border-black/10 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
            onClick={() => {
              setKeyword('')
              setStatus('全部状态')
              setLevel('全部等级')
              setSubmittedDate('')
            }}
            type="button"
          >
            重置
          </button>
        </div>
      </SurfacePanel>

      <div className="mt-6 grid gap-5">
        {errorMessage && (
          <AlertMessage message={errorMessage} onClose={() => setErrorMessage('')} variant="error" />
        )}

        {isLoading && (
          <SurfacePanel className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            正在加载你的漏洞报告...
          </SurfacePanel>
        )}

        {filteredVulnerabilities.map((item) => (
          <SurfacePanel className="p-4" key={item.id}>
            <article className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-stretch">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{item.reportNo}</span>
                  <button aria-label={copiedReportNo === item.reportNo ? '漏洞编号已复制' : '复制漏洞编号'} className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-500 transition hover:bg-black/5 hover:text-brand-700 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-brand-300" onClick={() => void copyReportNo(item.reportNo)} title={copiedReportNo === item.reportNo ? '已复制' : '复制编号'} type="button">{copiedReportNo === item.reportNo ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}</button>
                  <SeverityBadge level={(item.finalSeverity ?? item.selfSeverity) as import('../../utils/severity').SeverityLevel} />
                  <StatusBadge status={item.status as import('../../utils/vulnStatus').VulnStatus} />
                </div>
                <h2 className="mt-2 truncate text-base font-semibold">{item.title}</h2>
                <dl className="mt-3 flex flex-wrap items-baseline gap-x-5 gap-y-2 text-sm">
                  <ReportData label="影响资产" value={item.assetName} />
                  <ReportData label="漏洞类型" value={item.vulnerabilityType} />
                  <ReportData label="责任单位" value={item.ownerUnit || '待确认'} />
                  <ReportData label="提交时间" value={formatDateTime(item.submittedAt)} />
                  <ReportData label="最近更新" value={formatDateTime(item.updatedAt)} />
                  <ReportData label="附件 / 积分" value={`${item.attachments.length} 个 / +${item.points}`} />
                </dl>
              </div>
              <div className="flex shrink-0 flex-wrap content-end justify-end gap-2 xl:self-end">
                <button className="rounded-lg border border-black/10 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10" onClick={() => void openDetail(item)} type="button">查看详情</button>
                <button className="rounded-lg border border-brand-600/25 px-3 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-600/5 dark:text-brand-300" onClick={() => openAiAdvice(item)} type="button">AI 建议</button>
                <button className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-white/15" disabled={item.status !== '待补充'} onClick={() => openSupplement(item)} title={item.status === '待补充' ? '提交审核员要求补充的材料' : '当前状态无需补充材料'} type="button">补充材料</button>
              </div>
            </article>
          </SurfacePanel>
        ))}

        {!isLoading && filteredVulnerabilities.length === 0 && (
          <EmptyState
            icon={null}
            title="没有匹配的漏洞报告"
            description={data?.items.length ? '调整关键词或筛选条件后再试一次。' : '你还没有提交漏洞，可以先进入提交漏洞页面创建第一份报告。'}
          />
        )}
      </div>

      {/* 详情抽屉 */}
      {detailTarget && (
        <VulnerabilityDetailDrawer
          detail={detail}
          error={detailError}
          loading={detailLoading}
          onClose={closeDetail}
          onPreviewAttachment={handlePreviewAttachment}
          previewingAttachmentId={previewingAttachmentId}
        />
      )}

      {/* 补充材料弹窗 */}
      {supplementTarget && (
        <SupplementMaterialsModal
          error={supplementError}
          file={supplementFile}
          fileError={supplementFileError}
          item={supplementTarget}
          note={supplementNote}
          onCancel={closeSupplement}
          onFileChange={handleSupplementFileChange}
          onNoteChange={setSupplementNote}
          onSubmit={() => void handleSupplementSubmit()}
          submitting={supplementSubmitting}
        />
      )}
    </PageSection>
  )
}

function formatDateTime(value: string | null) {
  if (!value) return '未提交'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
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

function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024) return `${sizeBytes} B`
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`
  return `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`
}

/* ─── 详情抽屉 ─── */
function VulnerabilityDetailDrawer({
  detail,
  error,
  loading,
  onClose,
  onPreviewAttachment,
  previewingAttachmentId,
}: {
  detail: MyVulnerabilityDetail | null
  error: string
  loading: boolean
  onClose: () => void
  onPreviewAttachment: (id: string) => void
  previewingAttachmentId: string | null
}) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-end bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative flex h-full w-full max-w-2xl flex-col overflow-hidden bg-[var(--app-bg)] shadow-2xl ">
        {/* 头部 */}
        <div className="flex shrink-0 items-center gap-3 border-b border-black/10 px-6 py-4 dark:border-white/10">
          <div className="min-w-0 flex-1">
            {detail ? (
              <>
                <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{detail.reportNo}</span>
                <h2 className="truncate text-base font-semibold">{detail.title}</h2>
              </>
            ) : (
              <span className="text-sm text-slate-500">漏洞报告详情</span>
            )}
          </div>
          <button
            className="shrink-0 rounded-lg p-1.5 text-slate-500 transition hover:bg-black/5 dark:hover:bg-white/10"
            onClick={onClose}
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex h-48 items-center justify-center text-sm text-slate-400">
              加载中...
            </div>
          )}
          {error && !loading && (
            <AlertMessage className="m-6" message={error} variant="error" />
          )}
          {detail && !loading && (
            <div className="space-y-6 p-6">
              {/* 状态 & 等级 */}
              <div className="flex flex-wrap items-center gap-2">
                <SeverityBadge level={(detail.finalSeverity ?? detail.selfSeverity) as import('../../utils/severity').SeverityLevel} />
                <StatusBadge status={detail.status as import('../../utils/vulnStatus').VulnStatus} />
                {detail.finalSeverity && detail.finalSeverity !== detail.selfSeverity && (
                  <span className="text-xs text-slate-400">（自评：{detail.selfSeverity}）</span>
                )}
                {detail.points > 0 && (
                  <span className="ml-auto text-sm font-semibold text-brand-700 dark:text-brand-300">+{detail.points} 积分</span>
                )}
              </div>

              {/* 基础信息 */}
              <section>
                <SectionTitle title="基础信息" />
                <div className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                  <InfoRow label="影响资产" value={detail.assetName} />
                  <InfoRow label="资产 URL" value={detail.assetUrl || '—'} />
                  <InfoRow label="责任单位" value={detail.ownerUnit || '待确认'} />
                  <InfoRow label="漏洞类型" value={detail.vulnerabilityType} />
                  <InfoRow label="审核员" value={detail.reviewerName || '未分配'} />
                  <InfoRow label="提交时间" value={formatDateTime(detail.submittedAt)} />
                  <InfoRow label="确认时间" value={detail.confirmedAt ? formatDateTime(detail.confirmedAt) : '—'} />
                  <InfoRow label="最近更新" value={formatDateTime(detail.updatedAt)} />
                </div>
              </section>

              {/* 复现步骤 */}
              <section>
                <SectionTitle title="复现步骤" />
                <MarkdownBlock content={detail.reproductionSteps} />
              </section>

              {/* 影响评估 */}
              <section>
                <SectionTitle title="影响评估" />
                <MarkdownBlock content={detail.impactAssessment} />
              </section>

              {/* 修复建议 */}
              <section>
                <SectionTitle title="修复建议" />
                <MarkdownBlock content={detail.repairSuggestion} />
              </section>

              {/* 请求包 */}
              {detail.requestPacket && (
                <section>
                  <SectionTitle title="请求包" />
                  <pre className="mt-3 overflow-x-auto rounded-lg bg-[var(--app-panel-muted-bg)] p-4 text-xs leading-6 text-slate-700  dark:text-slate-300">
                    {detail.requestPacket}
                  </pre>
                </section>
              )}

              {/* 测试边界 */}
              {detail.testBoundary && (
                <section>
                  <SectionTitle title="测试边界说明" />
                  <MarkdownBlock content={detail.testBoundary} />
                </section>
              )}

              {/* 附件 */}
              {detail.attachments.length > 0 && (
                <section>
                  <SectionTitle title={`PDF 附件（${detail.attachments.length}）`} />
                  <div className="mt-3 grid gap-2">
                    {detail.attachments.map((att) => (
                      <div
                        className="flex items-center justify-between gap-3 rounded-lg border border-black/10 bg-[var(--app-panel-muted-bg)] px-3 py-2 text-sm dark:border-white/10 "
                        key={att.id}
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">{att.originalName}</p>
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                            {formatFileSize(att.sizeBytes)} · {formatDateTime(att.uploadedAt)}
                          </p>
                        </div>
                        <button
                        className="shrink-0 rounded-md border border-black/10 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
                          disabled={previewingAttachmentId === att.id}
                          onClick={() => onPreviewAttachment(att.id)}
                          type="button"
                        >
                        {previewingAttachmentId === att.id ? '打开中' : '预览'}
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* 事件记录 */}
              {detail.events.length > 0 && (
                <section>
                  <SectionTitle title="流程记录" />
                  <div className="mt-3 space-y-3">
                    {[...detail.events].reverse().map((ev) => (
                      <div className="flex gap-3" key={ev.id}>
                        <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-600 dark:bg-brand-400" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <span className="font-medium text-slate-700 dark:text-slate-300">{formatEventAction(ev.action)}</span>
                            {ev.actorName && <span>by {ev.actorName}</span>}
                            {ev.toStatus && (
                              <span>→ <StatusBadge status={ev.toStatus as import('../../utils/vulnStatus').VulnStatus} /></span>
                            )}
                            <span className="ml-auto">{formatDateTime(ev.createdAt)}</span>
                          </div>
                          {ev.note && (
                            <p className="mt-1 rounded-md bg-[var(--app-panel-muted-bg)] px-3 py-2 text-xs leading-5 text-slate-600  dark:text-slate-400">
                              {ev.note}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── 补充材料弹窗 ─── */
function SupplementMaterialsModal({
  error,
  file,
  fileError,
  item,
  note,
  onCancel,
  onFileChange,
  onNoteChange,
  onSubmit,
  submitting,
}: {
  error: string
  file: File | null
  fileError: string
  item: MyVulnerabilityItem
  note: string
  onCancel: () => void
  onFileChange: (f: File | undefined) => void
  onNoteChange: (v: string) => void
  onSubmit: () => void
  submitting: boolean
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const lastNote = item.lastEvent?.note ?? null

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 px-5 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="w-full max-w-lg rounded-xl border border-black/10 bg-[var(--app-menu-bg)] p-6 shadow-2xl backdrop-blur-xl dark:border-white/10 ">
        {/* 头部 */}
        <div className="flex items-start justify-end gap-4">
          <button
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-black/5 dark:hover:bg-white/10"
            onClick={onCancel}
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <h2 className="mt-1 text-xl font-semibold">补充材料</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          报告编号 <span className="font-mono">{item.reportNo}</span>
        </p>

        {/* 审核员反馈 */}
        {lastNote && (
          <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/[0.08] p-4">
            <p className="mb-1 text-xs font-medium text-amber-700 dark:text-amber-400">审核员反馈</p>
            <p className="text-sm leading-6 text-slate-700 dark:text-slate-300">{lastNote}</p>
          </div>
        )}

        {/* 补充说明 */}
        <div className="mt-5">
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              补充说明 <span className="text-red-500">*</span>
            </span>
            <textarea
              className="mt-1.5 w-full resize-none rounded-lg border border-black/10 bg-[var(--app-panel-muted-bg)] px-3.5 py-2.5 text-sm leading-6 outline-none transition placeholder:text-slate-400 focus:border-brand-600 focus:ring-1 focus:ring-brand-600/30 dark:border-white/10  dark:text-slate-200 dark:placeholder:text-slate-600"
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder="请描述你补充的内容，以及针对审核员反馈做出的修改或说明…"
              rows={5}
              value={note}
            />
          </label>
        </div>

        {/* 上传附件（可选） */}
        <div className="mt-4">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            附加 PDF（可选）
          </p>
          <div
            className="mt-1.5 flex cursor-pointer items-center justify-center gap-3 rounded-lg border-2 border-dashed border-black/10 px-4 py-4 text-sm text-slate-500 transition hover:border-brand-600/40 dark:border-white/10 dark:hover:border-brand-400/40"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              onFileChange(e.dataTransfer.files[0])
            }}
          >
            {file ? (
              <span className="truncate font-medium text-slate-700 dark:text-slate-300">{file.name}</span>
            ) : (
              <span>拖拽或点击上传 PDF 附件（最大 10MB）</span>
            )}
          </div>
          <input
            accept="application/pdf"
            className="hidden"
            onChange={(e) => onFileChange(e.target.files?.[0])}
            ref={fileInputRef}
            type="file"
          />
          {fileError && <p className="mt-1.5 text-xs text-red-500">{fileError}</p>}
        </div>

        {/* 错误提示 */}
        {error && <AlertMessage className="mt-4" message={error} variant="error" />}

        {/* 操作按钮 */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            className="rounded-lg border border-black/10 px-4 py-2.5 text-sm font-medium transition hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
            disabled={submitting}
            onClick={onCancel}
            type="button"
          >
            取消
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-55"
            disabled={submitting || note.trim().length < 5}
            onClick={onSubmit}
            type="button"
          >
            {submitting ? '提交中...' : '确认提交补充'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── 小工具组件 ─── */
function SectionTitle({ title }: { title: string }) {
  return (
    <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
      {title}
    </div>
  )
}

function ReportData({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-baseline gap-1.5 whitespace-nowrap">
      <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="max-w-48 truncate font-medium text-slate-800 dark:text-slate-200" title={value}>{value}</dd>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="w-20 shrink-0 text-slate-500 dark:text-slate-400">{label}</span>
      <span className="font-medium text-slate-800 dark:text-slate-200">{value}</span>
    </div>
  )
}

function MarkdownBlock({ content }: { content: string }) {
  return (
    <div className="mt-3 rounded-lg bg-[var(--app-panel-muted-bg)] p-4 text-sm leading-7 text-slate-700  dark:text-slate-300 whitespace-pre-wrap">
      {content || '（无内容）'}
    </div>
  )
}

function formatEventAction(action: string): string {
  const map: Record<string, string> = {
    SUBMIT_VULNERABILITY: '提交报告',
    SUPPLEMENT_MATERIALS: '补充材料',
    REVIEW_CONFIRM: '审核确认',
    REVIEW_NEEDS_SUPPLEMENT: '要求补充',
    REVIEW_REJECT: '审核拒绝',
    MARK_PENDING_RETEST: '标记复测',
    RETEST_PASS: '复测通过',
    RETURN_TO_FIX: '退回修复',
    ARCHIVE: '归档处理',
  }
  return map[action] ?? action
}
