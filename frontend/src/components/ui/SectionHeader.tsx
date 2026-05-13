import type { ReactNode } from 'react'

type SectionHeaderProps = {
  action?: ReactNode
  className?: string
  description?: string
  eyebrow?: string
  title: string
}

export function SectionHeader({ action, className = '', description, eyebrow, title }: SectionHeaderProps) {
  return (
    <div className={`flex items-start justify-between gap-4 ${className}`}>
      <div className="min-w-0">
        {eyebrow && <p className="text-xs font-medium uppercase tracking-[0.16em] text-brand-700 dark:text-green-300">{eyebrow}</p>}
        <h2 className="text-lg font-semibold tracking-tight text-slate-950 dark:text-white">{title}</h2>
        {description && <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
