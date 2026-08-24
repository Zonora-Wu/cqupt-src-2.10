import type { ReactNode } from 'react'

interface PageSectionProps {
  children: ReactNode
  /** sm=1080px  md=1180px  lg=1360px（默认） */
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeMap = {
  sm: 'max-w-[1080px]',
  md: 'max-w-[1180px]',
  lg: 'max-w-[1360px]',
}

export function PageSection({ children, size = 'lg', className = '' }: PageSectionProps) {
  return (
    <section className={`relative z-10 mx-auto ${sizeMap[size]} px-4 pb-8 pt-32 sm:px-5 md:px-8 md:pt-24 ${className}`}>
      {children}
    </section>
  )
}
