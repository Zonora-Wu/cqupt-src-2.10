import { AlertCircle, CheckCircle2, Info, X, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'

type AlertVariant = 'error' | 'info' | 'success' | 'warning'

type AlertMessageProps = {
  action?: ReactNode
  className?: string
  message: ReactNode
  onClose?: () => void
  title?: string
  variant?: AlertVariant
}

const variantStyles: Record<AlertVariant, string> = {
  error: 'border-red-500/20 bg-red-500/10 text-red-800 dark:border-red-300/15 dark:text-red-200',
  info: 'border-sky-500/20 bg-sky-500/10 text-sky-800 dark:border-sky-300/15 dark:text-sky-200',
  success: 'border-brand-600/20 bg-brand-600/10 text-brand-800 dark:border-green-300/15 dark:text-green-200',
  warning: 'border-amber-500/20 bg-amber-500/10 text-amber-800 dark:border-amber-300/15 dark:text-amber-200',
}

const iconMap: Record<AlertVariant, ReactNode> = {
  error: <AlertCircle className="h-4 w-4" />,
  info: <Info className="h-4 w-4" />,
  success: <CheckCircle2 className="h-4 w-4" />,
  warning: <TriangleAlert className="h-4 w-4" />,
}

export function AlertMessage({
  action,
  className = '',
  message,
  onClose,
  title,
  variant = 'info',
}: AlertMessageProps) {
  return (
    <div
      className={`rounded-lg border px-4 py-3 text-sm leading-6 shadow-sm shadow-black/[0.02] ${variantStyles[variant]} ${className}`}
      role={variant === 'error' || variant === 'warning' ? 'alert' : 'status'}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0">{iconMap[variant]}</span>
        <div className="min-w-0 flex-1">
          {title && <p className="font-semibold">{title}</p>}
          <div className={title ? 'mt-0.5' : ''}>{message}</div>
          {action && <div className="mt-2">{action}</div>}
        </div>
        {onClose && (
          <button
            aria-label="关闭提示"
            className="-mr-1 rounded-md p-1 opacity-70 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}
