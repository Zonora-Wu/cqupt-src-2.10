import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode; resetKey: string }
type State = { error: Error | null }

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled application render error', { componentStack: info.componentStack, error })
  }

  componentDidUpdate(previousProps: Props) {
    if (this.state.error && previousProps.resetKey !== this.props.resetKey) this.setState({ error: null })
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--brand-light-bg,#f7f9f7)] px-6 text-slate-800 dark:bg-[var(--brand-dark-bg,#0f1511)] dark:text-slate-100">
        <section className="w-full max-w-lg border border-black/10 bg-white p-8 text-center shadow-sm dark:border-white/10 dark:bg-[var(--brand-dark-surface,#18201a)]">
          <h1 className="text-xl font-semibold">页面暂时无法显示</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-300">页面运行时遇到异常，可以重新加载；若问题持续，请向平台管理员反馈。</p>
          <div className="mt-6 flex justify-center gap-3">
            <button className="rounded-md border border-black/10 px-4 py-2 text-sm transition hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10" onClick={() => this.setState({ error: null })} type="button">重试</button>
            <button className="rounded-md bg-brand-700 px-4 py-2 text-sm text-white transition hover:bg-brand-800" onClick={() => window.location.reload()} type="button">重新加载</button>
          </div>
        </section>
      </main>
    )
  }
}
