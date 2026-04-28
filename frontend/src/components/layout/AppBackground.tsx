type AppBackgroundProps = {
  children: React.ReactNode
  className?: string
}

export function AppBackground({ children, className = '' }: AppBackgroundProps) {
  return (
    <main
      className={`relative min-h-screen overflow-x-hidden bg-[#f7f9f7] text-slate-950 transition-colors duration-300 dark:bg-[#0f1511] dark:text-white ${className}`}
    >
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-brand-600/12 blur-3xl dark:bg-brand-600/20" />
        <div className="absolute right-[-140px] top-1/3 h-96 w-96 rounded-full bg-brand-400/10 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(42,100,56,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(42,100,56,0.055)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:linear-gradient(to_bottom,black,transparent_80%)] dark:bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)]" />
      </div>
      {children}
    </main>
  )
}
