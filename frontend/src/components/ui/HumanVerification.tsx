import 'altcha'
import 'altcha/i18n/zh-cn'
import 'altcha/altcha.css'
import { ShieldCheck } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { getHumanVerificationChallengeUrl, type HumanVerificationPurpose } from '../../services/humanVerification'

type HumanVerificationProps = {
  compact?: boolean
  disabled?: boolean
  onChange: (payload: string) => void
  onError?: (message: string) => void
  purpose: HumanVerificationPurpose
  resetKey?: string | number
}

type AltchaWidgetElement = HTMLElement & {
  configure?: (config: Record<string, unknown>) => Promise<void>
  reset?: () => void
  verify?: () => Promise<{ payload?: string } | null>
}

type AltchaEvent = Event & {
  detail?: {
    payload?: string
    state?: string
  }
}

export function HumanVerification({
  compact = false,
  disabled = false,
  onChange,
  onError,
  purpose,
  resetKey,
}: HumanVerificationProps) {
  const widgetRef = useRef<AltchaWidgetElement | null>(null)
  const [status, setStatus] = useState<'ready' | 'verified' | 'verifying' | 'error'>('ready')
  const [challengeKey, setChallengeKey] = useState(0)
  const configuration = useMemo(
    () => ({
      auto: 'off',
      challenge: getHumanVerificationChallengeUrl(purpose),
      hideFooter: true,
      hideLogo: true,
      language: 'zh-cn',
      minDuration: 450,
      name: `human-verification-${purpose}`,
      timeout: 90_000,
      type: 'checkbox',
      workers: Math.max(1, Math.min(4, window.navigator.hardwareConcurrency || 2)),
    }),
    [purpose, challengeKey],
  )

  useEffect(() => {
    const widget = widgetRef.current
    if (!widget) return

    widget.configure?.(configuration)
    widget.reset?.()
    onChange('')
    setStatus('ready')
  }, [configuration, onChange])

  useEffect(() => {
    const widget = widgetRef.current
    if (!widget) return

    const handleVerified = (event: Event) => {
      const payload = (event as AltchaEvent).detail?.payload
      if (payload) {
        setStatus('verified')
        onChange(payload)
      }
    }
    const handleStateChange = (event: Event) => {
      const state = (event as AltchaEvent).detail?.state
      if (state === 'verifying') setStatus('verifying')
      if (state === 'error') {
        setStatus('error')
        onChange('')
        onError?.('安全校验未通过，请刷新校验后重试')
      }
    }

    widget.addEventListener('verified', handleVerified)
    widget.addEventListener('statechange', handleStateChange)
    return () => {
      widget.removeEventListener('verified', handleVerified)
      widget.removeEventListener('statechange', handleStateChange)
    }
  }, [onChange, onError])

  useEffect(() => {
    widgetRef.current?.reset?.()
    onChange('')
    setStatus('ready')
    setChallengeKey((value) => value + 1)
  }, [resetKey, onChange])

  const helper =
    status === 'verified'
      ? '校验已完成，本次操作可继续。'
      : status === 'verifying'
        ? '正在计算一次性安全证明。'
        : status === 'error'
          ? '校验失败，请重新尝试。'
          : '点击后将生成一次性安全证明。'

  return (
    <div
      className={`rounded-lg border border-black/10 bg-[var(--app-panel-bg)] p-3 shadow-sm dark:border-white/10 ${
        disabled ? 'pointer-events-none opacity-55' : ''
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-500/12 text-emerald-600 dark:bg-emerald-300/12 dark:text-emerald-300">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">安全校验</p>
            {!compact && <p className="truncate text-xs text-slate-500 dark:text-white/45">{helper}</p>}
          </div>
        </div>
        <span className="shrink-0 rounded-md border border-emerald-500/15 bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-200">
          ALTCHA
        </span>
      </div>
      <altcha-widget ref={widgetRef} />
    </div>
  )
}
