import { X } from 'lucide-react'
import { type ReactNode, useEffect, useId } from 'react'
import { createPortal } from 'react-dom'

type PlatformDialogProps = {
  actions?: ReactNode
  children: ReactNode
  description?: ReactNode
  dismissible?: boolean
  maxWidth?: 'lg' | '3xl' | '5xl'
  onClose: () => void
  title: string
}

const widthClass = {
  lg: 'sm:max-w-lg',
  '3xl': 'sm:max-w-3xl',
  '5xl': 'sm:max-w-5xl',
} as const

export function PlatformDialog({
  actions,
  children,
  description,
  dismissible = true,
  maxWidth = '3xl',
  onClose,
  title,
}: PlatformDialogProps) {
  const titleId = useId()

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const handleKeyDown = (event: KeyboardEvent) => {
      if (dismissible && event.key === 'Escape') onClose()
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [dismissible, onClose])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/35 p-0 backdrop-blur-sm sm:p-5"
      onMouseDown={(event) => {
        if (dismissible && event.target === event.currentTarget) onClose()
      }}
      role="presentation"
    >
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className={`flex h-full w-full flex-col overflow-hidden bg-[var(--app-surface)] text-slate-950 shadow-2xl dark:text-white sm:h-auto sm:max-h-[88vh] ${widthClass[maxWidth]} sm:rounded-lg sm:border sm:border-black/10 dark:sm:border-white/10`}
        role="dialog"
      >
        <header className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-black/10 px-4 py-4 dark:border-white/10 sm:flex-nowrap sm:gap-5 sm:px-6">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold" id={titleId}>{title}</h2>
            {description && <div className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</div>}
          </div>
          <div className="ml-auto flex max-w-full shrink-0 flex-wrap items-center justify-end gap-2">
            {actions}
            {dismissible && (
              <button
                aria-label={`关闭${title}`}
                className="grid h-9 w-9 place-items-center rounded-md text-slate-500 transition hover:bg-black/5 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
                onClick={onClose}
                type="button"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </header>
        <div className="platform-scrollbar min-h-0 flex-1 overflow-y-auto">{children}</div>
      </section>
    </div>,
    document.body,
  )
}
