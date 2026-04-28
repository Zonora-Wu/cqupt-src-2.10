import type { ReactNode } from 'react'

interface SectionTitleProps {
  icon: ReactNode
  title: string
  subtitle: string
}

export function SectionTitle({ icon, title, subtitle }: SectionTitleProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-brand-700 dark:text-green-300">{icon}</span>
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
      </div>
    </div>
  )
}
