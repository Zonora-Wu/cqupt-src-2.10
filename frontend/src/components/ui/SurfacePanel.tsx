import { type HTMLAttributes } from 'react'

type SurfacePanelProps = HTMLAttributes<HTMLDivElement> & {
  className?: string
}

export function SurfacePanel({ children, className = '', ...props }: SurfacePanelProps) {
  return (
    <div
      className={`rounded-lg border border-black/10 bg-white/95 shadow-sm dark:border-white/10 dark:bg-[#131a15]/95 ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
