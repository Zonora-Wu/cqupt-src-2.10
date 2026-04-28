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
import { useMemo, useState } from 'react'
import { PageSection } from '../../components/layout/PageSection'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { SearchInput } from '../../components/ui/SearchInput'
import { SelectInput } from '../../components/ui/SelectInput'
import { SeverityBadge } from '../../components/ui/SeverityBadge'
import { SurfacePanel } from '../../components/ui/SurfacePanel'
import type { SeverityLevel } from '../../utils/severity'

const statusOptions = ['全部状态', '已签发', '已归档']

const certStatusStyles: Record<string, string> = {
  已签发: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  已归档: 'border-black/10 bg-black/[0.035] text-slate-600 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300',
}

const certificateStats = [
  { label: '证书总数', value: '2', hint: '已获得贡献证明', icon: Award },
  { label: '已签发', value: '2', hint: '可下载证书', icon: ShieldCheck },
  { label: '电子证书', value: '2', hint: '线上发放保存', icon: CalendarClock },
  { label: '可公开查询', value: '2', hint: '支持编号核验', icon: FileCheck2 },
]

const certificates = [
  {
    id: 'CERT-CQUPT-SRC-2026-0002',
    vulnerabilityId: 'SRC-2026-0006',
    title: '校园门户接口敏感信息返回过多',
    level: '中危',
    contribution: '有效漏洞贡献证书',
    holder: '学生用户',
    issuedAt: '2026-04-26',
    status: '已签发',
    queryCode: 'CQUPT-SRC-CERT-8F29A6',
    description: '该证书用于证明提交者在校园网络资产安全治理中发现并规范提交了有效漏洞。',
  },
  {
    id: 'CERT-CQUPT-SRC-2026-0001',
    vulnerabilityId: 'SRC-2026-0004',
    title: '在线靶场资源下载链接未鉴权',
    level: '高危',
    contribution: '高价值漏洞贡献证书',
    holder: '学生用户',
    issuedAt: '2026-04-22',
    status: '已签发',
    queryCode: 'CQUPT-SRC-CERT-51D7C2',
    description: '该证书用于证明提交者发现了较高价值安全风险，并完成了报告、复测与归档流程。',
  },
]



export function UserCertificates() {
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('全部状态')
  const [queryCode, setQueryCode] = useState('')
  const [queryResult, setQueryResult] = useState<(typeof certificates)[number] | null>(null)
  const [queryTouched, setQueryTouched] = useState(false)
  const [queryOpen, setQueryOpen] = useState(false)
  const [previewCertificate, setPreviewCertificate] = useState<(typeof certificates)[number] | null>(null)

  const filteredCertificates = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()

    return certificates.filter((item) => {
      const matchesKeyword =
        !normalizedKeyword ||
        item.id.toLowerCase().includes(normalizedKeyword) ||
        item.vulnerabilityId.toLowerCase().includes(normalizedKeyword) ||
        item.title.toLowerCase().includes(normalizedKeyword) ||
        item.queryCode.toLowerCase().includes(normalizedKeyword)
      const matchesStatus = status === '全部状态' || item.status === status

      return matchesKeyword && matchesStatus
    })
  }, [keyword, status])

  const searchCertificate = () => {
    const normalizedCode = queryCode.trim().toLowerCase()
    setQueryTouched(true)
    setQueryResult(
      certificates.find(
        (item) =>
          item.id.toLowerCase() === normalizedCode ||
          item.queryCode.toLowerCase() === normalizedCode ||
          item.vulnerabilityId.toLowerCase() === normalizedCode,
      ) ?? null,
    )
  }

  return (
    <PageSection>
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <PageHeader
          eyebrow="My Certificates"
          eyebrowIcon={<Medal className="h-3.5 w-3.5" />}
          title="我的证书"
          description="查看漏洞贡献证书、下载电子证明，并通过证书编号、查询码或漏洞编号完成公开核验。"
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
                  输入证书编号、查询码或关联漏洞编号，核验证书是否由 CQUPT-SRC 签发。
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
                  if (event.key === 'Enter') searchCertificate()
                }}
                placeholder="证书编号 / 查询码 / 漏洞编号"
                value={queryCode}
              />
              <button
                className="rounded-lg bg-brand-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-700"
                onClick={searchCertificate}
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
                    <p className="mt-2 text-sm font-medium">{queryResult.contribution}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{queryResult.id}</p>
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
        {filteredCertificates.map((item) => (
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
                    <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Vulnerability Certificate</p>
                  </div>
                </div>
              </div>

              <div className="p-5">
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_260px]">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{item.id}</span>
                      <SeverityBadge level={item.level as SeverityLevel} />
                      <span className={`rounded-md border px-2 py-1 text-xs font-medium ${certStatusStyles[item.status]}`}>
                        {item.status}
                      </span>
                    </div>
                    <h2 className="mt-3 text-xl font-semibold tracking-tight">{item.contribution}</h2>
                    <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-300">{item.title}</p>
                    <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">{item.description}</p>
                    <div className="mt-4 grid gap-2 text-sm text-slate-500 sm:grid-cols-2 dark:text-slate-400">
                      <p>关联漏洞：{item.vulnerabilityId}</p>
                      <p>获得者：{item.holder}</p>
                      <p>签发日期：{item.issuedAt}</p>
                      <p>查询码：{item.queryCode}</p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-black/5 bg-black/[0.025] p-4 dark:border-white/10 dark:bg-white/[0.035]">
                    <p className="text-sm font-medium">证书操作</p>
                    <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                      证书为线上电子证书，可在线预览、下载保存，并通过查询码公开核验。
                    </p>
                    <div className="mt-4 grid gap-2">
                      <button
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-brand-600/20 bg-brand-600/10 px-3 py-2 text-sm font-medium text-brand-800 transition hover:bg-brand-600/15 dark:text-green-300"
                        onClick={() => setPreviewCertificate(item)}
                        type="button"
                      >
                        <Eye className="h-4 w-4" />
                        预览证书
                      </button>
                      <button
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
                        type="button"
                      >
                        <Download className="h-4 w-4" />
                        下载证书
                      </button>
                      <button
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
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
        ))}

        {filteredCertificates.length === 0 && (
          <EmptyState
            icon={<CheckCircle2 className="h-10 w-10" />}
            title="没有匹配的证书"
            description="调整关键词或证书状态后再试一次。"
          />
        )}
      </div>

      {previewCertificate && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 px-5 backdrop-blur-sm">
          <SurfacePanel className="w-full max-w-[720px] overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-black/10 px-5 py-4 dark:border-white/10">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">证书预览</p>
                <h2 className="mt-1 text-xl font-semibold">{previewCertificate.contribution}</h2>
              </div>
              <button
                aria-label="关闭证书预览"
                className="rounded-lg p-2 text-slate-500 transition hover:bg-black/5 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
                onClick={() => setPreviewCertificate(null)}
                type="button"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="rounded-lg border border-brand-600/20 bg-gradient-to-br from-emerald-50 via-white to-amber-50 p-8 text-center shadow-sm dark:border-green-300/15 dark:from-emerald-950/35 dark:via-white/[0.06] dark:to-amber-950/25">
                <p className="text-xs font-medium uppercase tracking-[0.24em] text-brand-700 dark:text-green-300">CQUPT-SRC</p>
                <h3 className="mt-5 text-3xl font-semibold tracking-tight">漏洞贡献证书</h3>
                <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">授予</p>
                <p className="mt-2 text-2xl font-semibold">{previewCertificate.holder}</p>
                <p className="mx-auto mt-6 max-w-xl text-sm leading-7 text-slate-600 dark:text-slate-300">
                  因其在校园网络资产安全治理中规范提交
                  <span className="font-semibold text-slate-900 dark:text-white"> {previewCertificate.title} </span>
                  并完成有效漏洞响应流程，特颁发此电子证书。
                </p>
                <div className="mt-8 grid gap-3 text-left text-sm text-slate-500 sm:grid-cols-2 dark:text-slate-400">
                  <p>证书编号：{previewCertificate.id}</p>
                  <p>关联漏洞：{previewCertificate.vulnerabilityId}</p>
                  <p>签发日期：{previewCertificate.issuedAt}</p>
                  <p>查询码：{previewCertificate.queryCode}</p>
                </div>
              </div>
            </div>
          </SurfacePanel>
        </div>
      )}
    </PageSection>
  )
}
