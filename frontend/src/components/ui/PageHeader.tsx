import type { ReactNode } from 'react'

interface PageHeaderProps {
  eyebrowIcon: ReactNode
  eyebrow: string
  title: string
  description?: string
  /** 文字对齐方向，默认 left */
  align?: 'left' | 'center'
}

export function PageHeader({ eyebrowIcon, eyebrow, title, description, align = 'left' }: PageHeaderProps) {
  const centerClass = align === 'center' ? 'text-center' : ''
  const descCenterClass = align === 'center' ? 'mx-auto' : ''

  return (
    <div className={centerClass}>
      <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-brand-700 dark:text-brand-300">
        {eyebrowIcon}
        {eyebrow}
      </p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1>
      {description && (
        <p className={`mt-3 max-w-2xl leading-7 text-slate-600 dark:text-slate-400 ${descCenterClass}`}>
          {description}
        </p>
      )}
    </div>
  )
}
