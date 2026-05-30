import {
  AlertCircle,
  ArrowRight,
  Award,
  Bell,
  Bot,
  Brain,
  BookOpen,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FileSignature,
  FilePlus2,
  FileSearch,
  Gauge,
  Moon,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  Store,
  Sun,
  Target,
  Trophy,
  X,
} from 'lucide-react'
import { lazy, Suspense, useEffect, useState, type MouseEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AppBackground } from '../../components/layout/AppBackground'
import { BrandLogo } from '../../components/layout/BrandLogo'
import { ScrollableNav } from '../../components/navigation/ScrollableNav'
import { UserAvatarMenu } from '../../components/navigation/UserAvatarMenu'
import { ResponsibilityAgreementDialog } from '../../components/security/ResponsibilityAgreementDialog'
import { SecurityExamDialog } from '../../components/security/SecurityExamDialog'
import { SurfacePanel } from '../../components/ui/SurfacePanel'
import { getAccessStatus, type AccessStatus } from '../../services/access'
import { getAiSkills, type AiSkillLibraryItem } from '../../services/ai'
import { type AuthUser } from '../../services/auth'
import { getUserDashboard } from '../../services/dashboard'
import { getAccountProfile } from '../../services/account'
import {
  getUserDevicePreferences,
  resolveThemeMode,
  saveUserDevicePreferences,
  type EffectiveTheme,
  type ThemeMode,
  type UserDevicePreferences,
} from '../../services/userPreferences'
import { applyColorTheme, transitionColorTheme } from '../../utils/themeTransition'

const UserAIAssistant = lazy(() =>
  import('./UserAIAssistant').then((module) => ({ default: module.UserAIAssistant })),
)
const UserAnnouncements = lazy(() =>
  import('./UserAnnouncements').then((module) => ({ default: module.UserAnnouncements })),
)
const UserCertificates = lazy(() =>
  import('./UserCertificates').then((module) => ({ default: module.UserCertificates })),
)
const UserLeaderboard = lazy(() =>
  import('./UserLeaderboard').then((module) => ({ default: module.UserLeaderboard })),
)
const UserLearningCenter = lazy(() =>
  import('./UserLearningCenter').then((module) => ({ default: module.UserLearningCenter })),
)
const UserMyVulnerabilities = lazy(() =>
  import('./UserMyVulnerabilities').then((module) => ({ default: module.UserMyVulnerabilities })),
)
const UserNotifications = lazy(() =>
  import('./UserNotifications').then((module) => ({ default: module.UserNotifications })),
)
const UserAccountSecurity = lazy(() =>
  import('./UserAccountSecurity').then((module) => ({ default: module.UserAccountSecurity })),
)
const UserPointsMall = lazy(() =>
  import('./UserPointsMall').then((module) => ({ default: module.UserPointsMall })),
)
const UserProfile = lazy(() =>
  import('./UserProfile').then((module) => ({ default: module.UserProfile })),
)
const UserSubmitVulnerability = lazy(() =>
  import('./UserSubmitVulnerability').then((module) => ({ default: module.UserSubmitVulnerability })),
)
const UserSystemSettings = lazy(() =>
  import('./UserSystemSettings').then((module) => ({ default: module.UserSystemSettings })),
)

type UserHomeProps = {
  onLogout: () => void
  user: AuthUser
}

const quickActions = [
  { title: '提交漏洞', description: '上传漏洞报告、截图与复现材料', icon: FilePlus2 },
  { title: '进入靶场', description: '选择适合当前能力阶段的训练环境', icon: Target },
  { title: '学习资源', description: '下载工具资源与安全学习资料', icon: BookOpen },
  { title: '积分商城', description: '查看可兑换奖励和申请记录', icon: Store },
]

const aiCapabilities = [
  {
    title: '漏洞报告 AI 提交功能',
    description: '上传 PDF 或 Markdown 报告后，辅助提取标题、资产、类型、复现步骤和修复建议。',
    icon: FileSearch,
  },
  {
    title: '漏洞价值预判',
    description: '结合影响范围、可利用性、复现完整度，给出风险提示和材料补全建议。',
    icon: SearchCheck,
  },
  {
    title: '学习路径推荐',
    description: '根据提交记录、靶场进度和知识薄弱点，推荐工具资源与下一阶段训练。',
    icon: Brain,
  },
]

const fallbackAiSkills: AiSkillLibraryItem[] = [
  {
    aiSpace: 'STUDENT',
    content: '辅助整理漏洞标题、影响资产、复现步骤、影响说明、修复建议与附件清单。',
    id: 'local-report-polish',
    source: 'platform-default',
    title: '漏洞报告整理',
  },
  {
    aiSpace: 'STUDENT',
    content: '提醒 token、Cookie、密码、手机号、学号等敏感信息先脱敏再提交。',
    id: 'local-redaction',
    source: 'platform-default',
    title: '敏感信息脱敏',
  },
  {
    aiSpace: 'STUDENT',
    content: '结合 Web 安全基础、权限控制、注入与文件上传方向推荐下一步训练。',
    id: 'local-learning-path',
    source: 'platform-default',
    title: '学习路径推荐',
  },
]

const activities = [
  { title: 'AI 建议为“弱口令风险报告”补充影响范围截图', time: '今天 10:24', tone: 'bg-brand-600' },
  { title: 'SQL 注入基础靶场已推荐到你的学习路径', time: '昨天 18:36', tone: 'bg-amber-500' },
  { title: 'Web 基础靶场已完成 70%，建议进入权限控制专题', time: '04-25 21:10', tone: 'bg-blue-500' },
]

const menuItems = [
  '首页',
  '提交漏洞',
  '我的漏洞',
  '我的证书',
  '积分商城',
  '排行榜',
  '学习中心',
  'AI助手',
  '平台公告',
]

function hasPendingAccessTasks(status: AccessStatus | null) {
  if (!status) return false
  const needsAgreement = status.responsibilityAgreementRequired && !status.responsibilitySigned
  const needsExam = status.securityExamRequired && !status.securityExamPassed
  return needsAgreement || needsExam
}

export function UserHome({ onLogout, user }: UserHomeProps) {
  const preferenceKey = user.id ?? user.unifiedCode
  const [activeMenu, setActiveMenu] = useState('首页')
  const [aiFocused, setAiFocused] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [pendingAiPrompt, setPendingAiPrompt] = useState<string | null>(null)
  const [preferences, setPreferences] = useState<UserDevicePreferences>(() =>
    getUserDevicePreferences(preferenceKey),
  )
  const [theme, setTheme] = useState<EffectiveTheme>(() => resolveThemeMode(preferences.themeMode))
  const [dashStats, setDashStats] = useState({ submitCount: 0, confirmedCount: 0, currentPoints: 0, certCount: 0 })
  const [aiSkills, setAiSkills] = useState<AiSkillLibraryItem[]>(fallbackAiSkills)
  const [navAvatarUrl, setNavAvatarUrl] = useState<string | null>(null)
  const [accessStatus, setAccessStatus] = useState<AccessStatus | null>(null)
  const [showAccessTodoDialog, setShowAccessTodoDialog] = useState(false)
  const [showResponsibilityDialog, setShowResponsibilityDialog] = useState(false)

  // 加载准入状态，新用户未完成责任书或安全答题时进入首页弹窗提醒
  useEffect(() => {
    let active = true
    getAccessStatus()
      .then((status) => {
        if (!active) return
        setAccessStatus(status)
        setShowAccessTodoDialog(hasPendingAccessTasks(status))
      })
      .catch(() => { /* 静默失败，提交时后端仍会强制校验 */ })
    return () => { active = false }
  }, [])

  // 加载头像用于导航栏
  useEffect(() => {
    getAccountProfile()
      .then((data) => setNavAvatarUrl(data.account.avatarUrl ?? null))
      .catch(() => { /* 静默失败 */ })
  }, [])

  // 加载仪表盘数据
  useEffect(() => {
    getUserDashboard()
      .then((data) => setDashStats(data))
      .catch(() => { /* 静默失败，福贝默认值 */ })
  }, [])

  // 加载平台公共 AI skill 库
  useEffect(() => {
    getAiSkills()
      .then((data) => setAiSkills(data.skills.length > 0 ? data.skills : fallbackAiSkills))
      .catch(() => { /* 静默失败，保留内置 skill 展示 */ })
  }, [])

  const stats = [
    { label: '累计提交', value: String(dashStats.submitCount), hint: '漏洞报告', icon: FilePlus2 },
    { label: '有效漏洞', value: String(dashStats.confirmedCount), hint: '已通过审核', icon: ShieldCheck },
    { label: '当前积分', value: String(dashStats.currentPoints), hint: '可兑换资源', icon: Trophy },
    { label: '证书数量', value: String(dashStats.certCount), hint: '高价值贡献', icon: Award },
  ]

  const notifUnread = Object.values(preferences.notifications).some(Boolean) ? 3 : 0

  useEffect(() => {
    const nextTheme = resolveThemeMode(preferences.themeMode)
    setTheme(nextTheme)
    applyColorTheme(nextTheme)
    document.documentElement.dataset.motion = preferences.reduceMotion ? 'reduced' : 'default'
    saveUserDevicePreferences(preferenceKey, preferences)
  }, [preferenceKey, preferences])

  useEffect(() => {
    if (preferences.themeMode !== 'system') return

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const syncSystemTheme = () => {
      const nextTheme = resolveThemeMode('system')
      setTheme(nextTheme)
      applyColorTheme(nextTheme)
    }

    media.addEventListener('change', syncSystemTheme)
    return () => media.removeEventListener('change', syncSystemTheme)
  }, [preferences.themeMode])

  const updatePreferences = (nextPreferences: UserDevicePreferences) => {
    setPreferences(nextPreferences)
  }

  const changeThemeMode = (themeMode: ThemeMode, event?: MouseEvent<HTMLElement>) => {
    if (themeMode === 'light' || themeMode === 'dark') {
      transitionColorTheme(themeMode, event)
    }
    setPreferences((current) => ({ ...current, themeMode }))
  }

  const submitHomeAiPrompt = () => {
    const content = aiPrompt.trim()
    if (!content) {
      setAiFocused(true)
      return
    }

    setPendingAiPrompt(content)
    setAiPrompt('')
    setAiFocused(false)
    setActiveMenu('AI助手')
  }

  const refreshAccessStatus = async () => {
    const status = await getAccessStatus()
    setAccessStatus(status)
    setShowAccessTodoDialog(hasPendingAccessTasks(status))
    return status
  }

  const openResponsibilityDialog = () => {
    setShowAccessTodoDialog(false)
    setShowResponsibilityDialog(true)
  }

  const openSecurityExamPage = () => {
    setShowAccessTodoDialog(false)
    setActiveMenu('安全答题')
  }

  return (
    <AppBackground className={preferences.compactMode ? 'user-compact-mode' : ''}>
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-black/[0.08] bg-[#f7f9f7]/80 backdrop-blur-xl transition-colors duration-300 dark:border-white/[0.06] dark:bg-[#0f1511]/75">
        <div className="mx-auto grid h-16 max-w-[1440px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-5 md:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <BrandLogo />
          </div>

          <ScrollableNav activeItem={activeMenu} items={menuItems} onChange={setActiveMenu} />

          <div className="flex items-center justify-end gap-2">
            <button
              aria-label="通知"
              className="relative rounded-lg p-2 text-slate-600 transition hover:bg-black/5 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
              onClick={() => setActiveMenu('通知')}
              type="button"
            >
              <Bell className="h-5 w-5" />
              {notifUnread > 0 && activeMenu !== '通知' && (
                <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {notifUnread}
                </span>
              )}
            </button>
            <button
              aria-label="切换主题"
              className="rounded-lg p-2 text-slate-600 transition hover:bg-black/5 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
              onClick={(event) => changeThemeMode(theme === 'dark' ? 'light' : 'dark', event)}
              type="button"
            >
              {theme === 'dark' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </button>
            <UserAvatarMenu
              avatarUrl={navAvatarUrl}
              name={user.name}
              onAccountSecurity={() => setActiveMenu('账号安全')}
              onLogout={onLogout}
              onProfile={() => setActiveMenu('个人中心')}
              onSystemSettings={() => setActiveMenu('系统设置')}
            />
          </div>
        </div>
        <div className="border-t border-black/5 px-5 py-2 md:hidden dark:border-white/10">
          <ScrollableNav activeItem={activeMenu} items={menuItems} mobile onChange={setActiveMenu} />
        </div>
      </header>

      {activeMenu !== '首页' ? (
        <Suspense fallback={<UserPageLoading />}>
          {activeMenu === '安全答题' ? (
            <SecurityExamPage
              onBack={() => setActiveMenu('首页')}
              onPassed={() => {
                void refreshAccessStatus().then((status) => {
                  if (!hasPendingAccessTasks(status)) setActiveMenu('首页')
                })
              }}
            />
          ) : activeMenu === '提交漏洞' ? (
            <UserSubmitVulnerability />
          ) : activeMenu === '我的漏洞' ? (
            <UserMyVulnerabilities />
          ) : activeMenu === '学习中心' ? (
            <UserLearningCenter />
          ) : activeMenu === 'AI助手' ? (
            <UserAIAssistant
              initialPrompt={pendingAiPrompt}
              onInitialPromptConsumed={() => setPendingAiPrompt(null)}
            />
          ) : activeMenu === '积分商城' ? (
            <UserPointsMall />
          ) : activeMenu === '我的证书' ? (
            <UserCertificates />
          ) : activeMenu === '排行榜' ? (
            <UserLeaderboard />
          ) : activeMenu === '平台公告' ? (
            <UserAnnouncements />
          ) : activeMenu === '个人中心' ? (
            <UserProfile onAvatarChange={setNavAvatarUrl} user={user} />
          ) : activeMenu === '账号安全' ? (
            <UserAccountSecurity />
          ) : activeMenu === '系统设置' ? (
            <UserSystemSettings
              effectiveTheme={theme}
              onPreferencesChange={updatePreferences}
              preferences={preferences}
              userKey={preferenceKey}
            />
          ) : (
            <UserNotifications />
          )}
        </Suspense>
      ) : (
        <section className="relative z-10 mx-auto max-w-[1360px] px-5 pb-8 pt-24 md:px-8">
          <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1.45fr)_390px]">
            <SurfacePanel
              className="h-full overflow-hidden p-0"
              onMouseLeave={() => {
                if (!aiPrompt.trim()) setAiFocused(false)
              }}
            >
              <div className="relative flex min-h-[500px] h-full flex-col p-7 md:p-10">
                <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-brand-600/25 to-transparent dark:via-green-300/25" />
                <div className="pointer-events-none absolute right-12 top-12 hidden h-40 w-40 rounded-full bg-brand-600/10 blur-3xl md:block dark:bg-green-300/10" />

                <div className="flex h-full flex-col">
                  <div>
                    <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-brand-700 dark:text-green-300">
                      <Sparkles className="h-3.5 w-3.5" />
                      YouBao AI
                    </p>

                    <div className="mt-12 max-w-3xl">
                      <h1 className="text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
                        欢迎回来，{user.name}
                        <span className="mt-3 block text-brand-700 dark:text-green-300">把漏洞报告交给邮宝先整理一遍。</span>
                      </h1>
                      <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 dark:text-slate-400">
                        邮宝可以辅助提取报告关键信息、检查复现材料完整度，并根据你的学习进度推荐下一步训练内容。
                      </p>
                    </div>
                  </div>

                  <div className="mt-auto pt-12">
                    <div
                      className={`group flex w-full items-center justify-between gap-4 rounded-lg border px-5 py-4 text-left shadow-sm transition-all duration-500 ease-out ${
                        aiFocused
                          ? 'translate-y-1 border-brand-600/35 bg-white/90 shadow-lg shadow-brand-600/10 ring-4 ring-brand-600/10 dark:border-green-300/25 dark:bg-white/[0.08] dark:ring-green-300/10'
                          : 'border-black/10 bg-white/60 hover:border-brand-600/25 hover:bg-white/85 dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.07]'
                      }`}
                      onClick={() => setAiFocused(true)}
                    >
                      <span className="flex-1 min-w-0 flex items-center gap-3">
                        <Bot className="h-5 w-5 shrink-0 text-brand-700 dark:text-green-300" />
                        <input
                          className="w-full min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-500 dark:text-slate-100 dark:placeholder:text-slate-400"
                          onChange={(event) => setAiPrompt(event.target.value)}
                          onFocus={() => setAiFocused(true)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault()
                              submitHomeAiPrompt()
                            }
                          }}
                          placeholder="让邮宝帮我分析报告、补全漏洞信息或规划学习路径"
                          type="text"
                          value={aiPrompt}
                        />
                      </span>
                      <button
                        className="inline-flex shrink-0 items-center gap-2 rounded-md px-2 py-1 text-sm font-medium text-brand-700 transition hover:bg-brand-600/10 dark:text-green-300 dark:hover:bg-green-300/10"
                        onClick={(event) => {
                          event.stopPropagation()
                          submitHomeAiPrompt()
                        }}
                        type="button"
                      >
                        发送
                        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                      </button>
                    </div>

                    <div
                      className={`grid items-stretch gap-4 overflow-hidden border-t border-black/10 transition-all duration-500 ease-out md:grid-cols-3 dark:border-white/10 ${
                        aiFocused
                          ? 'mt-0 max-h-0 translate-y-8 border-transparent pt-0 opacity-0'
                          : 'mt-6 max-h-56 translate-y-0 pt-6 opacity-100'
                      }`}
                    >
                      {aiCapabilities.map((item) => {
                        const Icon = item.icon
                        return (
                          <button
                            className="group flex h-full flex-col rounded-lg px-1 py-1 text-left transition hover:bg-black/[0.025] dark:hover:bg-white/[0.035]"
                            key={item.title}
                            type="button"
                          >
                            <div className="flex min-h-6 items-center gap-2">
                              <Icon className="h-4 w-4 shrink-0 text-brand-700/80 dark:text-green-300/80" />
                              <p className="text-sm font-medium">{item.title}</p>
                            </div>
                            <p className="mt-2 flex-1 text-sm leading-6 text-slate-500 dark:text-slate-400">{item.description}</p>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </SurfacePanel>

            <div className="grid h-full gap-5 xl:grid-rows-[auto_1fr]">
              <SurfacePanel className="p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">个人数据汇总</p>
                    <h2 className="mt-1 text-xl font-semibold">安全实践概览</h2>
                  </div>
                  <ShieldCheck className="h-9 w-9 text-brand-700 dark:text-green-300" />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {stats.map((item) => {
                    const Icon = item.icon
                    return (
                      <div
                        className="rounded-lg border border-black/5 bg-black/[0.025] p-3 dark:border-white/10 dark:bg-white/[0.035]"
                        key={item.label}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <Icon className="h-4 w-4 text-brand-700 dark:text-green-300" />
                          <span className="text-2xl font-semibold">{item.value}</span>
                        </div>
                        <p className="mt-2 text-sm font-medium">{item.label}</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.hint}</p>
                      </div>
                    )
                  })}
                </div>
              </SurfacePanel>

              <SurfacePanel className="flex h-full flex-col p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">AI Skill 库</p>
                    <h2 className="mt-1 text-xl font-semibold">平台公共能力沉淀</h2>
                  </div>
                  <Gauge className="h-9 w-9 text-brand-700 dark:text-green-300" />
                </div>
                <div className="mt-4 grid flex-1 content-start gap-3">
                  {aiSkills.slice(0, 4).map((item) => (
                    <div
                      className="rounded-lg border border-black/5 bg-black/[0.025] p-3 dark:border-white/10 dark:bg-white/[0.035]"
                      key={item.id}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <Brain className="h-4 w-4 shrink-0 text-brand-700 dark:text-green-300" />
                          <span className="truncate text-sm font-medium">{item.title}</span>
                        </div>
                        <span className="rounded-full bg-brand-600/10 px-2 py-0.5 text-[11px] font-medium text-brand-700 dark:bg-green-300/10 dark:text-green-300">
                          {item.aiSpace === 'STUDENT' ? '学生' : item.aiSpace === 'AUDITOR' ? '审核' : '管理'}
                        </span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{item.content}</p>
                    </div>
                  ))}
                </div>
              </SurfacePanel>
            </div>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
            <SurfacePanel className="p-6">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-xl font-semibold">快捷入口</h2>
                <Clock3 className="h-5 w-5 text-slate-400" />
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {quickActions.map((item) => {
                  const Icon = item.icon
                  return (
                    <button
                      className="group rounded-lg border border-black/10 p-4 text-left transition hover:border-brand-600/30 hover:bg-brand-600/5 dark:border-white/10 dark:hover:bg-white/[0.06]"
                      key={item.title}
                      onClick={() => setActiveMenu(item.title === '进入靶场' || item.title === '学习资源' ? '学习中心' : item.title)}
                      type="button"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <Icon className="h-5 w-5 text-brand-700 dark:text-green-300" />
                        <ChevronRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-1" />
                      </div>
                      <p className="mt-4 font-semibold">{item.title}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">{item.description}</p>
                    </button>
                  )
                })}
              </div>
            </SurfacePanel>

            <SurfacePanel className="p-6">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-xl font-semibold">AI 动态与学习提醒</h2>
                <Sparkles className="h-5 w-5 text-slate-400" />
              </div>
              <div className="mt-5 space-y-4">
                {activities.map((item) => (
                  <div className="flex gap-4 rounded-lg border border-black/5 p-4 dark:border-white/10" key={item.title}>
                    <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${item.tone}`} />
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </SurfacePanel>
          </div>
        </section>
      )}
      <AccessTodoDialog
        accessStatus={accessStatus}
        onClose={() => setShowAccessTodoDialog(false)}
        onOpenAgreement={openResponsibilityDialog}
        onStartExam={openSecurityExamPage}
        open={showAccessTodoDialog && hasPendingAccessTasks(accessStatus)}
      />
      <ResponsibilityAgreementDialog
        accessStatus={accessStatus}
        onClose={() => setShowResponsibilityDialog(false)}
        onSigned={async () => {
          await refreshAccessStatus()
        }}
        open={showResponsibilityDialog}
      />
    </AppBackground>
  )
}

function UserPageLoading() {
  return (
    <section className="relative z-10 mx-auto max-w-[960px] px-5 pb-8 pt-24 md:px-8">
      <SurfacePanel className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
        正在加载页面...
      </SurfacePanel>
    </section>
  )
}

function AccessTodoDialog({
  accessStatus,
  onClose,
  onOpenAgreement,
  onStartExam,
  open,
}: {
  accessStatus: AccessStatus | null
  onClose: () => void
  onOpenAgreement: () => void
  onStartExam: () => void
  open: boolean
}) {
  if (!open || typeof document === 'undefined') return null

  const needsAgreement = Boolean(accessStatus?.responsibilityAgreementRequired && !accessStatus.responsibilitySigned)
  const needsExam = Boolean(accessStatus?.securityExamRequired && !accessStatus.securityExamPassed)

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/35 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-lg border border-black/10 bg-white shadow-2xl dark:border-white/10 dark:bg-[#131a15]">
        <div className="flex items-start justify-between gap-4 border-b border-black/10 p-5 dark:border-white/10">
          <div>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-300" />
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">还有待完成的准入事项</h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              完成责任书签署和安全答题后，即可获得完整的漏洞提交权限。
            </p>
          </div>
          <button
            aria-label="关闭"
            className="rounded-lg p-2 text-slate-500 transition hover:bg-black/5 dark:hover:bg-white/10"
            onClick={onClose}
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-3 p-5">
          <AccessTaskCard
            actionLabel={needsAgreement ? '签署责任书' : '已完成'}
            description="请阅读平台授权测试责任书，阅读 60 秒后可签署当前版本。"
            disabled={!needsAgreement}
            icon={<FileSignature className="h-5 w-5" />}
            onClick={onOpenAgreement}
            status={needsAgreement ? '待完成' : '已完成'}
            title="责任书签署"
          />
          <AccessTaskCard
            actionLabel={needsExam ? '去答题' : '已通过'}
            description={`完成网络安全知识答题，达到 ${accessStatus?.examThreshold ?? 80} 分后通过准入。`}
            disabled={!needsExam}
            icon={<ClipboardCheck className="h-5 w-5" />}
            onClick={onStartExam}
            status={needsExam ? '待完成' : '已通过'}
            title="安全准入答题"
          />
        </div>
      </div>
    </div>,
    document.body,
  )
}

function AccessTaskCard({
  actionLabel,
  description,
  disabled,
  icon,
  onClick,
  status,
  title,
}: {
  actionLabel: string
  description: string
  disabled: boolean
  icon: ReactNode
  onClick: () => void
  status: string
  title: string
}) {
  return (
    <div className="rounded-lg border border-black/10 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.035]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-600/10 text-brand-700 dark:text-green-300">
            {icon}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-slate-950 dark:text-white">{title}</h3>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${disabled ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-amber-500/10 text-amber-700 dark:text-amber-200'}`}>
                {status}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p>
          </div>
        </div>
        <button
          className="inline-flex shrink-0 items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-55"
          disabled={disabled}
          onClick={onClick}
          type="button"
        >
          {actionLabel}
        </button>
      </div>
    </div>
  )
}

function SecurityExamPage({ onBack, onPassed }: { onBack: () => void; onPassed: () => void }) {
  return (
    <section className="relative z-10 mx-auto max-w-6xl px-5 pb-10 pt-24 md:px-8">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-xs font-medium tracking-wider text-brand-700 dark:text-green-300">SECURITY ACCESS</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">安全准入答题</h1>
          <p className="mt-3 max-w-3xl leading-7 text-slate-600 dark:text-slate-400">
            完成答题并达到平台要求分数后，即可更新准入状态。
          </p>
        </div>
        <button
          className="rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-black/5 hover:text-slate-950 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
          onClick={onBack}
          type="button"
        >
          返回首页
        </button>
      </div>
      <SecurityExamDialog embedded onClose={onBack} onPassed={onPassed} open />
    </section>
  )
}
