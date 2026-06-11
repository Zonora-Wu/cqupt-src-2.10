import {
  ArrowRight,
  Award,
  BookOpen,
  Bug,
  CheckCircle2,
  Menu,
  Moon,
  Search,
  Sun,
  Terminal,
  X,
} from 'lucide-react'
import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import { AppBackground } from '../../components/layout/AppBackground'
import { BrandLogo } from '../../components/layout/BrandLogo'

const IntroCopySection = lazy(() =>
  import('../../components/guest/IntroCopySection').then((module) => ({ default: module.IntroCopySection })),
)
const AboutPlatform = lazy(() => import('./AboutPlatform').then((module) => ({ default: module.AboutPlatform })))
const CertificateVerify = lazy(() =>
  import('./CertificateVerify').then((module) => ({ default: module.CertificateVerify })),
)
const PlatformRules = lazy(() => import('./PlatformRules').then((module) => ({ default: module.PlatformRules })))
const PublicAnnouncements = lazy(() =>
  import('./PublicAnnouncements').then((module) => ({ default: module.PublicAnnouncements })),
)

type GuestHomeProps = {
  onLogin: () => void
  onRegister: () => void
}

const navItems = ['首页', '平台规则', '公开公告', '证书查询', '关于平台']

const capabilities = [
  {
    title: '漏洞响应',
    description: '标准化漏洞提交流程，快速响应与修复跟踪。保护校园网络生态，建立可靠的安全反馈闭环。',
    icon: Bug,
    tone: 'text-green-300',
    panel: 'bg-green-400/10 border-green-300/20',
  },
  {
    title: '安全学习',
    description: '体系化课程、工具资源与实战文档，从基础理论到高级攻防逐步建立能力。',
    icon: BookOpen,
    tone: 'text-blue-300',
    panel: 'bg-blue-400/10 border-blue-300/20',
  },
  {
    title: '靶场实践',
    description: '隔离的授权训练环境，提供真实漏洞复现与攻防演练场景。',
    icon: Terminal,
    tone: 'text-purple-300',
    panel: 'bg-purple-400/10 border-purple-300/20',
  },
  {
    title: '证书激励',
    description: '提交高价值漏洞可获得平台认可的贡献证书，助力个人能力背书与职业发展。',
    icon: Award,
    tone: 'text-amber-300',
    panel: 'bg-amber-400/10 border-amber-300/20',
  },
]

const processItems = ['注册账号', '安全答题', '签署责任书', '提交漏洞', '审核反馈', '积分与证书']
type GuestPage = 'home' | 'rules' | 'announcements' | 'certificates' | 'about'

const navPageMap: Record<string, GuestPage> = {
  首页: 'home',
  平台规则: 'rules',
  公开公告: 'announcements',
  证书查询: 'certificates',
  关于平台: 'about',
}

export function GuestHome({ onLogin, onRegister }: GuestHomeProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try { return (localStorage.getItem('cqupt-theme') as 'dark' | 'light' | null) ?? 'dark' } catch { return 'dark' }
  })
  const [activePage, setActivePage] = useState<GuestPage>('home')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    try {
      localStorage.setItem('cqupt-theme', theme)
    } catch {
      // localStorage may be unavailable in private browsing or restricted contexts.
    }
  }, [theme])

  const openPage = (page: GuestPage) => {
    setActivePage(page)
    setMobileOpen(false)
    window.scrollTo({ top: 0 })
  }

  return (
    <AppBackground>
      <nav className="fixed left-0 right-0 top-0 z-50 border-b border-black/[0.08] bg-[#f7f9f7]/80 backdrop-blur-xl transition-colors duration-300 dark:border-white/[0.06] dark:bg-[#0f1511]/75">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-5 md:px-8">
          <a className="flex items-center" href="#">
            <BrandLogo />
          </a>

          <div className="hidden items-center gap-8 md:flex">
            {navItems.map((item) => (
              <button
                className={`text-sm font-medium transition hover:text-brand-700 dark:hover:text-green-300 ${
                  activePage === navPageMap[item]
                    ? 'text-brand-700 dark:text-green-300'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
                key={item}
                onClick={() => openPage(navPageMap[item])}
                type="button"
              >
                {item}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              aria-label="切换主题"
              className="hidden rounded-lg p-2 text-slate-600 transition hover:bg-black/5 hover:text-slate-950 md:inline-flex dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              type="button"
            >
              {theme === 'dark' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </button>
            <button
              className="hidden rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-black/5 hover:text-slate-950 sm:inline-flex dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
              onClick={onLogin}
              type="button"
            >
              登录
            </button>
            <button
              className="hidden rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-[0_0_18px_rgba(42,100,56,0.35)] transition hover:bg-brand-700 sm:inline-flex"
              onClick={onRegister}
              type="button"
            >
              注册
            </button>
            <button
              aria-label="打开菜单"
              className="rounded-lg p-2 text-slate-700 transition hover:bg-black/5 md:hidden dark:text-slate-300 dark:hover:bg-white/10"
              onClick={() => setMobileOpen((value) => !value)}
              type="button"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="border-t border-black/10 bg-[#f7f9f7]/95 px-5 py-4 backdrop-blur-xl md:hidden dark:border-white/10 dark:bg-[#0f1511]/95">
            <div className="flex flex-col gap-3">
              {navItems.map((item) => (
                <button
                  className="rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-black/5 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
                  key={item}
                  onClick={() => openPage(navPageMap[item])}
                  type="button"
                >
                  {item}
                </button>
              ))}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button className="rounded-lg border border-black/10 py-2 text-sm text-slate-800 dark:border-white/10 dark:text-white" onClick={onLogin} type="button">
                  登录
                </button>
                <button className="rounded-lg bg-brand-600 py-2 text-sm text-white" onClick={onRegister} type="button">
                  注册
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      <>
        {activePage === 'rules' && (
          <PageTransition key="rules">
            <LazyPage>
              <PlatformRules />
            </LazyPage>
          </PageTransition>
        )}
        {activePage === 'announcements' && (
          <PageTransition key="announcements">
            <LazyPage>
              <PublicAnnouncements />
            </LazyPage>
          </PageTransition>
        )}
        {activePage === 'certificates' && (
          <PageTransition key="certificates">
            <LazyPage>
              <CertificateVerify />
            </LazyPage>
          </PageTransition>
        )}
        {activePage === 'about' && (
          <PageTransition key="about">
            <LazyPage>
              <AboutPlatform />
            </LazyPage>
          </PageTransition>
        )}
      {activePage === 'home' && (
          <PageTransition key="home">
      <section className="relative z-10 mx-auto max-w-6xl px-5 pb-24 pt-44 text-center md:px-8 md:pt-48">
        <div>
          <div className="mb-8 inline-flex items-center gap-2 rounded-lg border border-brand-600/20 bg-brand-600/10 px-3 py-1">
            <span className="h-2 w-2 animate-pulse rounded-full bg-brand-600 dark:bg-green-300" />
            <span className="font-mono text-xs font-medium tracking-wider text-brand-700 dark:text-green-300">SECURE PLATFORM LIVE</span>
          </div>
          <h1 className="mx-auto max-w-4xl text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
            CQUPT-SRC 校园漏洞响应与
            <br className="hidden md:block" />
            安全学习平台
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-slate-600 md:text-lg dark:text-slate-400">
            连接漏洞响应、学习实践、证书激励与校园安全共建。打造下一代高校信息安全防线。
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <button
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-8 py-3 font-medium text-white shadow-[0_0_22px_rgba(42,100,56,0.42)] transition hover:bg-brand-700 sm:w-auto"
              onClick={onLogin}
              type="button"
            >
              立即登录
              <ArrowRight className="h-4 w-4" />
            </button>
            <a className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-black/10 bg-white/70 px-8 py-3 font-medium text-slate-900 transition hover:bg-white sm:w-auto dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10" href="#certificate">
              查询证书
              <Search className="h-4 w-4" />
            </a>
          </div>
        </div>

      </section>

      <DeferredContent fallback={<IntroCopySkeleton />} rootMargin="640px 0px">
        <Suspense fallback={<IntroCopySkeleton />}>
          <IntroCopySection />
        </Suspense>
      </DeferredContent>

      <section className="relative z-10 mx-auto max-w-6xl px-5 py-20 md:px-8">
        <h2 className="mb-12 text-center text-3xl font-semibold">核心能力</h2>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {capabilities.map((item, index) => {
            const Icon = item.icon
            return (
              <article
                className={`group relative overflow-hidden rounded-lg border border-black/10 bg-white/70 p-7 backdrop-blur-xl transition hover:bg-white dark:border-white/10 dark:bg-white/[0.035] dark:hover:bg-white/[0.06] ${
                  index === 0 || index === 3 ? 'md:col-span-2' : ''
                }`}
                key={item.title}
              >
                <div className={`mb-6 flex h-12 w-12 items-center justify-center rounded-lg border ${item.panel}`}>
                  <Icon className={`h-6 w-6 ${item.tone}`} />
                </div>
                <h3 className="mb-3 text-xl font-semibold">{item.title}</h3>
                <p className="max-w-md leading-7 text-slate-600 dark:text-slate-400">{item.description}</p>
              </article>
            )
          })}
        </div>
      </section>

      <section className="relative z-10 border-y border-black/[0.08] bg-white/55 px-5 py-20 md:px-8 dark:border-white/[0.06] dark:bg-white/[0.025]" id="certificate">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="mb-4 text-3xl font-semibold">证书真伪验证</h2>
          <p className="mx-auto mb-8 max-w-2xl leading-7 text-slate-600 dark:text-slate-400">
            输入证书编号或提交者 ID，即刻验证由 CQUPT-SRC 颁发的漏洞贡献荣誉证书有效性。
          </p>
          <div className="mx-auto flex max-w-xl items-center rounded-lg border border-black/10 bg-white p-2 backdrop-blur-xl focus-within:ring-2 focus-within:ring-brand-600/50 dark:border-white/10 dark:bg-white/[0.04]">
            <Search className="ml-3 mr-2 h-5 w-5 text-slate-500 dark:text-slate-400" />
            <input
              className="min-w-0 flex-1 border-none bg-transparent py-3 font-mono text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-600"
              placeholder="输入证书编号 (e.g. CQUPT-SRC-2026-VULN-000001)"
              type="text"
            />
            <button className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-brand-700" type="button">
              查询
            </button>
          </div>
          <p className="mt-4 text-xs text-slate-500">仅展示证书真实性与脱敏信息，不公开漏洞细节。</p>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-5 py-20 md:px-8">
        <h2 className="mb-10 text-center text-3xl font-semibold">安全参与流程</h2>
        <div className="grid gap-3 md:grid-cols-6">
          {processItems.map((item, index) => (
            <div className="rounded-lg border border-black/10 bg-white/70 p-4 text-center dark:border-white/10 dark:bg-white/[0.035]" key={item}>
              <CheckCircle2 className="mx-auto mb-3 h-5 w-5 text-brand-700 dark:text-green-300" />
              <p className="text-sm font-medium">{item}</p>
              <p className="mt-1 font-mono text-xs text-slate-500">0{index + 1}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="relative z-10 border-t border-black/[0.08] bg-white px-5 py-10 md:px-8 dark:border-white/[0.06] dark:bg-slate-950">
        <div className="mx-auto flex max-w-[1440px] flex-col items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400 md:flex-row">
          <div className="font-semibold tracking-tight text-slate-950 dark:text-white">CQUPT-SRC</div>
          <div className="flex gap-6">
            <a className="transition hover:text-green-300" href="#">隐私政策</a>
            <a className="transition hover:text-green-300" href="#">用户协议</a>
            <a className="transition hover:text-green-300" href="#">联系我们</a>
            <a className="transition hover:text-green-300" href="#">加入我们</a>
          </div>
          <div>© 2026 CQUPT-SRC 校园漏洞响应与安全学习平台.</div>
        </div>
      </footer>
          </PageTransition>
        )}
      </>
    </AppBackground>
  )
}

function LazyPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
}

function PageSkeleton() {
  return (
    <div className="relative z-10 mx-auto min-h-screen max-w-6xl px-5 pt-32 md:px-8">
      <div className="h-7 w-48 animate-pulse rounded-lg bg-black/10 dark:bg-white/10" />
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <div className="h-36 animate-pulse rounded-lg bg-black/10 dark:bg-white/10 md:col-span-2" />
        <div className="h-36 animate-pulse rounded-lg bg-black/10 dark:bg-white/10" />
      </div>
    </div>
  )
}

function PageTransition({ children }: { children: ReactNode }) {
  return <div className="overflow-visible">{children}</div>
}

function IntroCopySkeleton() {
  return (
    <section className="relative z-10 mx-auto max-w-6xl border-t border-black/[0.08] px-5 py-20 md:px-8 dark:border-white/[0.06]">
      <div className="grid gap-x-20 gap-y-8 lg:grid-cols-2">
        <div className="h-1 w-12 rounded-lg bg-brand-600" />
        <div className="hidden h-1 w-12 rounded-lg bg-slate-700 lg:block" />
        {Array.from({ length: 6 }).map((_, index) => (
          <div className="space-y-3" key={index}>
            <div className="h-4 w-full animate-pulse rounded-lg bg-black/10 dark:bg-white/10" />
            <div className="h-4 w-11/12 animate-pulse rounded-lg bg-black/10 dark:bg-white/10" />
            <div className="h-4 w-10/12 animate-pulse rounded-lg bg-black/10 dark:bg-white/10" />
          </div>
        ))}
      </div>
    </section>
  )
}

function DeferredContent({
  children,
  fallback,
  rootMargin = '480px 0px',
}: {
  children: ReactNode
  fallback: ReactNode
  rootMargin?: string
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [shouldRender, setShouldRender] = useState(false)

  useEffect(() => {
    if (shouldRender) return
    const element = containerRef.current
    if (!element || !('IntersectionObserver' in window)) {
      setShouldRender(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        setShouldRender(true)
        observer.disconnect()
      },
      { rootMargin },
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [rootMargin, shouldRender])

  return <div ref={containerRef}>{shouldRender ? children : fallback}</div>
}
