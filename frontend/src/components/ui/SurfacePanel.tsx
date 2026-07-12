import { type HTMLAttributes } from 'react'

type SurfacePanelProps = HTMLAttributes<HTMLDivElement> & {
  className?: string
}

export function SurfacePanel({ children, className = '', ...props }: SurfacePanelProps) {
  const interactive = Boolean(props.onClick || props.onKeyDown || props.role === 'button' || props.tabIndex !== undefined)

  return (
    <div
      className={`rounded-lg border border-black/10 bg-[var(--app-panel-bg)] shadow-sm backdrop-blur-xl dark:border-white/10 ${interactive ? 'cursor-pointer' : 'cursor-default'} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
