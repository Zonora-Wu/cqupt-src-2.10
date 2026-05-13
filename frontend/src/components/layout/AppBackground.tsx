type AppBackgroundProps = {
  children: React.ReactNode
  className?: string
  variant?: 'admin' | 'public' | 'workspace'
}

export function AppBackground({ children, className = '', variant = 'workspace' }: AppBackgroundProps) {
  const showGlow = variant === 'public'
  const gridOpacity = variant === 'admin' ? 'opacity-35' : 'opacity-60'

  return (
    <main
      className={`relative min-h-screen overflow-x-hidden bg-[#f7f9f7] text-slate-950 transition-colors duration-300 dark:bg-[#0f1511] dark:text-white ${className}`}
    >
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        {showGlow && <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-brand-600/8 blur-3xl dark:bg-brand-600/12" />}
        {showGlow && <div className="absolute right-[-140px] top-1/3 h-96 w-96 rounded-full bg-brand-400/6 blur-3xl" />}
        <div className={`absolute inset-0 bg-[linear-gradient(rgba(42,100,56,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(42,100,56,0.035)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:linear-gradient(to_bottom,black,transparent_80%)] dark:bg-[linear-gradient(rgba(255,255,255,0.022)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.022)_1px,transparent_1px)] ${gridOpacity}`} />
      </div>
      {children}
    </main>
  )
}
