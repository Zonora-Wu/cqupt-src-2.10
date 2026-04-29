import { Award, CheckCircle2, FileSearch, LockKeyhole, Search, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { publicVerifyCertificate } from '../../services/certificates'
import type { PublicCertificateVerifyResult } from '../../services/certificates'

const visibleFields = ['证书编号', '获得者脱敏信息', '证书类型', '贡献等级', '颁发日期', '证书状态']
const hiddenFields = ['漏洞 URL', '复现步骤', '附件内容', '审核备注', '敏感资产信息', '内部处置记录']

export function CertificateVerify() {
  const [certificateNo, setCertificateNo] = useState('')
  const [result, setResult] = useState<PublicCertificateVerifyResult | null>(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function searchCertificate() {
    setMessage('')
    setResult(null)
    setLoading(true)
    try {
      const data = await publicVerifyCertificate(certificateNo)
      setResult(data)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '证书查询失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="relative z-10 mx-auto max-w-6xl px-5 pb-24 pt-44 md:px-8 md:pt-48">
      <section className="mx-auto max-w-4xl text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-lg border border-brand-600/20 bg-brand-600/10 px-3 py-1 text-sm font-medium text-brand-700 dark:text-green-300">
          <Award className="h-4 w-4" />
          证书查询
        </div>
        <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">验证漏洞贡献证书</h1>
        <p className="mx-auto mt-6 max-w-3xl text-base leading-8 text-slate-600 dark:text-slate-400 md:text-lg">
          输入证书编号，查询 CQUPT-SRC 颁发的漏洞贡献证书真实性。公开查询仅展示证书状态和脱敏信息，不公开任何漏洞细节。
        </p>
      </section>

      <section className="mx-auto mt-14 max-w-3xl rounded-lg border border-black/10 bg-white/70 p-6 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.035]">
        <label className="mb-3 block text-sm font-medium text-slate-700 dark:text-slate-300">证书编号</label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full rounded-lg border border-black/10 bg-white/80 py-3 pl-11 pr-3 font-mono text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10 dark:bg-black/20 dark:text-white dark:placeholder:text-slate-600"
              onChange={(event) => setCertificateNo(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void searchCertificate()
              }}
              placeholder="CQUPT-SRC-CERT-2026-XXXXXX"
              type="text"
              value={certificateNo}
            />
          </div>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading}
            onClick={() => void searchCertificate()}
            type="button"
          >
            <FileSearch className="h-4 w-4" />
            {loading ? '查询中...' : '查询证书'}
          </button>
        </div>
        <p className="mt-4 text-xs leading-5 text-slate-500">公开查询仅返回脱敏后的证书核验信息。</p>
        {message && (
          <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {message}
          </div>
        )}
        {result && (
          <div className="mt-5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-5 text-left">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-semibold">证书有效</span>
            </div>
            <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2 dark:text-slate-300">
              <p>证书编号：{result.certificateNo}</p>
              <p>获得者：{result.recipientName}</p>
              <p>统一认证码：{result.unifiedCode}</p>
              <p>颁发日期：{formatDate(result.issuedAt)}</p>
              <p>漏洞编号：{result.vulnerability.reportNo}</p>
              <p>最终等级：{result.vulnerability.finalSeverity ?? '未公开'}</p>
              <p className="sm:col-span-2">贡献标题：{result.vulnerability.title}</p>
            </div>
          </div>
        )}
      </section>

      <section className="mt-14 grid gap-6 lg:grid-cols-2">
        <article className="rounded-lg border border-black/10 bg-white/70 p-7 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.035]">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-brand-600/20 bg-brand-600/10 text-brand-700 dark:text-green-300">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-semibold">公开展示内容</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {visibleFields.map((item) => (
              <div className="rounded-lg border border-black/10 bg-white/80 p-3 text-sm dark:border-white/10 dark:bg-black/20" key={item}>
                {item}
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-lg border border-red-500/20 bg-red-500/5 p-7 backdrop-blur-xl">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 text-red-500 dark:text-red-300">
              <LockKeyhole className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-semibold">不会公开内容</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {hiddenFields.map((item) => (
              <div className="rounded-lg border border-red-500/15 bg-white/60 p-3 text-sm dark:bg-black/20" key={item}>
                {item}
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="mt-14 rounded-lg border border-brand-600/20 bg-brand-600/10 p-6 text-brand-900 dark:text-brand-100">
        <div className="flex gap-3">
          <ShieldCheck className="mt-1 h-5 w-5 shrink-0" />
          <p className="leading-7">
            若查询结果显示证书已作废，请以平台最新状态为准。证书可用于证明贡献事实，但不得用于公开传播漏洞细节或引导非授权测试。
          </p>
        </div>
      </section>
    </main>
  )
}

function formatDate(value: string | null) {
  if (!value) return '未公开'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleDateString('zh-CN')
}
