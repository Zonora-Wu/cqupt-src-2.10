import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'

type NavigatorPerformanceHints = Navigator & {
  connection?: { saveData?: boolean }
  deviceMemory?: number
}

export type GraphicsPerformanceProfile = {
  maxDpr: number
  targetFps: 30 | 60
}

export function getGraphicsPerformanceProfile(): GraphicsPerformanceProfile {
  if (typeof navigator === 'undefined') return { maxDpr: 1.75, targetFps: 60 }

  const hints = navigator as NavigatorPerformanceHints
  const constrained = Boolean(
    hints.connection?.saveData
    || (typeof hints.deviceMemory === 'number' && hints.deviceMemory <= 4)
    || navigator.hardwareConcurrency <= 4,
  )

  return constrained
    ? { maxDpr: 1.25, targetFps: 30 }
    : { maxDpr: 1.75, targetFps: 60 }
}

export function AdaptiveFrameScheduler({ active, fps }: { active: boolean; fps: 30 | 60 }) {
  const invalidate = useThree((state) => state.invalidate)

  useEffect(() => {
    if (!active || fps === 60) return
    const timer = window.setInterval(invalidate, 1000 / fps)
    invalidate()
    return () => window.clearInterval(timer)
  }, [active, fps, invalidate])

  return null
}
