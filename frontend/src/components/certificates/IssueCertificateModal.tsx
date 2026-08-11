import { Award, CheckCircle2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { AlertMessage } from '../ui/AlertMessage'
import { issueCertificate } from '../../services/certificates'

export type IssueCertificateTarget = {
  contribution: string
  publicVerify: boolean
  recipient: string
  unifiedCode: string
  vulnerabilityId: string
  vulnId: string
  vulnTitle: string
  type?: string
}

type IssueCertificateModalProps = {
  certificate: IssueCertificateTarget | null
  onClose: () => void
  onIssued: () => Promise<void> | void
}

export function IssueCertificateModal({ certificate, onClose, onIssued }: IssueCertificateModalProps) {
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
            <h2 className="mt-2 text-2xl font-semibold">发放证书</h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              确认后将生成正式证书记录和 PDF，并写入漏洞事件与审计日志。
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
            <p className="text-sm font-semibold">{certificate.type ?? '漏洞贡献证书'}</p>
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
            <span className="ml-2 text-xs text-slate-400">已按平台证书模板填充，可在发放前微调</span>
            <textarea
              className="mt-2 min-h-28 w-full resize-none rounded-lg border border-black/10 bg-[var(--app-panel-bg)] px-3 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10  dark:text-white"
              maxLength={1000}
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
          <AlertMessage message={error} onClose={() => setError('')} variant="error" />
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
            {submitting ? '发放中...' : '确认发放'}
          </button>
        </div>
      </div>
    </div>
  )
}
