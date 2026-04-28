import { type HTMLAttributes } from 'react'

type SurfacePanelProps = HTMLAttributes<HTMLDivElement> & {
  className?: string
}

export function SurfacePanel({ children, className = '', ...props }: SurfacePanelProps) {
  return (
    <div
      className={`rounded-lg border border-black/10 bg-white/75 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.035] ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
