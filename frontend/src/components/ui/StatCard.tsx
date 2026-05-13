import type { ReactNode } from 'react'

type StatCardProps = {
  className?: string
  dense?: boolean
  hint?: string
  label: string
  onClick?: () => void
  tone?: 'brand' | 'danger' | 'muted' | 'success' | 'warning'
  value: ReactNode
}

const toneMap = {
  brand: 'border-brand-600/20 bg-brand-600/[0.04] text-brand-700 dark:border-green-300/20 dark:bg-green-300/[0.05] dark:text-green-300',
  danger: 'border-red-500/20 bg-red-500/[0.05] text-red-700 dark:text-red-300',
  muted: 'border-black/10 bg-white text-slate-700 dark:border-white/10 dark:bg-[#131a15] dark:text-slate-200',
  success: 'border-emerald-500/20 bg-emerald-500/[0.05] text-emerald-700 dark:text-emerald-300',
  warning: 'border-amber-500/25 bg-amber-500/[0.06] text-amber-700 dark:text-amber-300',
}

export function StatCard({ className = '', dense = false, hint, label, onClick, tone = 'muted', value }: StatCardProps) {
  const Component = onClick ? 'button' : 'div'

  return (
    <Component
      className={`w-full rounded-lg border text-left shadow-sm transition ${toneMap[tone]} ${
        dense ? 'px-4 py-3' : 'p-5'
      } ${onClick ? 'hover:border-brand-600/30 hover:bg-brand-600/[0.035] dark:hover:bg-green-300/[0.04]' : ''} ${className}`}
      onClick={onClick}
      type={onClick ? 'button' : undefined}
    >
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <div className={`${dense ? 'mt-1 text-2xl' : 'mt-2 text-3xl'} font-semibold tracking-tight text-slate-950 dark:text-white`}>
        {value}
      </div>
      {hint && <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{hint}</p>}
    </Component>
  )
}
