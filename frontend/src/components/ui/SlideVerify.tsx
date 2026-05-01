import { Check, ChevronsRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createSliderChallenge, verifySliderChallenge, type CaptchaPurpose, type CaptchaTrackPoint, type SliderChallenge } from '../../services/captcha'

type SlideVerifyProps = {
  mode?: 'local' | 'server'
  onChange?: (verified: boolean) => void
  onError?: (message: string) => void
  onTokenChange?: (token: string) => void
  purpose?: CaptchaPurpose
}

const HANDLE_WIDTH = 40
const COMPLETE_THRESHOLD = 0.92

export function SlideVerify({
  mode = 'local',
  onChange,
  onError,
  onTokenChange,
  purpose = 'REGISTER_EMAIL_CODE',
}: SlideVerifyProps) {
  const trackRef = useRef<HTMLDivElement | null>(null)
  const trackStartRef = useRef<{ startTime: number; rect: DOMRect } | null>(null)
  const trackPointsRef = useRef<CaptchaTrackPoint[]>([])
  const [dragging, setDragging] = useState(false)
  const [offset, setOffset] = useState(0)
  const [verified, setVerified] = useState(false)
  const [challenge, setChallenge] = useState<SliderChallenge | null>(null)
  const [loading, setLoading] = useState(mode === 'server')
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    onChange?.(verified)
  }, [onChange, verified])

  useEffect(() => {
    if (mode !== 'server') return

    void refreshChallenge()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, purpose])

  const maxOffset = getMaxOffset(trackRef.current)
  const progress = maxOffset > 0 ? offset / maxOffset : 0

  const updateByClientX = (clientX: number, clientY?: number) => {
    const track = trackRef.current
    if (!track || verified) return

    const rect = track.getBoundingClientRect()
    const nextOffset = clamp(clientX - rect.left - HANDLE_WIDTH / 2, 0, getMaxOffset(track))
    setOffset(nextOffset)
    collectTrackPoint(nextOffset, clientY, rect)
  }

  const completeOrReset = async () => {
    const track = trackRef.current
    if (!track || verified) return

    const nextProgress = getMaxOffset(track) > 0 ? offset / getMaxOffset(track) : 0

    if (mode === 'server') {
      setDragging(false)
      await verifyWithServer(nextProgress)
      return
    }

    if (nextProgress >= COMPLETE_THRESHOLD) {
      const finalOffset = getMaxOffset(track)
      setOffset(finalOffset)
      setVerified(true)
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

  async function verifyWithServer(offsetRatio: number) {
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
        offsetRatio,
        purpose,
        track: trackPointsRef.current,
      })
      setOffset(challenge.answerHintRatio * getMaxOffset(trackRef.current))
      setVerified(true)
      onTokenChange?.(result.captchaToken)
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

  const targetLeft =
    mode === 'server' && challenge && maxOffset > 0
      ? `${Math.min(Math.max(challenge.answerHintRatio * maxOffset + HANDLE_WIDTH / 2, HANDLE_WIDTH), maxOffset + HANDLE_WIDTH / 2)}px`
      : undefined

  return (
    <div>
      <div
        aria-label={verified ? '滑块验证已完成' : '向右滑动完成验证'}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={Math.round(progress * 100)}
        className={`relative flex h-10 touch-none items-center overflow-hidden rounded-lg border transition ${
          verified
            ? 'border-brand-600/30 bg-brand-600/10 dark:border-brand-300/25 dark:bg-brand-300/10'
            : 'border-black/10 bg-white/70 dark:border-white/10 dark:bg-white/5'
        }`}
        ref={trackRef}
        role="slider"
      >
        <div
          className={`absolute bottom-0 left-0 top-0 bg-brand-600/15 dark:bg-brand-300/15 ${dragging ? '' : 'transition-[width] duration-150'}`}
          style={{ width: verified ? '100%' : `${Math.max(HANDLE_WIDTH, offset + HANDLE_WIDTH)}px` }}
        />
        {targetLeft && !verified && (
          <div
            className="pointer-events-none absolute top-1/2 h-6 w-1 -translate-y-1/2 rounded-full bg-brand-600/40 shadow-[0_0_16px_rgba(42,100,56,0.35)] dark:bg-brand-300/50"
            style={{ left: targetLeft }}
          />
        )}
        <div className="pointer-events-none w-full select-none text-center text-xs font-medium text-slate-500 dark:text-white/45">
          {loading ? '正在加载验证...' : verifying ? '正在校验...' : verified ? '验证完成' : mode === 'server' ? '拖动滑块对准标记' : '向右滑动完成验证'}
        </div>
        <button
          aria-label={verified ? '重置滑块验证' : '拖动滑块验证'}
          className={`absolute bottom-0 left-0 top-0 z-10 flex w-10 items-center justify-center border-r border-white/20 text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
            verified ? 'bg-brand-700 dark:bg-brand-500' : 'bg-brand-600 hover:brightness-110'
          }`}
          disabled={loading || verifying || (mode === 'server' && !challenge)}
          onClick={() => {
            if (verified) reset()
          }}
          onPointerDown={(event) => {
            if (verified || loading || verifying) return
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
