import { Check, ChevronsRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

type SlideVerifyProps = {
  onChange?: (verified: boolean) => void
}

const HANDLE_WIDTH = 40
const COMPLETE_THRESHOLD = 0.92

export function SlideVerify({ onChange }: SlideVerifyProps) {
  const trackRef = useRef<HTMLDivElement | null>(null)
  const [dragging, setDragging] = useState(false)
  const [offset, setOffset] = useState(0)
  const [verified, setVerified] = useState(false)

  useEffect(() => {
    onChange?.(verified)
  }, [onChange, verified])

  const maxOffset = getMaxOffset(trackRef.current)
  const progress = maxOffset > 0 ? offset / maxOffset : 0

  const updateByClientX = (clientX: number) => {
    const track = trackRef.current
    if (!track || verified) return

    const rect = track.getBoundingClientRect()
    const nextOffset = clamp(clientX - rect.left - HANDLE_WIDTH / 2, 0, getMaxOffset(track))
    setOffset(nextOffset)
  }

  const completeOrReset = () => {
    const track = trackRef.current
    if (!track || verified) return

    const nextProgress = getMaxOffset(track) > 0 ? offset / getMaxOffset(track) : 0
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
  }

  return (
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
      <div className="pointer-events-none w-full select-none text-center text-xs font-medium text-slate-500 dark:text-white/45">
        {verified ? '验证完成' : '向右滑动完成验证'}
      </div>
      <button
        aria-label={verified ? '重置滑块验证' : '拖动滑块验证'}
        className={`absolute bottom-0 left-0 top-0 z-10 flex w-10 items-center justify-center border-r border-white/20 text-white transition ${
          verified ? 'bg-brand-700 dark:bg-brand-500' : 'bg-brand-600 hover:brightness-110'
        }`}
        onClick={() => {
          if (verified) reset()
        }}
        onPointerDown={(event) => {
          if (verified) return
          event.currentTarget.setPointerCapture(event.pointerId)
          setDragging(true)
          updateByClientX(event.clientX)
        }}
        onPointerMove={(event) => {
          if (!dragging) return
          updateByClientX(event.clientX)
        }}
        onPointerUp={completeOrReset}
        onPointerCancel={completeOrReset}
        style={{
          transform: `translateX(${offset}px)`,
          transition: dragging ? 'none' : 'transform 180ms ease',
        }}
        type="button"
      >
        {verified ? <Check className="h-5 w-5" /> : <ChevronsRight className="h-5 w-5" />}
      </button>
    </div>
  )
}

function getMaxOffset(element: HTMLElement | null) {
  return Math.max((element?.clientWidth ?? HANDLE_WIDTH) - HANDLE_WIDTH, 0)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}
