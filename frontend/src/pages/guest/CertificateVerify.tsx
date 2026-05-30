import { Award, CheckCircle2, FileSearch, Search, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { publicVerifyCertificate, type PublicCertificateVerifyResult } from '../../services/certificates'

type CertificateVerifyProps = {
  initialCertificateNo?: string
  queryNonce?: number
}

const QUERY_COUNT_KEY = 'cqupt-src-public-certificate-query-count'

export function CertificateVerify({ initialCertificateNo = '', queryNonce = 0 }: CertificateVerifyProps) {
  const [certificateNo, setCertificateNo] = useState(initialCertificateNo)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PublicCertificateVerifyResult | null>(null)
  const [message, setMessage] = useState('')
  const [queryCount, setQueryCount] = useState(() => readQueryCount())

  useEffect(() => {
    const normalized = initialCertificateNo.trim()
    if (!normalized) return
    setCertificateNo(normalized)
    void searchCertificate(normalized)
  }, [initialCertificateNo, queryNonce])

  async function searchCertificate(nextCertificateNo = certificateNo) {
    const normalized = nextCertificateNo.trim()
    setResult(null)
    setMessage('')

    if (!normalized) {
      setMessage('请输入证书编号后再查询。')
      return
    }

    setLoading(true)
    try {
      const nextResult = await publicVerifyCertificate(normalized)
      const nextCount = incrementQueryCount()
      setQueryCount(nextCount)
      setResult(nextResult)
      setMessage(`公开查询成功。本浏览器累计查询 ${nextCount} 次。`)
    } catch (error) {
      const nextCount = incrementQueryCount()
      setQueryCount(nextCount)
      setMessage(error instanceof Error ? `${error.message}。本浏览器累计查询 ${nextCount} 次。` : `查询失败。本浏览器累计查询 ${nextCount} 次。`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="relative z-10 flex min-h-[calc(100vh-4rem)] flex-col justify-center px-5 py-24 md:px-8">
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

      <section className="mx-auto mt-14 w-full max-w-3xl rounded-lg border border-black/10 bg-white/70 p-6 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.035]">
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

        <div className="mt-4 flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between dark:text-slate-400">
          <span>公开查询仅展示脱敏信息，不公开漏洞细节或证书 PDF。</span>
          <span className="font-mono">本浏览器累计查询 {queryCount} 次</span>
        </div>
      </section>

      {(message || result) && (
        <section className="mx-auto mt-6 w-full max-w-3xl">
          {message && (
            <div className="rounded-lg border border-black/10 bg-white/60 px-4 py-3 text-sm text-slate-600 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-300">
              {message}
            </div>
          )}

          {result && (
            <article className="mt-4 overflow-hidden rounded-lg border border-black/10 bg-white/75 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.045]">
              <div className="border-b border-black/10 px-6 py-5 dark:border-white/10">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-brand-700 dark:text-green-300">
                      <CheckCircle2 className="h-4 w-4" />
                      证书核验有效
                    </div>
                    <h2 className="mt-2 break-all font-mono text-lg font-semibold">{result.certificateNo}</h2>
                  </div>
                  <span className="inline-flex w-fit items-center gap-2 rounded-lg border border-brand-600/20 bg-brand-600/10 px-3 py-1 text-sm text-brand-700 dark:text-green-300">
                    <ShieldCheck className="h-4 w-4" />
                    {result.status}
                  </span>
                </div>
              </div>

              <dl className="grid gap-0 sm:grid-cols-2">
                <ResultField label="获得者" value={result.recipientName} />
                <ResultField label="统一认证码" value={result.unifiedCode} />
                <ResultField label="签发日期" value={formatDate(result.issuedAt)} />
                <ResultField label="关联漏洞编号" value={result.vulnerability.reportNo} />
                <ResultField label="漏洞等级" value={result.vulnerability.finalSeverity ?? '未公开'} />
                <ResultField label="查询次数" value={`本浏览器累计 ${queryCount} 次`} />
              </dl>
            </article>
          )}
        </section>
      )}
    </main>
  )
}

function ResultField({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-black/5 px-6 py-4 last:border-b-0 sm:border-r sm:odd:border-r dark:border-white/5">
      <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="mt-1 break-all text-sm font-medium text-slate-900 dark:text-white">{value}</dd>
    </div>
  )
}

function formatDate(value: string | null) {
  if (!value) return '未公开'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '未公开'
  return date.toLocaleDateString('zh-CN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function readQueryCount() {
  try {
    const raw = window.localStorage.getItem(QUERY_COUNT_KEY)
    const value = raw ? Number.parseInt(raw, 10) : 0
    return Number.isFinite(value) && value > 0 ? value : 0
  } catch {
    return 0
  }
}

function incrementQueryCount() {
  const next = readQueryCount() + 1
  try {
    window.localStorage.setItem(QUERY_COUNT_KEY, String(next))
  } catch {
    // Ignore storage failures; the in-memory count still updates for this render.
  }
  return next
}
