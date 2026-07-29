import {
  ArrowRight,
  ChevronDown,
  Menu,
  Moon,
  Search,
  Sun,
  X,
} from 'lucide-react'
import { MotionConfig, motion, useReducedMotion } from 'motion/react'
import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AppBackground } from '../../components/layout/AppBackground'
import { BrandLogo } from '../../components/layout/BrandLogo'
import { SafetyParticipationFlow } from '../../components/guest/SafetyParticipationFlow'
import { FullScreenLoader } from '../../components/ui/FullScreenLoader'
import { BorderGlow } from '../../components/ui/BorderGlow'
import { SpotlightCard } from '../../components/ui/SpotlightCard'
import { getPublicPageFromPath, publicPagePaths, type PublicPage } from '../../routes/routeConfig'
import { applyColorTheme, getSavedColorTheme, transitionColorTheme } from '../../utils/themeTransition'

const IntroCopySection = lazy(() =>
  import('../../components/guest/IntroCopySection').then((module) => ({ default: module.IntroCopySection })),
)
const BeamsBackground = lazy(() =>
  import('../../components/guest/BeamsBackground').then((module) => ({ default: module.BeamsBackground })),
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
    description: '围绕校园授权资产建立统一的漏洞提交、审核、分级、修复跟进和复测归档流程。学生提交报告后，平台会沉淀复现步骤、影响范围、证据材料和处置记录，审核人员可据此判断风险等级并推动责任单位修复，让安全问题从发现到解决都有清晰轨迹。',
  },
  {
    title: '安全学习',
    description: '围绕平台规则、漏洞基础、报告写作和实战资料建立学习路径，并接入 AI 助手“邮宝”。用户可以向邮宝询问规则、学习方向、报告优化和平台资源推荐，让学习过程更贴合当前任务。',
  },
  {
    title: '靶场实践',
    description: '通过授权训练环境和实践资源，帮助用户在正式提交前理解漏洞原理、复现路径和影响判断。平台强调合法边界、证据完整性和复现规范，让训练结果能自然迁移到真实报告中。',
  },
  {
    title: '证书激励',
    description: '把有效漏洞贡献转化为积分奖励、荣誉证书和可验证的成长记录。高质量报告通过审核后，可形成个人安全实践成果沉淀；证书支持公开验真，既便于展示真实贡献，也鼓励用户持续提交规范、完整、有修复价值的漏洞报告。',
  },
]

const navPageMap: Record<string, PublicPage> = {
  首页: 'home',
  平台规则: 'rules',
  公开公告: 'announcements',
  证书查询: 'certificates',
  关于平台: 'about',
}

export function GuestHome({ onLogin, onRegister }: GuestHomeProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => getSavedColorTheme())
  const [homeCertificateNo, setHomeCertificateNo] = useState('')
  const [certificateSearchNo, setCertificateSearchNo] = useState('')
  const [certificateQueryNonce, setCertificateQueryNonce] = useState(0)
  const [homeScrolled, setHomeScrolled] = useState(() => typeof window !== 'undefined' && window.scrollY > 24)
  const reduceMotion = useReducedMotion()
  const location = useLocation()
  const navigate = useNavigate()
  const activePage = getPublicPageFromPath(location.pathname)
  const heroNavigation = activePage === 'home' && !homeScrolled
  const heroDarkSurface = heroNavigation && theme === 'dark'

  useEffect(() => {
    applyColorTheme(theme)
  }, [theme])

  useEffect(() => {
    if (activePage !== 'home') return
    const updateScrollState = () => setHomeScrolled(window.scrollY > 24)
    const animationFrame = window.requestAnimationFrame(updateScrollState)
    window.addEventListener('scroll', updateScrollState, { passive: true })
    return () => {
      window.cancelAnimationFrame(animationFrame)
      window.removeEventListener('scroll', updateScrollState)
    }
  }, [activePage])

  const openPage = (page: PublicPage) => {
    if (page === 'certificates') {
      setCertificateSearchNo('')
    }
    setMobileOpen(false)
    navigate(publicPagePaths[page])
    window.scrollTo({ top: 0 })
  }

  const openCertificateSearch = (certificateNo = '') => {
    const normalized = certificateNo.trim()
    setCertificateSearchNo(normalized)
    setCertificateQueryNonce((value) => value + 1)
    setMobileOpen(false)
    navigate(publicPagePaths.certificates)
    window.scrollTo({ top: 0 })
  }

  return (
    <AppBackground
      className={activePage === 'home'
        ? '[--app-bg:#ffffff] [--app-header-bg:#ffffff] [--app-menu-bg:#ffffff] [--app-panel-bg:#ffffff] dark:[--app-bg:var(--app-bg-dark)] dark:[--app-header-bg:var(--app-header-bg-dark)] dark:[--app-menu-bg:var(--app-menu-bg-dark)] dark:[--app-panel-bg:var(--app-panel-bg-dark)]'
        : ''}
    >
      <MotionConfig reducedMotion="user">
      <nav className={`fixed left-0 right-0 top-0 z-50 transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300 ${
        heroNavigation
          ? 'border-b border-transparent bg-transparent shadow-none backdrop-blur-none'
          : 'border-b border-black/[0.08] bg-[var(--app-header-bg)] shadow-sm shadow-black/[0.025] backdrop-blur-xl dark:border-white/[0.06]'
      }`}>
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-5 md:px-8">
          <button className="flex items-center" onClick={() => openPage('home')} type="button">
            <BrandLogo onDarkSurface={heroDarkSurface} />
          </button>

          <div className="hidden items-center gap-8 md:flex">
            {navItems.map((item) => (
              <button
                className={`relative py-2 text-sm font-medium transition after:absolute after:inset-x-0 after:bottom-0 after:h-px after:origin-center after:scale-x-0 after:transition-transform hover:after:scale-x-100 ${
                  heroDarkSurface
                    ? 'text-slate-300 after:bg-white/70 hover:text-white'
                    : heroNavigation
                    ? activePage === navPageMap[item]
                      ? 'text-slate-950 after:bg-slate-700 hover:text-black'
                      : 'text-slate-600 after:bg-slate-500 hover:text-slate-950'
                    : activePage === navPageMap[item]
                    ? 'text-brand-700 dark:text-brand-300'
                    : 'text-slate-600 after:bg-brand-600 hover:text-brand-700 dark:text-slate-400 dark:after:bg-brand-300 dark:hover:text-brand-300'
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
              className={`theme-toggle-button hidden rounded-lg p-2 transition md:inline-flex ${heroDarkSurface ? 'text-slate-300 hover:bg-white/10 hover:text-white' : 'text-slate-600 hover:bg-black/5 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white'}`}
              onClick={(event) => {
                const nextTheme = theme === 'dark' ? 'light' : 'dark'
                transitionColorTheme(nextTheme, event)
                setTheme(nextTheme)
              }}
              type="button"
            >
              {theme === 'dark' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </button>
            <button
              className={`guest-hover-surface hidden rounded-lg border px-4 py-2 text-sm font-medium sm:inline-flex ${heroDarkSurface ? 'border-white/20 text-slate-200 hover:text-white' : 'border-black/10 text-slate-700 hover:text-slate-950 dark:border-white/10 dark:text-slate-300 dark:hover:text-white'}`}
              onClick={onLogin}
              type="button"
            >
              登录
            </button>
            <button
              className="hidden rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-[0_0_18px_rgba(var(--app-primary-rgb),0.25)] transition duration-200 hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-[0_8px_24px_rgba(var(--app-primary-rgb),0.3)] sm:inline-flex"
              onClick={onRegister}
              type="button"
            >
              注册
            </button>
            <button
              aria-label="打开菜单"
              className={`rounded-lg p-2 transition md:hidden ${heroDarkSurface ? 'text-slate-200 hover:bg-white/10 hover:text-white' : 'text-slate-700 hover:bg-black/5 dark:text-slate-300 dark:hover:bg-white/10'}`}
              onClick={() => setMobileOpen((value) => !value)}
              type="button"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="border-t border-black/10 bg-[var(--app-menu-bg)] px-5 py-4 backdrop-blur-xl md:hidden dark:border-white/10 ">
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
              <CertificateVerify initialCertificateNo={certificateSearchNo} queryNonce={certificateQueryNonce} />
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
      <section className="relative z-10 flex min-h-[100svh] items-center justify-center overflow-hidden px-5 pb-20 pt-24 text-center md:px-8">
        <div className="absolute inset-0 -z-10">
          <Suspense fallback={<div className={theme === 'dark' ? 'h-full w-full bg-black' : 'h-full w-full bg-white'} />}>
            <BeamsBackground
              beamHeight={25}
              beamNumber={8}
              beamWidth={2.2}
              lightColor="#ffffff"
              noiseIntensity={1.25}
              rotation={310}
              scale={0.1}
              speed={reduceMotion ? 0 : 2.8}
              theme={theme}
            />
          </Suspense>
        </div>

        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto w-full max-w-6xl"
          initial={reduceMotion ? false : { opacity: 0, y: 18 }}
          transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.h1
            animate={{ opacity: 1, y: 0 }}
            className={`mx-auto max-w-4xl text-4xl font-semibold leading-tight md:text-6xl ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}
            initial={reduceMotion ? false : { opacity: 0, y: 14 }}
            transition={{ delay: 0.08, duration: 0.68, ease: [0.22, 1, 0.36, 1] }}
          >
            CQUPT-SRC 校园漏洞响应与
            <br className="hidden md:block" />
            安全学习平台
          </motion.h1>
          <motion.p
            animate={{ opacity: 1, y: 0 }}
            className={`mx-auto mt-6 max-w-2xl text-base leading-8 md:text-lg ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            transition={{ delay: 0.18, duration: 0.62, ease: [0.22, 1, 0.36, 1] }}
          >
            连接漏洞响应、学习实践、证书激励与校园安全共建。打造下一代高校信息安全防线。
          </motion.p>
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            transition={{ delay: 0.28, duration: 0.58, ease: [0.22, 1, 0.36, 1] }}
          >
            <button
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-8 py-3 font-medium text-white shadow-[0_0_22px_rgba(var(--app-primary-rgb),0.3)] transition duration-200 hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-[0_10px_28px_rgba(var(--app-primary-rgb),0.34)] sm:w-auto"
              onClick={onLogin}
              type="button"
            >
              立即登录
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              className="guest-hover-surface inline-flex w-full items-center justify-center gap-2 rounded-lg border border-black/10 bg-[var(--app-panel-bg)] px-8 py-3 font-medium text-slate-900 sm:w-auto dark:border-white/10 dark:text-white"
              onClick={() => openCertificateSearch()}
              type="button"
            >
              查询证书
              <Search className="h-4 w-4" />
            </button>
          </motion.div>
        </motion.div>

        <button
          aria-label="向下浏览"
          className={`absolute bottom-7 left-1/2 grid h-10 w-10 -translate-x-1/2 place-items-center rounded-full opacity-55 transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 motion-safe:animate-[guest-scroll-hint_2.4s_ease-in-out_infinite] ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}
          onClick={() => document.getElementById('home-content-start')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          type="button"
        >
          <ChevronDown className="h-5 w-5" />
        </button>
      </section>

      <div className="scroll-mt-16" id="home-content-start">
        <DeferredContent fallback={<IntroCopySkeleton />} rootMargin="640px 0px">
          <Suspense fallback={<IntroCopySkeleton />}>
            <IntroCopySection />
          </Suspense>
        </DeferredContent>
      </div>

      <motion.section
        className="relative z-10 mx-auto max-w-[1280px] px-5 py-24 md:px-8"
        initial={reduceMotion ? false : { opacity: 0, y: 28 }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        viewport={{ amount: 0.14, once: true }}
        whileInView={{ opacity: 1, y: 0 }}
      >
        <h2 className="mb-14 text-center text-3xl font-semibold">核心能力</h2>
        <div className="grid grid-cols-1 md:grid-cols-2">
          {capabilities.map((item, index) => {
            return (
              <SpotlightCard
                className={`guest-hover-surface guest-palette-item border-b border-black/10 px-4 py-9 md:px-8 dark:border-white/10 ${
                  index % 2 === 0 ? 'md:border-r' : ''
                }`}
                key={item.title}
                spotlightColor="color-mix(in srgb, var(--guest-accent) 20%, transparent)"
              >
                <div className="relative z-10">
                  <div className="guest-palette-label font-mono text-xs font-semibold">
                    {String(index + 1).padStart(2, '0')}
                  </div>
                  <h3 className="mb-4 mt-4 text-xl font-semibold">{item.title}</h3>
                  <p className="leading-7 text-slate-600 dark:text-slate-400">{item.description}</p>
                </div>
              </SpotlightCard>
            )
          })}
        </div>
      </motion.section>

      <motion.section
        className="relative z-10 border-y border-black/[0.08] px-5 py-24 md:px-8 dark:border-white/[0.06]"
        id="certificate"
        initial={reduceMotion ? false : { opacity: 0, y: 24 }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        viewport={{ amount: 0.2, once: true }}
        whileInView={{ opacity: 1, y: 0 }}
      >
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="mb-4 text-3xl font-semibold">证书真伪验证</h2>
          <p className="mx-auto mb-8 max-w-2xl leading-7 text-slate-600 dark:text-slate-400">
            输入证书编号，即刻验证由 CQUPT-SRC 颁发的漏洞贡献荣誉证书有效性。
          </p>
          <BorderGlow
            className="mx-auto max-w-xl rounded-lg border border-black/10 bg-[var(--app-panel-bg)] p-2 backdrop-blur-xl focus-within:-translate-y-0.5 focus-within:border-brand-600/40 focus-within:shadow-[0_12px_32px_rgba(var(--app-primary-rgb),0.1)] focus-within:ring-2 focus-within:ring-brand-600/30 dark:border-white/10"
            contentClassName="flex items-center"
          >
            <Search className="ml-3 mr-2 h-5 w-5 text-slate-500 dark:text-slate-400" />
            <input
              className="min-w-0 flex-1 border-none bg-transparent py-3 font-mono text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-600"
              placeholder="输入证书编号 (e.g. CQUPT-SRC-CERT-2026-A1B2C3)"
              onChange={(event) => setHomeCertificateNo(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') openCertificateSearch(homeCertificateNo)
              }}
              type="text"
              value={homeCertificateNo}
            />
            <button
              className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!homeCertificateNo.trim()}
              onClick={() => openCertificateSearch(homeCertificateNo)}
              type="button"
            >
              查询
            </button>
          </BorderGlow>
          <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">点击查询后会进入证书查询页并自动核验。仅展示证书真实性与脱敏信息，不公开漏洞细节。</p>
        </div>
      </motion.section>

      <SafetyParticipationFlow />

      <footer className="relative z-10 border-t border-black/[0.08] bg-[var(--app-menu-bg)] px-5 py-9 md:px-8 dark:border-white/[0.06]">
        <div className="mx-auto max-w-[1440px]">
          <div className="flex flex-col gap-7 md:flex-row md:items-start md:justify-between">
            <div className="text-center md:text-left">
              <div className="text-sm font-semibold tracking-tight text-slate-950 dark:text-white">CQUPT-SRC</div>
            </div>

            <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-500 dark:text-slate-400 md:justify-end">
              <a className="transition hover:text-brand-700 dark:hover:text-brand-300" href="#">隐私政策</a>
              <a className="transition hover:text-brand-700 dark:hover:text-brand-300" href="#">用户协议</a>
              <a className="transition hover:text-brand-700 dark:hover:text-brand-300" href="#">联系我们</a>
              <a className="transition hover:text-brand-700 dark:hover:text-brand-300" href="#">加入我们</a>
            </nav>
          </div>

          <div className="mt-6 flex flex-col items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400 md:flex-row">
            <div className="text-center md:text-left">© 2026 CQUPT-SRC 校园漏洞响应与安全学习平台</div>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 md:justify-end">
              <a
                className="transition hover:text-brand-700 dark:hover:text-brand-300"
                href="https://beian.miit.gov.cn/"
                rel="noreferrer"
                target="_blank"
              >
                渝ICP备2026008425号-1
              </a>
            </div>
          </div>
        </div>
      </footer>
          </PageTransition>
        )}
      </>
      </MotionConfig>
    </AppBackground>
  )
}

function LazyPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<FullScreenLoader label="正在加载页面" />}>{children}</Suspense>
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
