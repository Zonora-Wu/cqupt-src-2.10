import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Eye,
  Clock3,
  FileSearch,
  Filter,
  Paperclip,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { PageSection } from '../../components/layout/PageSection'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { SearchInput } from '../../components/ui/SearchInput'
import { SelectInput } from '../../components/ui/SelectInput'
import { SeverityBadge } from '../../components/ui/SeverityBadge'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { SurfacePanel } from '../../components/ui/SurfacePanel'
import {
  listMyVulnerabilities,
  openAttachmentPreview,
} from '../../services/vulnerabilities'
import type { MyVulnerabilityItem, MyVulnerabilityListResponse } from '../../services/vulnerabilities'

const statusOptions = ['全部状态', '草稿', '待审核', '审核中', '待补充', '已确认', '修复中', '已归档']
const levelOptions = ['全部等级', '严重', '高危', '中危', '低危', '信息']

export function UserMyVulnerabilities() {
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('全部状态')
  const [level, setLevel] = useState('全部等级')
  const [data, setData] = useState<MyVulnerabilityListResponse | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [previewingAttachmentId, setPreviewingAttachmentId] = useState<string | null>(null)

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
      { label: '累计提交', value: String(stats.total), hint: '漏洞报告', icon: FileSearch },
      { label: '待处理', value: String(stats.pending), hint: '审核或修复中', icon: Clock3 },
      { label: '已确认', value: String(stats.confirmed), hint: '通过审核', icon: ShieldCheck },
      { label: '需补充', value: String(stats.needSupplement), hint: '等待完善材料', icon: AlertTriangle },
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

      return matchesKeyword && matchesStatus && matchesLevel
    })
  }, [data?.items, keyword, level, status])

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

  return (
    <PageSection>
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <PageHeader
          eyebrow="My Reports"
          eyebrowIcon={<ShieldAlert className="h-3.5 w-3.5" />}
          title="我的漏洞"
          description="查看你提交的漏洞报告、审核状态、积分奖励和 AI 材料建议，按流程完成补充、复测与归档。"
        />
        <button
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-brand-700"
          onClick={() => void loadReports()}
          type="button"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          刷新列表
        </button>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        {vulnerabilityStats.map((item) => {
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
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px_180px_auto] lg:items-end">
          <SearchInput
            label="搜索漏洞"
            onChange={setKeyword}
            placeholder="输入漏洞编号、标题或影响资产"
            value={keyword}
          />
          <SelectInput label="审核状态" onChange={setStatus} options={statusOptions} value={status} />
          <SelectInput label="风险等级" onChange={setLevel} options={levelOptions} value={level} />
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

      <div className="mt-6 grid gap-5">
        {errorMessage && (
          <SurfacePanel className="border-red-500/20 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-200">
            {errorMessage}
          </SurfacePanel>
        )}

        {isLoading && (
          <SurfacePanel className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            正在加载你的漏洞报告...
          </SurfacePanel>
        )}

        {filteredVulnerabilities.map((item) => (
          <SurfacePanel className="p-5 transition hover:border-brand-600/25 hover:bg-white/85 dark:hover:bg-white/[0.055]" key={item.id}>
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{item.reportNo}</span>
                  <SeverityBadge level={(item.finalSeverity ?? item.selfSeverity) as import('../../utils/severity').SeverityLevel} />
                  <StatusBadge status={item.status as import('../../utils/vulnStatus').VulnStatus} />
                </div>
                <h2 className="mt-3 text-xl font-semibold tracking-tight">{item.title}</h2>
                <div className="mt-3 grid gap-2 text-sm text-slate-500 sm:grid-cols-2 dark:text-slate-400">
                  <p>影响资产：{item.assetName}</p>
                  <p>责任单位：{item.ownerUnit || '待确认'}</p>
                  <p>漏洞类型：{item.vulnerabilityType}</p>
                  <p>提交时间：{formatDateTime(item.submittedAt)}</p>
                  <p>最近更新：{formatDateTime(item.updatedAt)}</p>
                  <p>附件数量：{item.attachments.length}</p>
                </div>
              </div>

              <div className="rounded-lg border border-black/5 bg-black/[0.025] p-4 dark:border-white/10 dark:bg-white/[0.035]">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Sparkles className="h-4 w-4 text-brand-700 dark:text-green-300" />
                    AI 建议
                  </div>
                  <span className="text-sm font-semibold text-brand-700 dark:text-green-300">+{item.points}</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">{getReportHint(item)}</p>
              </div>
            </div>

            {item.attachments.length > 0 && (
              <div className="mt-5 rounded-lg border border-black/10 bg-white/45 p-4 dark:border-white/10 dark:bg-white/[0.035]">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                  <Paperclip className="h-4 w-4 text-brand-700 dark:text-green-300" />
                  PDF 附件
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {item.attachments.map((attachment) => (
                    <div
                      className="flex items-center justify-between gap-3 rounded-lg border border-black/5 bg-white/60 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/[0.045]"
                      key={attachment.id}
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{attachment.originalName}</p>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                          {formatFileSize(attachment.sizeBytes)} · {formatDateTime(attachment.uploadedAt)}
                        </p>
                      </div>
                      <button
                        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-black/10 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
                        disabled={previewingAttachmentId === attachment.id}
                        onClick={() => void handlePreviewAttachment(attachment.id)}
                        type="button"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        {previewingAttachmentId === attachment.id ? '打开中' : '预览'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-4 dark:border-white/10">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <CalendarClock className="h-4 w-4" />
                流程节点将根据审核员操作自动更新
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded-lg border border-black/10 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
                  type="button"
                >
                  查看详情
                </button>
                <button
                  className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
                  type="button"
                >
                  {item.status === '待补充' ? '补充材料' : '查看进度'}
                </button>
              </div>
            </div>
          </SurfacePanel>
        ))}

        {!isLoading && filteredVulnerabilities.length === 0 && (
          <EmptyState
            icon={<CheckCircle2 className="h-10 w-10" />}
            title="没有匹配的漏洞报告"
            description={data?.items.length ? '调整关键词或筛选条件后再试一次。' : '你还没有提交漏洞，可以先进入提交漏洞页面创建第一份报告。'}
          />
        )}
      </div>
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

function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024) return `${sizeBytes} B`
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`
  return `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`
}

function getReportHint(item: MyVulnerabilityItem) {
  if (item.lastEvent?.note) return item.lastEvent.note
  if (item.status === '待补充') return '审核员需要你补充材料，请根据反馈完善复现步骤或证明材料。'
  if (item.status === '待审核') return '报告已提交，等待审核员确认漏洞有效性与影响范围。'
  if (item.status === '审核中') return '审核员正在处理该报告，请保持附件和复现材料可访问。'
  if (item.status === '已确认') return '漏洞已确认有效，后续积分和证书会根据最终审核结果处理。'
  if (item.status === '修复中') return '漏洞进入修复或复测流程，请等待资产责任单位处理。'
  return '报告流程已归档，可在证书和积分页面查看后续结果。'
}
