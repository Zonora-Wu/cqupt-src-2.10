import { useEffect, useState } from 'react'

type FullScreenLoaderProps = {
  label?: string
  visible?: boolean
}

const EXIT_DURATION_MS = 260

export function FullScreenLoader({ label = '页面加载中', visible = true }: FullScreenLoaderProps) {
  const [mounted, setMounted] = useState(visible)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (visible) {
      setMounted(true)
      setLeaving(false)
      return
    }

    setLeaving(true)
    const timer = window.setTimeout(() => setMounted(false), EXIT_DURATION_MS)
    return () => window.clearTimeout(timer)
  }, [visible])

  if (!mounted) return null

  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className={`app-fullscreen-loader fixed inset-0 z-[100000] flex items-center justify-center bg-[var(--app-bg)] transition-opacity duration-[260ms] ${leaving ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
      role="status"
    >
      <span aria-hidden="true" className="app-fullscreen-loader__spinner" />
      <span className="sr-only">{label}</span>
    </div>
  )
}
