import { createPortal } from 'react-dom'

type Props = {
  confirmLabel?: string
  description: string
  onCancel: () => void
  onConfirm: () => void
  open: boolean
  title: string
}

export function ExitConfirmationDialog({
  confirmLabel = '确认退出',
  description,
  onCancel,
  onConfirm,
  open,
  title,
}: Props) {
  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      aria-labelledby="exit-confirmation-title"
      aria-modal="true"
      className="fixed inset-0 z-[10020] flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm"
      role="dialog"
    >
      <div className="w-full max-w-md rounded-lg border border-black/10 bg-[var(--app-menu-bg)] shadow-2xl dark:border-white/10">
        <div className="border-b border-black/10 px-5 py-4 dark:border-white/10">
          <h2 className="text-base font-semibold text-slate-950 dark:text-white" id="exit-confirmation-title">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p>
        </div>
        <div className="flex justify-end gap-3 px-5 py-4">
          <button
            className="rounded-md border border-black/10 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10"
            onClick={onCancel}
            type="button"
          >
            继续完成
          </button>
          <button
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
            onClick={onConfirm}
            type="button"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
