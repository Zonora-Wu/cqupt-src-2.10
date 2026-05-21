import { AlertCircle, CheckCircle2, FileSignature, Loader2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  getCurrentResponsibilityAgreement,
  signCurrentResponsibilityAgreement,
  type AccessStatus,
  type ResponsibilityAgreement,
} from '../../services/access'

type Props = {
  open: boolean
  accessStatus?: AccessStatus | null
  onClose: () => void
  onSigned?: () => void | Promise<void>
}

const requiredReadSeconds = 60

export function ResponsibilityAgreementDialog({ accessStatus, onClose, onSigned, open }: Props) {
  const [agreement, setAgreement] = useState<ResponsibilityAgreement>(null)
  const [loading, setLoading] = useState(false)
  const [signing, setSigning] = useState(false)
  const [remainingSeconds, setRemainingSeconds] = useState(requiredReadSeconds)
  const [message, setMessage] = useState<{ text: string; type: 'error' | 'success' } | null>(null)

  useEffect(() => {
    if (!open) return

    let active = true
    setAgreement(null)
    setLoading(true)
    setMessage(null)
    setRemainingSeconds(requiredReadSeconds)

    getCurrentResponsibilityAgreement()
      .then((data) => {
        if (active) setAgreement(data)
      })
      .catch((error) => {
        if (active) {
          setMessage({ text: error instanceof Error ? error.message : '责任书加载失败', type: 'error' })
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    const timer = window.setInterval(() => {
      setRemainingSeconds((seconds) => Math.max(0, seconds - 1))
    }, 1000)

    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [open])

  if (!open || typeof document === 'undefined') return null

  const alreadySigned = Boolean(accessStatus?.responsibilitySigned)
  const signDisabled = loading || signing || !agreement || remainingSeconds > 0 || alreadySigned

  const handleSign = async () => {
    if (signDisabled) return

    try {
      setSigning(true)
      setMessage(null)
      await signCurrentResponsibilityAgreement(window.navigator.userAgent)
      setMessage({ text: '责任书已签署。', type: 'success' })
      await onSigned?.()
      window.setTimeout(onClose, 500)
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : '责任书签署失败，请稍后重试', type: 'error' })
    } finally {
      setSigning(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/35 px-4 py-6 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-black/10 bg-white shadow-2xl dark:border-white/10 dark:bg-[#131a15]">
        <div className="flex items-start justify-between gap-4 border-b border-black/10 p-5 dark:border-white/10">
          <div>
            <div className="flex items-center gap-2">
              <FileSignature className="h-5 w-5 text-brand-700 dark:text-green-300" />
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                {agreement?.title ?? 'CQUPT-SRC 授权测试责任书'}
              </h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              请完整阅读责任书内容。阅读倒计时结束后，才可以签署当前版本。
            </p>
          </div>
          <button
            aria-label="关闭"
            className="rounded-lg p-2 text-slate-500 transition hover:bg-black/5 dark:hover:bg-white/10"
            onClick={onClose}
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {message && (
          <div className={`mx-5 mt-4 flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${message.type === 'success' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-300'}`}>
            {message.type === 'success' ? <CheckCircle2 className="mt-0.5 h-4 w-4" /> : <AlertCircle className="mt-0.5 h-4 w-4" />}
            <span>{message.text}</span>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-sm text-slate-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              正在加载责任书...
            </div>
          ) : agreement ? (
            <article className="rounded-lg border border-black/10 bg-slate-50/80 p-5 text-sm leading-8 text-slate-700 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-200">
              <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="rounded-full bg-brand-600/10 px-2.5 py-1 font-medium text-brand-700 dark:text-green-300">
                  {agreement.version}
                </span>
                {agreement.publishedAt && <span>发布时间：{new Date(agreement.publishedAt).toLocaleString()}</span>}
              </div>
              <pre className="whitespace-pre-wrap break-words font-sans">{agreement.content}</pre>
            </article>
          ) : (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-5 text-sm text-amber-700 dark:text-amber-200">
              当前没有可签署的责任书，请联系管理员发布责任书后再继续。
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-black/10 p-5 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {alreadySigned
              ? '当前账号已签署责任书'
              : remainingSeconds > 0
                ? `请继续阅读 ${remainingSeconds} 秒后签署`
                : '已满足阅读时长，可以签署'}
          </p>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={signDisabled}
            onClick={() => void handleSign()}
            type="button"
          >
            {signing && <Loader2 className="h-4 w-4 animate-spin" />}
            {alreadySigned ? '已签署' : signing ? '签署中...' : remainingSeconds > 0 ? `${remainingSeconds}s 后可签署` : '签署责任书'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
