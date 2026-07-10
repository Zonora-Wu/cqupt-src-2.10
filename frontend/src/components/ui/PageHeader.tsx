import type { ReactNode } from 'react'

interface PageHeaderProps {
  eyebrowIcon?: ReactNode
  eyebrow?: string
  title: string
  description?: string
  /** 文字对齐方向，默认 left */
  align?: 'left' | 'center'
}

export function PageHeader({ title, description, align = 'left' }: PageHeaderProps) {
  const centerClass = align === 'center' ? 'text-center' : ''
  const descCenterClass = align === 'center' ? 'mx-auto' : ''

  return (
    <div className={centerClass}>
      <h1 className="mt-0 text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1>
      {description && (
        <p className={`mt-3 max-w-2xl leading-7 text-slate-600 dark:text-slate-400 ${descCenterClass}`}>
          {description}
        </p>
      )}
    </div>
  )
}
