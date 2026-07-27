import { X } from 'lucide-react'
import { type ReactNode, useEffect } from 'react'
import { createPortal } from 'react-dom'

type AiConfigurationDialogProps = {
  children: ReactNode
  description: string
  onClose: () => void
  open: boolean
  title: string
}

export function AiConfigurationDialog({
  children,
  description,
  onClose,
  open,
  title,
}: AiConfigurationDialogProps) {
  useEffect(() => {
    if (!open) return undefined
    const previousOverflow = document.body.style.overflow
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose, open])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/45 p-0 backdrop-blur-sm sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      role="presentation"
    >
      <section
        aria-labelledby="ai-configuration-title"
        aria-modal="true"
        className="flex h-full w-full flex-col overflow-hidden bg-[var(--app-surface)] text-slate-950 shadow-2xl dark:text-white sm:h-auto sm:max-h-[88vh] sm:max-w-5xl sm:rounded-lg sm:border sm:border-black/10 dark:sm:border-white/10"
        role="dialog"
      >
        <header className="flex shrink-0 items-start justify-between gap-5 border-b border-black/10 px-5 py-4 dark:border-white/10 sm:px-6">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white" id="ai-configuration-title">{title}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>
          </div>
          <button
            aria-label="关闭模型配置"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-slate-500 transition hover:bg-black/5 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:hover:bg-white/10 dark:hover:text-white"
            onClick={onClose}
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </section>
    </div>,
    document.body,
  )
}
