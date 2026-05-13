import { type ReactNode } from 'react'

type ModalShellProps = {
  children: ReactNode
  className?: string
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl'
  onClose?: () => void
  scrollable?: boolean
  zIndex?: 'modal' | 'critical'
}

const maxWidthClass: Record<NonNullable<ModalShellProps['maxWidth']>, string> = {
  sm: 'max-w-[520px]',
  md: 'max-w-[620px]',
  lg: 'max-w-[760px]',
  xl: 'max-w-[820px]',
}

const zIndexClass: Record<NonNullable<ModalShellProps['zIndex']>, string> = {
  modal: 'z-[90]',
  critical: 'z-[100]',
}

export function ModalShell({
  children,
  className = '',
  maxWidth = 'sm',
  onClose,
  scrollable = false,
  zIndex = 'critical',
}: ModalShellProps) {
  return (
    <div
      className={`fixed inset-0 ${zIndexClass[zIndex]} flex items-center justify-center bg-black/35 px-5 backdrop-blur-sm`}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose?.()
      }}
    >
      <div
        className={`w-full ${maxWidthClass[maxWidth]} rounded-lg border border-black/10 bg-white p-6 text-slate-950 shadow-2xl dark:border-white/10 dark:bg-[#131a15] dark:text-white ${
          scrollable ? 'max-h-[86vh] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden' : ''
        } ${className}`}
      >
        {children}
      </div>
    </div>
  )
}
