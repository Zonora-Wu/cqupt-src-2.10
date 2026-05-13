import {
  Award,
  BookOpen,
  Bug,
  Menu,
  Moon,
  Sun,
  Terminal,
  X,
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { AppBackground } from '../../components/layout/AppBackground'
import { BrandLogo } from '../../components/layout/BrandLogo'
import { InteractivePretextParagraph } from '../../components/ui/InteractivePretextParagraph'
import { usePretextBlockMetrics } from '../../hooks/usePretextBlockMetrics'

const AboutPlatform = lazy(() => import('./AboutPlatform').then((module) => ({ default: module.AboutPlatform })))
const CertificateVerify = lazy(() =>
  import('./CertificateVerify').then((module) => ({ default: module.CertificateVerify })),
)
const LearningResources = lazy(() =>
  import('./LearningResources').then((module) => ({ default: module.LearningResources })),
)
const PlatformRules = lazy(() => import('./PlatformRules').then((module) => ({ default: module.PlatformRules })))
const PublicAnnouncements = lazy(() =>
  import('./PublicAnnouncements').then((module) => ({ default: module.PublicAnnouncements })),
)

type GuestHomeProps = {
  onLogin: () => void
  onRegister: () => void
}

const navItems = ['首页', '平台规则', '公开公告', '证书查询', '学习资源', '关于平台']

const capabilities = [
  {
    title: '漏洞响应运营',
    description: '把漏洞从“提交入口”升级为“响应工单”：统一收口、分级研判、责任单位流转、修复复测与归档追踪。',
    icon: Bug,
    metric: '闭环 SLA',
    value: '72h',
    scope: '提交 / 分派 / 修复 / 复测',
    bullets: ['标准化报告模板', '风险等级与影响范围标注', '责任单位与时间节点跟踪'],
  },
  {
    title: '安全学习体系',
    description: '围绕 Web 安全、内网安全、代码审计和应急响应组织课程、资料、工具与阶段化训练路径。',
    icon: BookOpen,
    metric: '学习路径',
    value: '4 级',
    scope: '入门 / 进阶 / 专项 / 实战',
    bullets: ['知识点地图与推荐资源', '靶场完成度记录', '漏洞案例反哺学习'],
  },
  {
    title: '授权靶场实践',
    description: '通过隔离环境提供合法、可回放、可量化的攻防训练，让学生在边界清晰的场景中积累经验。',
    icon: Terminal,
    metric: '训练场景',
    value: '18+',
    scope: '漏洞复现 / 工具练习 / 专题演练',
    bullets: ['按能力阶段开放', '训练过程可记录', '与学习中心联动推荐'],
  },
  {
    title: '贡献认证与激励',
    description: '对高价值漏洞与持续贡献进行积分、证书和荣誉记录，形成学生能力成长的可信证明。',
    icon: Award,
    metric: '贡献凭证',
    value: '可核验',
    scope: '积分 / 证书 / 排行 / 档案',
    bullets: ['证书编号公开核验', '贡献记录脱敏展示', '积分兑换与荣誉激励'],
  },
]

const processItems = [
  { title: '准入校验', detail: '注册账号、完成安全答题、签署责任书', owner: '学生 / 平台' },
  { title: '报告提交', detail: '按模板提交资产、影响、复现步骤与修复建议', owner: '学生' },
  { title: '审核分级', detail: '审核员判断真实性、影响范围、重复情况和风险等级', owner: '审核员' },
  { title: '修复协同', detail: '责任单位接收工单，反馈修复计划与处理结果', owner: '责任单位' },
  { title: '复测归档', detail: '复测修复有效性，沉淀审计记录和案例材料', owner: '审核员' },
  { title: '积分证书', detail: '按贡献价值发放积分、排行权益和可核验证书', owner: '平台' },
]
type GuestPage = 'home' | 'rules' | 'announcements' | 'certificates' | 'learning' | 'about'

const introParagraphs = [
  {
    zh: 'CQUPT-SRC 是面向校园网络安全建设的漏洞响应与安全学习平台，连接学生、学院、信息化部门与校园资产责任单位，构建从漏洞提交、分级审核、修复跟进、复测归档到积分与证书激励的全链路协同体系。它不以“收集漏洞”为终点，而是希望让每一个有效风险都能被规范记录、及时响应、持续跟踪，并最终沉淀为学校安全治理和学生能力成长的一部分。',
    en: 'CQUPT-SRC is a vulnerability response and security learning platform built for campus cybersecurity development. It connects students, the School, information technology departments, and campus asset owners, forming a full-chain collaborative system that covers vulnerability submission, severity review, remediation tracking, retesting and archiving, as well as points and certificate-based incentives. Its goal is not simply to “collect vulnerabilities,” but to ensure that every valid risk can be properly recorded, promptly responded to, continuously followed up, and eventually transformed into part of the University’s security governance and students’ capability growth.',
    zhClass: 'text-justify text-lg font-medium leading-9 text-slate-800 [text-indent:2em] dark:text-slate-200',
    enClass: 'text-justify text-[14px] leading-[1.58] text-slate-700 [text-indent:2em] dark:text-slate-300',
  },
  {
    zh: '在这里，同学可以在合法授权的范围内参与真实安全实践，获取工具资源，进入靶场训练，提交校园网络资产中的有效漏洞，并通过审核反馈、积分奖励和漏洞证书获得正向激励；审核员和管理者可以借助平台完成漏洞分级、价值判断、修复协同、复测归档、审计追踪和数据分析，让校园安全工作从零散沟通走向体系化运营。',
    en: 'Here, students can participate in real-world security practice within a lawful and authorized scope. They can access security tools and learning resources, train in cyber ranges, submit valid vulnerabilities found in campus network assets, and receive positive incentives through review feedback, points rewards, and vulnerability certificates. Reviewers and administrators can use the platform to complete vulnerability classification, value assessment, remediation coordination, retesting, archiving, audit tracing, and data analysis, enabling campus security work to move from fragmented communication toward systematic operation.',
    zhClass: 'text-justify text-lg leading-9 text-slate-600 [text-indent:2em] dark:text-slate-400',
    enClass: 'text-justify text-[14px] leading-[1.58] text-slate-600 [text-indent:2em] dark:text-slate-500',
  },
  {
    zh: '这不只是一个漏洞提交入口，也不只是一个安全学习网站，而是一个以平台驱动网络安全教育、产教融合、人才发现与校园安全治理共同发展的长期系统。它希望让学生在真实场景中建立规则意识与工程能力，让学院获得可观测的人才培养数据，让学校补足漏洞响应与安全建设能力，最终形成可复制、可持续的高校网络安全产教融合实践案例。',
    en: 'CQUPT-SRC is more than a vulnerability submission portal, and more than a security learning website. It is a long-term system that uses a platform-based approach to jointly promote cybersecurity education, industry-education integration, talent discovery, and campus security governance. It aims to help students build rule awareness and engineering capabilities in real scenarios, provide the School with observable data for talent cultivation, strengthen the University’s vulnerability response and security construction capabilities, and ultimately form a replicable and sustainable model of cybersecurity industry-education integration in higher education.',
    zhClass: 'text-justify text-lg leading-9 text-slate-600 [text-indent:2em] dark:text-slate-400',
    enClass: 'text-justify text-[14px] leading-[1.58] text-slate-600 [text-indent:2em] dark:text-slate-500',
  },
]

const navPageMap: Record<string, GuestPage> = {
  首页: 'home',
  平台规则: 'rules',
  公开公告: 'announcements',
  证书查询: 'certificates',
  学习资源: 'learning',
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
    try { localStorage.setItem('cqupt-theme', theme) } catch { /* ignore storage access errors */ }
  }, [theme])

  const openPage = (page: GuestPage) => {
    setActivePage(page)
    setMobileOpen(false)
    window.scrollTo({ top: 0 })
  }

  return (
    <AppBackground variant="public">
      <nav className="fixed left-0 right-0 top-0 z-50 border-b border-black/[0.08] bg-[#f7f9f7]/95 backdrop-blur-sm transition-colors duration-300 dark:border-white/[0.06] dark:bg-[#0f1511]/95">
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
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="border-t border-black/10 bg-[#f7f9f7] px-5 py-4 md:hidden dark:border-white/10 dark:bg-[#0f1511]"
            initial={{ opacity: 0, y: -8 }}
          >
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
          </motion.div>
        )}
      </nav>

      <AnimatePresence mode="wait">
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
        {activePage === 'learning' && (
          <PageTransition key="learning">
            <LazyPage>
              <LearningResources />
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
            <section className="relative z-10 mx-auto max-w-6xl px-5 pb-16 pt-32 md:px-8 md:pt-36 lg:pb-20">
              <div className="mx-auto max-w-4xl text-center">
                <p className="inline-flex rounded-md border border-brand-600/20 bg-brand-600/[0.04] px-3 py-1 font-mono text-xs font-medium tracking-wider text-brand-700 dark:border-green-300/20 dark:bg-green-300/[0.05] dark:text-green-300">
                  CQUPT SECURITY RESPONSE CENTER
                </p>
                <h1 className="mt-6 text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
                  校园漏洞响应与安全学习平台
                </h1>
                <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-slate-600 dark:text-slate-400">
                  面向重庆邮电大学校园网络安全建设，提供漏洞提交、审核协同、修复跟踪、学习实践与贡献认证的一体化平台。
                </p>
                <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                  <button
                    className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-6 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700"
                    onClick={onLogin}
                    type="button"
                  >
                    进入平台
                  </button>
                  <a className="inline-flex items-center justify-center rounded-lg border border-black/10 bg-white px-6 py-3 text-sm font-medium text-slate-800 transition hover:border-brand-600/30 hover:bg-brand-600/[0.03] dark:border-white/10 dark:bg-[#131a15] dark:text-slate-100" href="#certificate">
                    证书验证
                  </a>
                </div>
              </div>

              <div className="mt-12 grid items-stretch gap-5 lg:grid-cols-2">
                <DashboardPreview />
                <PlatformAccessPanel />
              </div>
            </section>

            <IntroCopySection />

            <section className="relative z-10 mx-auto max-w-6xl px-5 py-16 md:px-8">
              <div className="mb-8 grid gap-4 border-b border-black/10 pb-6 md:grid-cols-[0.9fr_1.1fr] md:items-end dark:border-white/10">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-brand-700 dark:text-green-300">Operational Modules</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight">四类核心信息模块</h2>
                </div>
                <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                  不再以单点入口呈现平台能力，而是按“响应运营、学习成长、实战训练、贡献认证”拆分为可管理的信息模块，每个模块都包含指标、边界和可执行动作。
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {capabilities.map((item) => {
                  const Icon = item.icon
                  return (
                    <article
                      className="group overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-brand-600/30 hover:shadow-md dark:border-white/10 dark:bg-[#131a15]"
                      key={item.title}
                    >
                      <div className="border-b border-black/10 bg-[#f7f9f7] px-5 py-4 dark:border-white/10 dark:bg-[#0f1511]">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 items-center justify-center rounded-md border border-brand-600/15 bg-white text-brand-700 dark:border-green-300/20 dark:bg-[#131a15] dark:text-green-300">
                              <Icon className="h-4 w-4" />
                            </span>
                            <div>
                              <h3 className="font-semibold">{item.title}</h3>
                              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.scope}</p>
                            </div>
                          </div>
                          <div className="rounded-md border border-brand-600/15 bg-brand-600/[0.04] px-3 py-2 text-right dark:border-green-300/20 dark:bg-green-300/[0.05]">
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">{item.metric}</p>
                            <p className="mt-0.5 text-lg font-semibold text-brand-700 dark:text-green-300">{item.value}</p>
                          </div>
                        </div>
                      </div>
                      <div className="p-5">
                        <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">{item.description}</p>
                        <div className="mt-4 grid gap-2">
                          {item.bullets.map((bullet) => (
                            <div className="flex items-center gap-2 rounded-md border border-black/10 bg-black/[0.02] px-3 py-2 text-sm text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300" key={bullet}>
                              <span className="h-1.5 w-1.5 rounded-full bg-brand-600 dark:bg-green-300" />
                              {bullet}
                            </div>
                          ))}
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>

            <section className="relative z-10 border-y border-black/[0.08] bg-white/80 px-5 py-16 md:px-8 dark:border-white/[0.06] dark:bg-[#131a15]/80" id="certificate">
              <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-[0.9fr_1.1fr] md:items-center">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-brand-700 dark:text-green-300">Certificate Verification</p>
                  <h2 className="mt-2 text-2xl font-semibold">证书真伪验证</h2>
                  <p className="mt-4 max-w-xl text-sm leading-7 text-slate-600 dark:text-slate-400">
                    输入证书编号或提交者 ID，验证由 CQUPT-SRC 颁发的漏洞贡献证书。验证结果仅展示证书真实性与脱敏信息，不公开漏洞细节。
                  </p>
                </div>
                <div className="rounded-lg border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#0f1511]">
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <input
                      className="min-w-0 flex-1 rounded-md border border-black/10 bg-white px-4 py-3 font-mono text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-600/50 focus:ring-2 focus:ring-brand-600/10 dark:border-white/10 dark:bg-[#131a15] dark:text-white dark:placeholder:text-slate-600"
                      placeholder="输入证书编号，例如 CQUPT-SRC-2026-VULN-000001"
                      type="text"
                    />
                    <button className="rounded-md bg-brand-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-brand-700" type="button">
                      查询
                    </button>
                  </div>
                  <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">支持证书编号、查询码和脱敏身份信息核验。</p>
                </div>
              </div>
            </section>

            <section className="relative z-10 mx-auto max-w-6xl px-5 py-16 md:px-8">
              <div className="mx-auto mb-10 max-w-3xl text-center">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-brand-700 dark:text-green-300">Workflow</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">安全参与流程</h2>
                <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-slate-500 dark:text-slate-400">
                  每一步都对应明确的责任角色和平台记录，避免线下沟通断点。
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {processItems.map((item, index) => (
                  <div
                    className="flex flex-col rounded-lg border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#131a15]"
                    key={item.title}
                  >
                    <span className="font-mono text-xs text-brand-700 dark:text-green-300">
                      STEP {String(index + 1).padStart(2, '0')}
                    </span>
                    <h3 className="mt-3 font-semibold">{item.title}</h3>
                    <p className="mt-2 flex-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                      {item.detail}
                    </p>
                    <span className="mt-4 w-fit rounded-md border border-black/10 px-2.5 py-1 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
                      {item.owner}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <footer className="relative z-10 border-t border-black/[0.08] bg-white px-5 py-8 md:px-8 dark:border-white/[0.06] dark:bg-slate-950">
              <div className="mx-auto flex max-w-[1440px] flex-col items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400 md:flex-row">
                <div className="font-semibold tracking-tight text-slate-950 dark:text-white">CQUPT-SRC</div>
                <div className="flex gap-6">
                  <a className="transition hover:text-brand-700 dark:hover:text-green-300" href="#">隐私政策</a>
                  <a className="transition hover:text-brand-700 dark:hover:text-green-300" href="#">用户协议</a>
                  <a className="transition hover:text-brand-700 dark:hover:text-green-300" href="#">联系我们</a>
                  <a className="transition hover:text-brand-700 dark:hover:text-green-300" href="#">加入我们</a>
                </div>
                <div>© 2026 CQUPT-SRC 校园漏洞响应与安全学习平台.</div>
              </div>
            </footer>
          </PageTransition>
        )}
      </AnimatePresence>
    </AppBackground>
  )
}

function LazyPage({ children }: { children: React.ReactNode }) {
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

function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      animate={{ opacity: 1, scale: 1 }}
      className="overflow-hidden"
      exit={{ opacity: 0, scale: 0.998 }}
      initial={{ opacity: 0, scale: 0.998 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}

function DashboardPreview() {
  const metrics = [
    { label: '待审核报告', value: '12', hint: '含 3 个高优先级' },
    { label: '平均响应', value: '2.6h', hint: '首次审核耗时' },
    { label: '修复闭环率', value: '86%', hint: '近 30 日' },
  ]
  const queues = [
    { label: '高危复核', value: '3', bar: 'w-3/4', tone: 'bg-red-500' },
    { label: '责任单位确认', value: '5', bar: 'w-1/2', tone: 'bg-amber-500' },
    { label: '等待复测', value: '4', bar: 'w-2/5', tone: 'bg-brand-600' },
  ]

  return (
    <div className="flex h-full flex-col rounded-lg border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#131a15]">
      <div className="flex items-start justify-between gap-4 rounded-lg border border-black/10 bg-[#f7f9f7] p-4 dark:border-white/10 dark:bg-[#0f1511]">
        <div>
          <p className="font-mono text-xs text-brand-700 dark:text-green-300">PLATFORM STATUS</p>
          <h3 className="mt-1 text-lg font-semibold">运行态势概览</h3>
        </div>
        <span className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
          服务正常
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {metrics.map((item) => (
          <div className="rounded-lg border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#0f1511]" key={item.label}>
            <p className="text-xs text-slate-500 dark:text-slate-400">{item.label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">{item.value}</p>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-500">{item.hint}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex-1 rounded-lg border border-black/10 bg-[#f7f9f7] p-4 dark:border-white/10 dark:bg-[#0f1511]">
        <div className="mb-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>当前处理队列</span>
          <span>按优先级排序</span>
        </div>
        <div className="space-y-3">
          {queues.map((item) => (
            <div className="rounded-lg border border-black/10 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-[#131a15]" key={item.label}>
              <div className="flex items-center justify-between text-sm">
                <span>{item.label}</span>
                <span className="font-semibold">{item.value}</span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-black/10 dark:bg-white/10">
                <div className={`h-full rounded-full ${item.tone} ${item.bar}`} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function PlatformAccessPanel() {
  const items = [
    { label: '授权边界', value: '校内资产', text: '仅在平台规则和责任书约束下开展测试。' },
    { label: '响应闭环', value: '全程留痕', text: '提交、审核、修复、复测和证书签发均保留记录。' },
    { label: '成长路径', value: '学习联动', text: '漏洞案例、靶场训练和资料推荐形成能力闭环。' },
  ]

  return (
    <div className="flex h-full flex-col rounded-lg border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#131a15]">
      <div className="rounded-lg border border-brand-600/15 bg-brand-600/[0.04] p-4 dark:border-green-300/20 dark:bg-green-300/[0.05]">
        <p className="font-mono text-xs text-brand-700 dark:text-green-300">PARTICIPATION GUIDE</p>
        <h3 className="mt-1 text-lg font-semibold">参与与治理边界</h3>
        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
          平台强调合法授权、过程可追踪和贡献可认证，适合学生参与真实校园安全实践，也方便管理侧开展持续运营。
        </p>
      </div>

      <div className="mt-4 grid flex-1 gap-3">
        {items.map((item) => (
          <div className="rounded-lg border border-black/10 bg-[#f7f9f7] p-4 dark:border-white/10 dark:bg-[#0f1511]" key={item.label}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold">{item.label}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{item.text}</p>
              </div>
              <span className="shrink-0 rounded-md border border-black/10 bg-white px-2.5 py-1 text-xs font-medium text-brand-700 dark:border-white/10 dark:bg-[#131a15] dark:text-green-300">
                {item.value}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-lg border border-brand-600/15 bg-brand-600/[0.04] p-4 text-sm leading-6 text-slate-700 dark:border-green-300/20 dark:bg-green-300/[0.05] dark:text-slate-300">
        今日建议：优先复核统一认证和校园门户相关报告，推动责任单位在 SLA 内完成首次确认。
      </div>
    </div>
  )
}

function IntroCopySection() {
  const { clearPointer, handlePointerLeave, handlePointerMove, pointer } = useRafPointer()

  return (
    <section
      className="relative z-10 mx-auto max-w-6xl border-t border-black/[0.08] px-5 py-20 md:px-8 dark:border-white/[0.06]"
      onPointerLeave={handlePointerLeave}
      onPointerMove={handlePointerMove}
      onWheel={clearPointer}
    >
      <div className="grid gap-x-20 gap-y-8 lg:grid-cols-2">
        <div className="h-1 w-12 rounded-lg bg-brand-600" />
        <div className="hidden h-1 w-12 rounded-lg bg-slate-700 lg:block" />
        {introParagraphs.map((paragraph) => (
          <div className="contents" key={paragraph.zh}>
            <MeasuredParagraph className={paragraph.zhClass} locale="zh-CN" pointer={pointer} text={paragraph.zh} />
            <MeasuredParagraph className={paragraph.enClass} locale="en-US" pointer={pointer} text={paragraph.en} />
          </div>
        ))}
      </div>
    </section>
  )
}

function useRafPointer() {
  const frameRef = useRef<number | null>(null)
  const pendingPointerRef = useRef<{ x: number; y: number } | null>(null)
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null)

  const clearPointer = useCallback(() => {
    pendingPointerRef.current = null
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
    setPointer(null)
  }, [])

  const flushPointer = useCallback(() => {
    frameRef.current = null
    setPointer(pendingPointerRef.current)
  }, [])

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      pendingPointerRef.current = { x: event.clientX, y: event.clientY }
      if (frameRef.current === null) {
        frameRef.current = window.requestAnimationFrame(flushPointer)
      }
    },
    [flushPointer],
  )

  const handlePointerLeave = useCallback(() => {
    clearPointer()
  }, [clearPointer])

  useEffect(() => {
    window.addEventListener('scroll', clearPointer, { passive: true })

    return () => {
      window.removeEventListener('scroll', clearPointer)
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current)
      }
    }
  }, [clearPointer])

  return { clearPointer, handlePointerLeave, handlePointerMove, pointer }
}

function MeasuredParagraph({
  className,
  locale,
  pointer,
  text,
}: {
  className: string
  locale: string
  pointer: { x: number; y: number } | null
  text: string
}) {
  const { metrics, ref } = usePretextBlockMetrics<HTMLParagraphElement>(text, { locale })

  return (
    <div data-pretext-height={Math.round(metrics.height)} data-pretext-lines={metrics.lineCount} ref={ref}>
      <InteractivePretextParagraph className={className} locale={locale} pointer={pointer} text={text} />
    </div>
  )
}
