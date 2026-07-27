import { CheckCircle2, FileSearch, Search, ShieldCheck, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { FloatingNotice, type FloatingNoticeVariant } from '../../components/ui/FloatingNotice'
import { publicVerifyCertificate, type PublicCertificateVerifyResult } from '../../services/certificates'

type CertificateVerifyProps = {
  initialCertificateNo?: string
  queryNonce?: number
}

export function CertificateVerify({ initialCertificateNo = '', queryNonce = 0 }: CertificateVerifyProps) {
  const [certificateNo, setCertificateNo] = useState(initialCertificateNo)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PublicCertificateVerifyResult | null>(null)
  const [notice, setNotice] = useState<{ message: string; variant: FloatingNoticeVariant } | null>(null)

  useEffect(() => {
    const normalized = initialCertificateNo.trim()
    if (!normalized) return
    setCertificateNo(normalized)
    void searchCertificate(normalized)
  }, [initialCertificateNo, queryNonce])

  async function searchCertificate(nextCertificateNo = certificateNo) {
    const normalized = nextCertificateNo.trim()
    setResult(null)
    setNotice(null)

    if (!normalized) {
      setNotice({ message: '请输入证书编号后再查询。', variant: 'warning' })
      return
    }

    setLoading(true)
    try {
      const nextResult = await publicVerifyCertificate(normalized)
      setResult(nextResult)
      setNotice({ message: `公开查询成功。该证书累计公开查询 ${nextResult.publicVerifyCount} 次。`, variant: 'success' })
    } catch (error) {
      setNotice({
        message: error instanceof Error ? error.message : '查询失败，请稍后重试。',
        variant: 'error',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="relative z-10 flex min-h-[calc(100vh-4rem)] flex-col justify-center px-5 py-24 md:px-8">
      {notice && (
        <FloatingNotice
          message={notice.message}
          onClose={() => setNotice(null)}
          variant={notice.variant}
        />
      )}

      <motion.section
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-4xl text-center"
        initial={{ opacity: 0, y: 22 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">验证漏洞贡献证书</h1>
        <p className="mx-auto mt-6 max-w-3xl text-base leading-8 text-slate-600 dark:text-slate-400 md:text-lg">
          输入证书编号，查询 CQUPT-SRC 颁发的漏洞贡献证书真实性。公开查询仅展示证书状态和脱敏信息，不公开任何漏洞细节。
        </p>
      </motion.section>

      <motion.section
        animate={{ opacity: 1, y: 0 }}
        className="guest-palette-item mx-auto mt-14 w-full max-w-3xl rounded-lg border border-black/10 bg-[var(--app-panel-bg)] p-6 backdrop-blur-xl dark:border-white/10"
        initial={{ opacity: 0, y: 24 }}
        transition={{ delay: 0.16, duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      >
        <label className="mb-3 block text-sm font-medium text-slate-700 dark:text-slate-300">证书编号</label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full rounded-lg border border-black/10 bg-[var(--app-panel-muted-bg)] py-3 pl-11 pr-3 font-mono text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10 dark:text-white dark:placeholder:text-slate-600"
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
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-[0_10px_24px_rgba(var(--app-primary-rgb),0.24)] disabled:cursor-not-allowed disabled:opacity-60"
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
          <span className="font-mono">查询成功后显示该证书累计公开查询次数</span>
        </div>
      </motion.section>

      <AnimatePresence>
      {result && (
        <motion.div
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/35 px-5 py-8 backdrop-blur-sm"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          transition={{ duration: 0.28 }}
        >
          <motion.article
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-2xl overflow-hidden rounded-lg border border-black/10 bg-[var(--app-menu-bg)] shadow-2xl backdrop-blur-xl dark:border-white/10"
            exit={{ opacity: 0, scale: 0.98, y: 10 }}
            initial={{ opacity: 0, scale: 0.97, y: 16 }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="border-b border-black/10 px-6 py-5 dark:border-white/10">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium text-brand-700 dark:text-brand-300">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    证书核验有效
                  </div>
                  <h2 className="mt-2 break-all font-mono text-lg font-semibold">{result.certificateNo}</h2>
                </div>
                <button
                  aria-label="关闭证书核验结果"
                  className="rounded-lg p-2 text-slate-500 transition hover:bg-black/5 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
                  onClick={() => setResult(null)}
                  type="button"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <span className="mt-4 inline-flex w-fit items-center gap-2 rounded-lg border border-brand-600/20 bg-brand-600/10 px-3 py-1 text-sm text-brand-700 dark:text-brand-300">
                <ShieldCheck className="h-4 w-4" />
                {result.status}
              </span>
            </div>

            <dl className="grid gap-0 sm:grid-cols-2">
              <ResultField label="获得者" value={result.recipientName} />
              <ResultField label="统一认证码" value={result.unifiedCode} />
              <ResultField label="签发日期" value={formatDate(result.issuedAt)} />
              <ResultField label="关联漏洞编号" value={result.vulnerability.reportNo} />
              <ResultField label="漏洞等级" value={result.vulnerability.finalSeverity ?? '未公开'} />
              <ResultField label="查询次数" value={`该证书累计公开查询 ${result.publicVerifyCount} 次`} />
            </dl>

            <div className="border-t border-black/10 px-6 py-4 text-xs leading-6 text-slate-500 dark:border-white/10 dark:text-slate-400">
              公开核验仅展示证书真实性与脱敏信息，不公开漏洞细节或证书 PDF。
            </div>
          </motion.article>
        </motion.div>
      )}
      </AnimatePresence>
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
