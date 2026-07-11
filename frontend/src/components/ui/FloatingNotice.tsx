import { AlertTriangle, CheckCircle2, Info, TriangleAlert, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export type FloatingNoticeVariant = 'error' | 'info' | 'success' | 'warning'

type FloatingNoticeProps = {
  action?: ReactNode
  autoCloseMs?: number
  className?: string
  message: ReactNode
  onClose?: () => void
  title?: string
  variant?: FloatingNoticeVariant
}

const variantStyles: Record<FloatingNoticeVariant, string> = {
  error: 'border-red-500/20 bg-red-50/95 text-red-700 dark:bg-red-950/80 dark:text-red-300',
  info: 'border-sky-500/20 bg-sky-50/95 text-sky-700 dark:bg-sky-950/80 dark:text-sky-300',
  success: 'border-emerald-500/20 bg-emerald-50/95 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300',
  warning: 'border-amber-500/20 bg-amber-50/95 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300',
}

const iconMap: Record<FloatingNoticeVariant, ReactNode> = {
  error: <AlertTriangle className="h-4 w-4" />,
  info: <Info className="h-4 w-4" />,
  success: <CheckCircle2 className="h-4 w-4" />,
  warning: <TriangleAlert className="h-4 w-4" />,
}

export function FloatingNotice({
  action,
  autoCloseMs = 6400,
  className = '',
  message,
  onClose,
  title,
  variant = 'info',
}: FloatingNoticeProps) {
  const [visible, setVisible] = useState(Boolean(message))
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    let active = true

    if (!message) {
      queueMicrotask(() => {
        if (active) setVisible(false)
      })
      return () => {
        active = false
      }
    }

    queueMicrotask(() => {
      if (active) setVisible(true)
    })
    if (autoCloseMs <= 0) {
      return () => {
        active = false
      }
    }

    const timer = window.setTimeout(() => {
      setVisible(false)
      onCloseRef.current?.()
    }, autoCloseMs)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [autoCloseMs, message])

  if (!message || !visible || typeof document === 'undefined') return null

  const close = () => {
    setVisible(false)
    onCloseRef.current?.()
  }

  return createPortal(
    <div className="pointer-events-none fixed left-1/2 top-[4.75rem] z-[2147483647] w-[min(520px,calc(100vw-40px))] -translate-x-1/2">
      <div
        className={`pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-2xl backdrop-blur-xl ${variantStyles[variant]} ${className}`}
        role={variant === 'error' || variant === 'warning' ? 'alert' : 'status'}
      >
        <span className="mt-0.5 shrink-0">{iconMap[variant]}</span>
        <div className="min-w-0 flex-1 leading-5">
          {title && <p className="font-semibold">{title}</p>}
          <div className={title ? 'mt-0.5' : ''}>{message}</div>
          {action && <div className="mt-2">{action}</div>}
        </div>
        <button
          aria-label="关闭提示"
          className="-mr-1 shrink-0 rounded-md p-1 opacity-70 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
          onClick={close}
          type="button"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>,
    document.body,
  )
}
