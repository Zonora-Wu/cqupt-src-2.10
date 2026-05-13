import { Check, ChevronsRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createSliderChallenge, verifySliderChallenge, type CaptchaPurpose, type CaptchaTrackPoint, type SliderChallenge } from '../../services/captcha'

export type SlideVerifyMode = 'local' | 'server'

export type SlideVerifyLabels = Partial<{
  ariaReady: string
  ariaVerified: string
  dragHandle: string
  loading: string
  ready: string
  resetHandle: string
  verified: string
  verifying: string
}>

export type SlideVerifyResult = {
  mode: SlideVerifyMode
  token: string
  verified: true
}

type SlideVerifyProps = {
  className?: string
  completeThreshold?: number
  disabled?: boolean
  labels?: SlideVerifyLabels
  mode?: SlideVerifyMode
  onChange?: (verified: boolean) => void
  onError?: (message: string) => void
  onVerify?: (result: SlideVerifyResult) => void
  onTokenChange?: (token: string) => void
  purpose?: CaptchaPurpose
  resetKey?: number | string
}

const HANDLE_WIDTH = 40
const DEFAULT_COMPLETE_THRESHOLD = 0.92
const defaultLabels: Required<SlideVerifyLabels> = {
  ariaReady: '向右滑动完成验证',
  ariaVerified: '滑块验证已完成',
  dragHandle: '拖动滑块验证',
  loading: '正在加载验证...',
  ready: '向右滑动完成验证',
  resetHandle: '重置滑块验证',
  verified: '验证完成',
  verifying: '正在校验...',
}

export function SlideVerify({
  className = '',
  completeThreshold = DEFAULT_COMPLETE_THRESHOLD,
  disabled = false,
  labels,
  mode = 'local',
  onChange,
  onError,
  onVerify,
  onTokenChange,
  purpose = 'REGISTER_EMAIL_CODE',
  resetKey,
}: SlideVerifyProps) {
  const trackRef = useRef<HTMLDivElement | null>(null)
  const trackStartRef = useRef<{ startTime: number; rect: DOMRect } | null>(null)
  const trackPointsRef = useRef<CaptchaTrackPoint[]>([])
  const lastResetKeyRef = useRef(resetKey)
  const [dragging, setDragging] = useState(false)
  const [offset, setOffset] = useState(0)
  const [verified, setVerified] = useState(false)
  const [challenge, setChallenge] = useState<SliderChallenge | null>(null)
  const [loading, setLoading] = useState(mode === 'server')
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState('')
  const copy = { ...defaultLabels, ...labels }

  useEffect(() => {
    onChange?.(verified)
  }, [onChange, verified])

  useEffect(() => {
    if (mode !== 'server') return

    void refreshChallenge()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, purpose])

  useEffect(() => {
    if (resetKey === undefined || resetKey === lastResetKeyRef.current) return
    lastResetKeyRef.current = resetKey
    reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey])

  const maxOffset = getMaxOffset(trackRef.current)
  const progress = maxOffset > 0 ? offset / maxOffset : 0

  const updateByClientX = (clientX: number, clientY?: number) => {
    const track = trackRef.current
    if (!track || verified || disabled) return

    const rect = track.getBoundingClientRect()
    const nextOffset = clamp(clientX - rect.left - HANDLE_WIDTH / 2, 0, getMaxOffset(track))
    setOffset(nextOffset)
    collectTrackPoint(nextOffset, clientY, rect)
  }

  const completeOrReset = async () => {
    const track = trackRef.current
    if (!track || verified) return

    const nextProgress = getMaxOffset(track) > 0 ? offset / getMaxOffset(track) : 0

    if (nextProgress >= completeThreshold) {
      const finalOffset = getMaxOffset(track)
      setOffset(finalOffset)
      collectTrackPoint(finalOffset, undefined, track.getBoundingClientRect())
      if (mode === 'server') {
        setDragging(false)
        await verifyWithServer()
        return
      }
      setVerified(true)
      onVerify?.({ mode, token: '', verified: true })
    } else {
      setOffset(0)
    }
    setDragging(false)
  }

  const reset = () => {
    setDragging(false)
    setOffset(0)
    setVerified(false)
    setError('')
    onTokenChange?.('')
    if (mode === 'server') {
      void refreshChallenge()
    }
  }

  async function refreshChallenge() {
    setLoading(true)
    setError('')
    setVerified(false)
    setOffset(0)
    onTokenChange?.('')
    try {
      const nextChallenge = await createSliderChallenge(purpose)
      setChallenge(nextChallenge)
    } catch (challengeError) {
      const message = challengeError instanceof Error ? challengeError.message : '滑块验证加载失败'
      setError(message)
      onError?.(message)
    } finally {
      setLoading(false)
    }
  }

  async function verifyWithServer() {
    if (!challenge) {
      setOffset(0)
      await refreshChallenge()
      return
    }

    setVerifying(true)
    setError('')
    try {
      const result = await verifySliderChallenge({
        challengeId: challenge.challengeId,
        offsetRatio: challenge.answerHintRatio,
        purpose,
        track: trackPointsRef.current,
      })
      setOffset(getMaxOffset(trackRef.current))
      setVerified(true)
      onTokenChange?.(result.captchaToken)
      onVerify?.({ mode, token: result.captchaToken, verified: true })
    } catch (verifyError) {
      const message = verifyError instanceof Error ? verifyError.message : '滑块验证失败'
      setError(message)
      onError?.(message)
      setOffset(0)
      trackPointsRef.current = []
    } finally {
      setVerifying(false)
    }
  }

  function collectTrackPoint(nextOffset: number, clientY: number | undefined, rect: DOMRect) {
    if (!dragging || !trackStartRef.current) return
    const maxOffset = getMaxOffset(trackRef.current)
    if (maxOffset <= 0) return

    trackPointsRef.current.push({
      x: clamp(nextOffset / maxOffset, 0, 1),
      y: clientY === undefined ? 0 : clamp((clientY - rect.top) / Math.max(rect.height, 1), -2, 2),
      t: Math.round(performance.now() - trackStartRef.current.startTime),
    })
  }

  return (
    <div className={className}>
      <div
        aria-label={verified ? copy.ariaVerified : copy.ariaReady}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={Math.round(progress * 100)}
        className={`relative flex h-10 touch-none items-center overflow-hidden rounded-lg border transition ${
          verified
            ? 'border-brand-600/30 bg-brand-600/10 dark:border-brand-300/25 dark:bg-brand-300/10'
            : 'border-black/10 bg-white/95 dark:border-white/10 dark:bg-white/5'
        }`}
        ref={trackRef}
        role="slider"
      >
        <div
          className={`absolute bottom-0 left-0 top-0 bg-brand-600/15 dark:bg-brand-300/15 ${dragging ? '' : 'transition-[width] duration-150'}`}
          style={{ width: verified ? '100%' : `${Math.max(HANDLE_WIDTH, offset + HANDLE_WIDTH)}px` }}
        />
        <div className="pointer-events-none w-full select-none text-center text-xs font-medium text-slate-500 dark:text-white/45">
          {loading ? copy.loading : verifying ? copy.verifying : verified ? copy.verified : copy.ready}
        </div>
        <button
          aria-label={verified ? copy.resetHandle : copy.dragHandle}
          className={`absolute bottom-0 left-0 top-0 z-10 flex w-10 items-center justify-center border-r border-white/20 text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
            verified ? 'bg-brand-700 dark:bg-brand-500' : 'bg-brand-600 hover:brightness-110'
          }`}
          disabled={disabled || loading || verifying || (mode === 'server' && !challenge)}
          onClick={() => {
            if (verified) reset()
          }}
          onPointerDown={(event) => {
            if (verified || disabled || loading || verifying) return
            event.currentTarget.setPointerCapture(event.pointerId)
            const rect = trackRef.current?.getBoundingClientRect()
            if (rect) {
              trackStartRef.current = { rect, startTime: performance.now() }
            }
            trackPointsRef.current = [{ x: 0, y: 0, t: 0 }]
            setDragging(true)
            updateByClientX(event.clientX, event.clientY)
          }}
          onPointerMove={(event) => {
            if (!dragging) return
            updateByClientX(event.clientX, event.clientY)
          }}
          onPointerUp={() => void completeOrReset()}
          onPointerCancel={() => void completeOrReset()}
          style={{
            transform: `translateX(${offset}px)`,
            transition: dragging ? 'none' : 'transform 180ms ease',
          }}
          type="button"
        >
          {verified ? <Check className="h-5 w-5" /> : <ChevronsRight className="h-5 w-5" />}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-300">{error}</p>}
    </div>
  )
}

function getMaxOffset(element: HTMLElement | null) {
  return Math.max((element?.clientWidth ?? HANDLE_WIDTH) - HANDLE_WIDTH, 0)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}
