import {
  Award,
  Ban,
  CalendarClock,
  CheckCircle2,
  Download,
  Eye,
  FileCheck2,
  FileText,
  Filter,
  Link2,
  Medal,
  ShieldCheck,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { PageHeader } from '../../components/ui/PageHeader'
import { SearchInput } from '../../components/ui/SearchInput'
import { SelectInput } from '../../components/ui/SelectInput'
import { SurfacePanel } from '../../components/ui/SurfacePanel'

type CertificateStatus = '待签发' | '已签发' | '待复核' | '已撤销'
type CertificateLevel = '严重' | '高危' | '中危' | '低危'

type AdminCertificate = {
  id: string
  vulnId: string
  vulnTitle: string
  recipient: string
  unifiedCode: string
  level: CertificateLevel
  type: '高价值漏洞证书' | '漏洞贡献证书' | '专项活动证书'
  status: CertificateStatus
  issueDate: string
  issuer: string
  verifyCode: string
  publicVerify: boolean
  asset: string
  owner: string
  archivedAt: string
  contribution: string
  records: Array<{
    action: string
    actor: string
    time: string
    note: string
  }>
}

const statusOptions = ['全部状态', '待签发', '已签发', '待复核', '已撤销']
const levelOptions = ['全部等级', '严重', '高危', '中危', '低危']
const typeOptions = ['全部类型', '高价值漏洞证书', '漏洞贡献证书', '专项活动证书']

const certificates: AdminCertificate[] = [
  {
    id: 'CERT-2026-0003',
    vulnId: 'SRC-2026-0008',
    vulnTitle: '统一认证入口弱口令策略绕过风险',
    recipient: '星火同学',
    unifiedCode: '2025001',
    level: '高危',
    type: '高价值漏洞证书',
    status: '待签发',
    issueDate: '未签发',
    issuer: '未签发',
    verifyCode: 'CQUPT-SRC-CERT-2026-0003',
    publicVerify: true,
    asset: 'auth.cqupt.edu.cn',
    owner: '信息化办公室',
    archivedAt: '待归档确认',
    contribution: '发现并提交统一认证相关高价值安全风险，协助学校完善账号安全治理能力。',
    records: [
      { action: '进入证书队列', actor: '审核员 A', time: '2026-04-27 16:12', note: '漏洞初步判定具有较高价值。' },
      { action: '等待签发', actor: '系统', time: '2026-04-27 16:13', note: '等待管理员确认信息并生成电子证书。' },
    ],
  },
  {
    id: 'CERT-2026-0002',
    vulnId: 'SRC-2026-0006',
    vulnTitle: '校园门户接口敏感信息返回过多',
    recipient: '青木同学',
    unifiedCode: '2025001',
    level: '中危',
    type: '漏洞贡献证书',
    status: '已签发',
    issueDate: '2026-04-26',
    issuer: '平台管理员',
    verifyCode: 'CQUPT-SRC-CERT-8F29A6',
    publicVerify: true,
    asset: 'portal.cqupt.edu.cn/api/user',
    owner: '信息化办公室',
    archivedAt: '2026-04-26 11:30',
    contribution: '规范提交接口敏感字段暴露问题，推动校园门户数据最小化治理。',
    records: [
      { action: '创建证书', actor: '审核员 B', time: '2026-04-26 13:40', note: '漏洞复测通过，进入证书签发流程。' },
      { action: '签发证书', actor: '平台管理员', time: '2026-04-26 14:05', note: '电子证书已签发，开启公开核验。' },
    ],
  },
  {
    id: 'CERT-2026-0001',
    vulnId: 'SRC-2026-0004',
    vulnTitle: '在线靶场资源下载链接未鉴权',
    recipient: '学生用户',
    unifiedCode: '2025001',
    level: '高危',
    type: '高价值漏洞证书',
    status: '待复核',
    issueDate: '2026-04-22',
    issuer: '平台管理员',
    verifyCode: 'CQUPT-SRC-CERT-51D7C2',
    publicVerify: true,
    asset: 'range.cqupt-src.edu.cn',
    owner: '网络安全学院',
    archivedAt: '2026-04-22 10:16',
    contribution: '发现靶场资源鉴权风险，协助完善学习资源访问控制。',
    records: [
      { action: '签发证书', actor: '平台管理员', time: '2026-04-22 12:20', note: '已生成电子证书。' },
      { action: '发起复核', actor: '审核员 C', time: '2026-04-24 09:18', note: '需要确认贡献说明表述。' },
    ],
  },
]

const levelClassMap: Record<CertificateLevel, string> = {
  严重: 'bg-red-600 text-white',
  高危: 'bg-orange-500 text-white',
  中危: 'bg-amber-500 text-white',
  低危: 'bg-slate-500 text-white',
}

const statusClassMap: Record<CertificateStatus, string> = {
  待签发: 'border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  已签发: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  待复核: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  已撤销: 'border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300',
}

function LevelBadge({ level }: { level: CertificateLevel }) {
  return <span className={`rounded-md px-2 py-1 text-xs font-medium ${levelClassMap[level]}`}>{level}</span>
}

function CertificateStatusBadge({ status }: { status: CertificateStatus }) {
  return <span className={`rounded-md border px-2 py-1 text-xs font-medium ${statusClassMap[status]}`}>{status}</span>
}

function escapePdfText(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function buildMinimalPdf(certificate: AdminCertificate) {
  const lines = [
    'CQUPT-SRC Certificate',
    `Certificate ID: ${certificate.id}`,
    `Holder: ${certificate.recipient}`,
    `Unified Code: ${certificate.unifiedCode}`,
    `Vulnerability ID: ${certificate.vulnId}`,
    `Issue Date: ${certificate.issueDate === '未签发' ? 'Pending' : certificate.issueDate}`,
    `Verify Code: ${certificate.verifyCode}`,
  ]

  const textCommands = lines
    .map((line, index) => `BT /F1 ${index === 0 ? 22 : 12} Tf 72 ${760 - index * 28} Td (${escapePdfText(line)}) Tj ET`)
    .join('\n')
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    `5 0 obj\n<< /Length ${textCommands.length} >>\nstream\n${textCommands}\nendstream\nendobj\n`,
  ]

  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object) => {
    offsets.push(pdf.length)
    pdf += object
  })
  const xrefOffset = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n`
  pdf += '0000000000 65535 f \n'
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  })
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`

  return pdf
}

function downloadCertificatePdf(certificate: AdminCertificate) {
  const pdf = buildMinimalPdf(certificate)
  const blob = new Blob([pdf], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${certificate.id}.pdf`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function AdminCertificateManagement() {
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('全部状态')
  const [level, setLevel] = useState('全部等级')
  const [type, setType] = useState('全部类型')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [previewCertificate, setPreviewCertificate] = useState<AdminCertificate | null>(null)
  const [issueCertificate, setIssueCertificate] = useState<AdminCertificate | null>(null)
  const [issueDone, setIssueDone] = useState(false)

  const filteredCertificates = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()

    return certificates.filter((item) => {
      const matchesKeyword =
        !normalizedKeyword ||
        item.id.toLowerCase().includes(normalizedKeyword) ||
        item.vulnId.toLowerCase().includes(normalizedKeyword) ||
        item.vulnTitle.toLowerCase().includes(normalizedKeyword) ||
        item.recipient.toLowerCase().includes(normalizedKeyword) ||
        item.verifyCode.toLowerCase().includes(normalizedKeyword)
      const matchesStatus = status === '全部状态' || item.status === status
      const matchesLevel = level === '全部等级' || item.level === level
      const matchesType = type === '全部类型' || item.type === type

      return matchesKeyword && matchesStatus && matchesLevel && matchesType
    })
  }, [keyword, level, status, type])

  const selectedCertificate = selectedId ? certificates.find((item) => item.id === selectedId) ?? null : null

  if (selectedCertificate) {
    return (
      <section className="relative z-10 mx-auto max-w-[1360px] px-5 pb-8 pt-24 md:px-8">
        <button
          className="inline-flex items-center gap-2 rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
          onClick={() => setSelectedId(null)}
          type="button"
        >
          <FileText className="h-4 w-4" />
          返回证书列表
        </button>

        <div className="mt-5 grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-6 xl:sticky xl:top-24 xl:self-start">
            <SurfacePanel className="p-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{selectedCertificate.id}</span>
                <LevelBadge level={selectedCertificate.level} />
                <CertificateStatusBadge status={selectedCertificate.status} />
              </div>
              <h1 className="mt-4 text-2xl font-semibold leading-snug">{selectedCertificate.type}</h1>
              <div className="mt-5 space-y-3 text-sm text-slate-600 dark:text-slate-400">
                <p>获得者：{selectedCertificate.recipient}</p>
                <p>统一认证码：{selectedCertificate.unifiedCode}</p>
                <p>关联漏洞：{selectedCertificate.vulnId}</p>
                <p>签发时间：{selectedCertificate.issueDate}</p>
                <p>签发人：{selectedCertificate.issuer}</p>
                <p>公开核验：{selectedCertificate.publicVerify ? '已开启' : '已关闭'}</p>
              </div>
            </SurfacePanel>

            <SurfacePanel className="p-4">
              <div className="grid gap-2">
                <button
                  className="rounded-lg bg-brand-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-700"
                  onClick={() => {
                    setIssueDone(false)
                    setIssueCertificate(selectedCertificate)
                  }}
                  type="button"
                >
                  签发证书
                </button>
                <button
                  className="rounded-lg border border-black/10 px-4 py-3 text-sm font-medium transition hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
                  onClick={() => setPreviewCertificate(selectedCertificate)}
                  type="button"
                >
                  预览证书
                </button>
                <button
                  className="rounded-lg border border-black/10 px-4 py-3 text-sm font-medium transition hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
                  onClick={() => downloadCertificatePdf(selectedCertificate)}
                  type="button"
                >
                  生成 PDF
                </button>
                <button className="rounded-lg border border-red-500/20 px-4 py-3 text-sm font-medium text-red-700 transition hover:bg-red-500/10 dark:text-red-300" type="button">
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
                <p>漏洞等级：{selectedCertificate.level}</p>
                <p>影响资产：{selectedCertificate.asset}</p>
                <p>责任单位：{selectedCertificate.owner}</p>
                <p className="md:col-span-2">漏洞标题：{selectedCertificate.vulnTitle}</p>
                <p>归档时间：{selectedCertificate.archivedAt}</p>
                <p>核验码：{selectedCertificate.verifyCode}</p>
              </div>
            </SurfacePanel>

            <SurfacePanel className="p-6">
              <h2 className="text-xl font-semibold">证书内容</h2>
              <div className="mt-5 rounded-lg border border-black/10 bg-black/[0.025] p-5 dark:border-white/10 dark:bg-white/[0.035]">
                <p className="text-sm leading-7 text-slate-600 dark:text-slate-400">{selectedCertificate.contribution}</p>
              </div>
            </SurfacePanel>

            <SurfacePanel className="p-6">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-brand-700 dark:text-green-300" />
                <h2 className="text-xl font-semibold">操作记录</h2>
              </div>
              <div className="mt-5 space-y-4">
                {selectedCertificate.records.map((record) => (
                  <div className="border-l border-brand-600/30 pl-4" key={`${record.action}-${record.time}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">{record.action}</p>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{record.time}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{record.actor}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{record.note}</p>
                  </div>
                ))}
              </div>
            </SurfacePanel>
          </div>
        </div>

        <CertificatePreviewModal certificate={previewCertificate} onClose={() => setPreviewCertificate(null)} />
        <IssueCertificateModal
          certificate={issueCertificate}
          done={issueDone}
          onClose={() => setIssueCertificate(null)}
          onConfirm={() => setIssueDone(true)}
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
            description="管理漏洞贡献证书的签发、预览、撤销与公开核验，证书 PDF 将作为电子证明在线发放。"
          />
        </div>

        <SurfacePanel className="relative z-30 mt-6 p-5">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_170px_160px_190px_auto] xl:items-end">
            <SearchInput
              label="搜索证书"
              onChange={setKeyword}
              placeholder="证书编号、漏洞编号、标题、获得者或核验码"
              value={keyword}
            />
            <SelectInput label="证书状态" onChange={setStatus} options={statusOptions} value={status} />
            <SelectInput label="漏洞等级" onChange={setLevel} options={levelOptions} value={level} />
            <SelectInput label="证书类型" onChange={setType} options={typeOptions} value={type} />
            <button
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-black/10 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
              onClick={() => {
                setKeyword('')
                setStatus('全部状态')
                setLevel('全部等级')
                setType('全部类型')
              }}
              type="button"
            >
              <Filter className="h-4 w-4" />
              重置
            </button>
          </div>
        </SurfacePanel>

        <div className="mt-6 grid gap-5">
          {filteredCertificates.map((item) => (
            <SurfacePanel className="p-5 transition hover:border-brand-600/25 hover:bg-white/85 dark:hover:bg-white/[0.055]" key={item.id}>
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{item.id}</span>
                    <LevelBadge level={item.level} />
                    <CertificateStatusBadge status={item.status} />
                  </div>
                  <h2 className="mt-3 text-xl font-semibold tracking-tight">{item.type}</h2>
                  <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-300">{item.vulnTitle}</p>
                  <div className="mt-4 grid gap-2 text-sm text-slate-500 sm:grid-cols-2 dark:text-slate-400">
                    <p>关联漏洞：{item.vulnId}</p>
                    <p>获得者：{item.recipient}</p>
                    <p>统一认证码：{item.unifiedCode}</p>
                    <p>签发时间：{item.issueDate}</p>
                    <p>签发人：{item.issuer}</p>
                    <p>公开核验：{item.publicVerify ? '已开启' : '未开启'}</p>
                  </div>
                </div>

                <div className="rounded-lg border border-black/5 bg-black/[0.025] p-4 dark:border-white/10 dark:bg-white/[0.035]">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <ShieldCheck className="h-4 w-4 text-brand-700 dark:text-green-300" />
                    证书信息
                  </div>
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-500 dark:text-slate-400">{item.contribution}</p>
                  <div className="mt-4 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <Link2 className="h-3.5 w-3.5" />
                    {item.verifyCode}
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-4 dark:border-white/10">
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <FileCheck2 className="h-4 w-4" />
                  证书操作将写入审计日志，PDF 作为线上电子证书发放
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
                    onClick={() => setPreviewCertificate(item)}
                    type="button"
                  >
                    预览证书
                  </button>
                  <button
                    className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
                    onClick={() => downloadCertificatePdf(item)}
                    type="button"
                  >
                    <Download className="h-4 w-4" />
                    生成 PDF
                  </button>
                  <button
                    className="inline-flex items-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
                    onClick={() => {
                      setIssueDone(false)
                      setIssueCertificate(item)
                    }}
                    type="button"
                  >
                    签发证书
                  </button>
                  <button
                    className="inline-flex items-center gap-2 rounded-lg border border-red-500/20 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-500/10 dark:text-red-300"
                    type="button"
                  >
                    <Ban className="h-4 w-4" />
                    撤销
                  </button>
                </div>
              </div>
            </SurfacePanel>
          ))}

          {filteredCertificates.length === 0 && (
            <SurfacePanel className="p-10 text-center">
              <Award className="mx-auto h-10 w-10 text-slate-400" />
              <h2 className="mt-4 text-xl font-semibold">没有匹配的证书记录</h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">调整关键词、证书状态或证书类型后再试一次。</p>
            </SurfacePanel>
          )}
        </div>
      </section>

      <CertificatePreviewModal certificate={previewCertificate} onClose={() => setPreviewCertificate(null)} />
      <IssueCertificateModal
        certificate={issueCertificate}
        done={issueDone}
        onClose={() => setIssueCertificate(null)}
        onConfirm={() => setIssueDone(true)}
      />
    </>
  )
}

function CertificatePreviewModal({
  certificate,
  onClose,
}: {
  certificate: AdminCertificate | null
  onClose: () => void
}) {
  if (!certificate) return null

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/35 px-5 backdrop-blur-sm">
      <SurfacePanel className="w-full max-w-[760px] overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-black/10 px-5 py-4 dark:border-white/10">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">证书预览</p>
            <h2 className="mt-1 text-xl font-semibold">{certificate.type}</h2>
          </div>
          <button
            aria-label="关闭证书预览"
            className="rounded-lg p-2 text-slate-500 transition hover:bg-black/5 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
            onClick={onClose}
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
            <p className="mt-2 text-2xl font-semibold">{certificate.recipient}</p>
            <p className="mx-auto mt-6 max-w-xl text-sm leading-7 text-slate-600 dark:text-slate-300">{certificate.contribution}</p>
            <div className="mt-8 grid gap-3 text-left text-sm text-slate-500 sm:grid-cols-2 dark:text-slate-400">
              <p>证书编号：{certificate.id}</p>
              <p>关联漏洞：{certificate.vulnId}</p>
              <p>签发日期：{certificate.issueDate}</p>
              <p>核验码：{certificate.verifyCode}</p>
            </div>
          </div>
          <div className="mt-5 flex justify-end">
            <button
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700"
              onClick={() => downloadCertificatePdf(certificate)}
              type="button"
            >
              <Download className="h-4 w-4" />
              生成 PDF
            </button>
          </div>
        </div>
      </SurfacePanel>
    </div>
  )
}

function IssueCertificateModal({
  certificate,
  done,
  onClose,
  onConfirm,
}: {
  certificate: AdminCertificate | null
  done: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  if (!certificate) return null

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/35 px-5 backdrop-blur-sm">
      <div className="w-full max-w-[620px] rounded-lg border border-black/10 bg-[#f7f9f7]/95 p-6 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-[#0f1511]/95">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-brand-700 dark:text-green-300">
              <Award className="h-5 w-5" />
              <span className="text-sm font-medium">Certificate Issue</span>
            </div>
            <h2 className="mt-2 text-2xl font-semibold">签发证书</h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              确认证书信息后签发，签发动作将写入审计日志。
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
          <div className="rounded-lg border border-black/10 bg-black/[0.025] p-4 dark:border-white/10 dark:bg-white/[0.035]">
            <p className="text-sm font-semibold">{certificate.type}</p>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{certificate.vulnTitle}</p>
            <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2 dark:text-slate-400">
              <p>获得者：{certificate.recipient}</p>
              <p>统一认证码：{certificate.unifiedCode}</p>
              <p>关联漏洞：{certificate.vulnId}</p>
              <p>公开核验：{certificate.publicVerify ? '开启' : '关闭'}</p>
            </div>
          </div>
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">贡献说明</span>
            <textarea
              className="mt-2 min-h-28 w-full resize-none rounded-lg border border-black/10 bg-white/70 px-3 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10 dark:bg-white/5 dark:text-white"
              defaultValue={certificate.contribution}
            />
          </label>
        </div>

        {done && (
          <div className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
            证书签发已确认。当前为前端模拟，后续接入后端后将生成正式记录与 PDF。
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
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700"
            onClick={onConfirm}
            type="button"
          >
            <CheckCircle2 className="h-4 w-4" />
            确认签发
          </button>
        </div>
      </div>
    </div>
  )
}
