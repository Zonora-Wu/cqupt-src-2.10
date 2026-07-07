type AppBackgroundProps = {
  children: React.ReactNode
  className?: string
}

export function AppBackground({ children, className = '' }: AppBackgroundProps) {
  return (
    <main
      className={`relative min-h-screen overflow-x-hidden bg-[var(--app-bg)] text-slate-950 transition-colors duration-300 dark:text-white ${className}`}
    >
      {children}
    </main>
  )
}
