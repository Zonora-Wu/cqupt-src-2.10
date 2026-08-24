import { AlertTriangle, CheckCircle2, Info, TriangleAlert, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { PlatformNoticeVariant } from '../../services/platformNotice'

type FloatingNoticeProps = {
  action?: ReactNode
  autoCloseMs?: number
  className?: string
  message: ReactNode
  onClose?: () => void
  title?: string
  variant?: PlatformNoticeVariant
}

const variantStyles: Record<PlatformNoticeVariant, { background: string; border: string; color: string }> = {
  error: {
    background: 'color-mix(in srgb, var(--app-danger-soft) 94%, var(--app-menu-bg))',
    border: 'color-mix(in srgb, var(--app-danger) 32%, transparent)',
    color: 'var(--app-danger-text)',
  },
  info: {
    background: 'color-mix(in srgb, var(--app-info-soft) 94%, var(--app-menu-bg))',
    border: 'color-mix(in srgb, var(--app-info) 32%, transparent)',
    color: 'var(--app-info-text)',
  },
  success: {
    background: 'color-mix(in srgb, var(--app-success-soft) 94%, var(--app-menu-bg))',
    border: 'color-mix(in srgb, var(--app-success) 32%, transparent)',
    color: 'var(--app-success-text)',
  },
  warning: {
    background: 'color-mix(in srgb, var(--app-warning-soft) 94%, var(--app-menu-bg))',
    border: 'color-mix(in srgb, var(--app-warning) 32%, transparent)',
    color: 'var(--app-warning-text)',
  },
}

const iconMap: Record<PlatformNoticeVariant, ReactNode> = {
  error: <AlertTriangle className="h-4 w-4" />,
  info: <Info className="h-4 w-4" />,
  success: <CheckCircle2 className="h-4 w-4" />,
  warning: <TriangleAlert className="h-4 w-4" />,
}

// Internal renderer. Feature code should call platformNotice or use AlertMessage.
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
        className={`pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-2xl backdrop-blur-xl ${className}`}
        role={variant === 'error' || variant === 'warning' ? 'alert' : 'status'}
        style={{
          backgroundColor: variantStyles[variant].background,
          borderColor: variantStyles[variant].border,
          color: variantStyles[variant].color,
        }}
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
