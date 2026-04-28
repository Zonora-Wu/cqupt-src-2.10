import type { ReactNode } from 'react'
import { SurfacePanel } from './SurfacePanel'

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description?: string
}

export function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <SurfacePanel className="p-10 text-center">
      <span className="mx-auto flex h-10 w-10 items-center justify-center text-slate-400">{icon}</span>
      <h2 className="mt-4 text-xl font-semibold">{title}</h2>
      {description && (
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{description}</p>
      )}
    </SurfacePanel>
  )
}
