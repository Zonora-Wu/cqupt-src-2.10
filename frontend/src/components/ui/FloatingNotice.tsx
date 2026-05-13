import { AlertTriangle, CheckCircle2, Info, TriangleAlert, X } from 'lucide-react'
import type { ReactNode } from 'react'

export type FloatingNoticeVariant = 'error' | 'info' | 'success' | 'warning'

type FloatingNoticeProps = {
  message: ReactNode
  onClose: () => void
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

export function FloatingNotice({ message, onClose, variant = 'info' }: FloatingNoticeProps) {
  if (!message) return null

  return (
    <div className="pointer-events-none fixed right-5 top-24 z-[120] w-[min(360px,calc(100vw-40px))]">
      <div
        className={`pointer-events-auto flex items-center gap-3 rounded-lg border px-4 py-3 text-sm shadow-2xl ${variantStyles[variant]}`}
        role={variant === 'error' || variant === 'warning' ? 'alert' : 'status'}
      >
        <span className="shrink-0">{iconMap[variant]}</span>
        <p className="min-w-0 flex-1 leading-5">{message}</p>
        <button
          aria-label="关闭提示"
          className="shrink-0 rounded-md p-1 opacity-70 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
          onClick={onClose}
          type="button"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
