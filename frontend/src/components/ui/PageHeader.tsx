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
      <h1 className="mt-0 text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl">{title}</h1>
      {description && (
        <p className={`mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:mt-3 sm:text-base sm:leading-7 dark:text-slate-400 ${descCenterClass}`}>
          {description}
        </p>
      )}
    </div>
  )
}
