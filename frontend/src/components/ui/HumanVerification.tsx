import 'altcha'
import 'altcha/i18n/zh-cn'
import 'altcha/altcha.css'
import { Loader2, ShieldCheck, X } from 'lucide-react'
import { createElement, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { getHumanVerificationChallengeUrl, type HumanVerificationPurpose } from '../../services/humanVerification'

export type HumanVerificationProps = {
  compact?: boolean
  disabled?: boolean
  helperText?: string
  onChange: (payload: string) => void
  onError?: (message: string) => void
  purpose: HumanVerificationPurpose
  resetKey?: string | number
  title?: string
}

type AltchaWidgetElement = HTMLElement & {
  reset?: () => void
  verify?: () => Promise<{ payload?: string } | null>
}

type AltchaEvent = Event & {
  detail?: {
    payload?: string
    state?: string
  }
}

const altchaLogoUrl = '/assets/logos/ALTCHA_logo.png'

export function HumanVerification({
  disabled = false,
  helperText,
  onChange,
  onError,
  purpose,
  resetKey,
  title = '安全校验',
}: HumanVerificationProps) {
  const widgetRef = useRef<AltchaWidgetElement | null>(null)
  const onChangeRef = useRef(onChange)
  const [status, setStatus] = useState<'ready' | 'verified' | 'verifying' | 'error'>('ready')
  const [verificationIsSlow, setVerificationIsSlow] = useState(false)
  const [challengeKey, setChallengeKey] = useState(0)
  const [open, setOpen] = useState(false)
  const challengeUrl = useMemo(() => getHumanVerificationChallengeUrl(purpose), [purpose])
  const configuration = useMemo(
    () =>
      JSON.stringify({
        hideFooter: true,
        hideLogo: true,
        minDuration: 650,
        timeout: 30_000,
      }),
    [],
  )
  const workers = useMemo(() => {
    if (typeof window === 'undefined') return 2
    const navigatorWithMemory = window.navigator as Navigator & { deviceMemory?: number }
    const cores = navigatorWithMemory.hardwareConcurrency || 2
    const memory = navigatorWithMemory.deviceMemory
    if (cores <= 2 || (memory !== undefined && memory <= 2)) return 1
    if (cores <= 4 || (memory !== undefined && memory <= 4)) return 2
    return 3
  }, [])

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    if (!open) return
    const widget = widgetRef.current
    if (!widget) return

    const handleVerified = (event: Event) => {
      const payload = (event as AltchaEvent).detail?.payload
      if (payload) {
        setStatus('verified')
        setVerificationIsSlow(false)
        onChangeRef.current(payload)
        window.setTimeout(() => setOpen(false), 420)
      }
    }
    const handleStateChange = (event: Event) => {
      const state = (event as AltchaEvent).detail?.state
      if (state === 'verifying') {
        setStatus('verifying')
        setVerificationIsSlow(false)
      }
      if (state === 'error' || state === 'expired') {
        setStatus('error')
        setVerificationIsSlow(false)
        onChangeRef.current('')
        onError?.('安全校验未完成，请重新验证')
      }
    }

    widget.addEventListener('verified', handleVerified)
    widget.addEventListener('statechange', handleStateChange)
    return () => {
      widget.removeEventListener('verified', handleVerified)
      widget.removeEventListener('statechange', handleStateChange)
    }
  }, [onError, open])

  useEffect(() => {
    if (status !== 'verifying') return
    const timer = window.setTimeout(() => setVerificationIsSlow(true), 4_000)
    return () => window.clearTimeout(timer)
  }, [status])

  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (!active) return
      widgetRef.current?.reset?.()
      onChangeRef.current('')
      setStatus('ready')
      setVerificationIsSlow(false)
      setOpen(false)
      setChallengeKey((value) => value + 1)
    })
    return () => {
      active = false
    }
  }, [resetKey])

  const helper =
    status === 'verified'
      ? '校验已完成，本次操作可继续。'
      : status === 'verifying'
        ? verificationIsSlow
          ? '设备性能不同，计算可能稍久，请保持此窗口开启。'
          : '正在进行轻量安全计算，通常几秒内完成。'
        : status === 'error'
          ? '校验未完成，请点击重新验证。'
          : helperText ?? '点击后将在设备本地完成轻量安全计算。'

  const statusLabel =
    status === 'verified'
      ? '已通过'
      : status === 'verifying'
        ? '计算中'
        : status === 'error'
          ? '需重试'
          : '待校验'

  const StatusIcon = status === 'verifying' ? Loader2 : status === 'error' ? ShieldCheck : null
  const openVerification = () => {
    if (disabled) return
    if (status === 'error') {
      setChallengeKey((value) => value + 1)
    }
    setOpen(true)
  }
  const closeVerification = () => {
    setOpen(false)
    if (status === 'verifying') {
      setStatus('ready')
      setVerificationIsSlow(false)
      onChangeRef.current('')
      setChallengeKey((value) => value + 1)
    }
  }

  return (
    <>
      <button
        className={`flex w-full items-center justify-between gap-3 rounded-lg border border-black/10 bg-[var(--app-panel-bg)] p-3 text-left shadow-sm transition hover:border-brand-600/35 hover:bg-white/85 dark:border-white/10 dark:hover:border-brand-300/35 dark:hover:bg-white/[0.07] ${
        disabled ? 'pointer-events-none opacity-55' : ''
      }`}
        disabled={disabled}
        onClick={openVerification}
        type="button"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center ${
            status === 'error' ? 'text-red-600 dark:text-red-300' : 'text-brand-700 dark:text-brand-300'
          }`}>
            {StatusIcon ? (
              <StatusIcon className={`h-4 w-4 ${status === 'verifying' ? 'animate-spin' : ''}`} />
            ) : (
              <img alt="" className="h-7 w-7 object-contain" src={altchaLogoUrl} />
            )}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-slate-900 dark:text-white">{title}</span>
          </span>
        </span>
        <span className={`shrink-0 rounded-md border px-2 py-1 text-[11px] font-medium ${
          status === 'verified'
            ? 'border-emerald-500/15 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
            : 'border-black/10 bg-white/70 text-slate-600 dark:border-white/10 dark:bg-white/10 dark:text-slate-300'
        }`}>
          {statusLabel}
        </span>
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm dark:bg-black/70">
          <div className="w-full max-w-[420px] rounded-lg border border-black/10 bg-[var(--app-menu-bg)] p-6 text-slate-950 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:text-white">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <img
                  alt="ALTCHA 安全认证"
                  className="h-11 w-11 shrink-0 object-contain"
                  src={altchaLogoUrl}
                />
                <div className="min-w-0">
                  <h2 className="text-base font-semibold">ALTCHA {title}</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                    系统将在当前设备完成少量计算，不采集行为轨迹，通常几秒内完成。
                  </p>
                </div>
              </div>
              <button
                aria-label="关闭安全校验"
                className="rounded-md p-1.5 text-slate-500 transition hover:bg-black/5 hover:text-slate-950 dark:hover:bg-white/10 dark:hover:text-white"
                onClick={closeVerification}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 rounded-lg border border-black/10 bg-white/70 p-4 dark:border-white/10 dark:bg-black/20">
              {createElement('altcha-widget', {
                auto: 'onload',
                challenge: challengeUrl,
                configuration,
                key: `${purpose}-${challengeKey}`,
                language: 'zh-cn',
                name: `human-verification-${purpose}`,
                ref: widgetRef,
                type: 'checkbox',
                workers: String(workers),
              } as Record<string, unknown>)}
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
              <span>{helper}</span>
              <span>CQUPT-SRC</span>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
