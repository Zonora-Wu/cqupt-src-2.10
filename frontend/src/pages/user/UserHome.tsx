import {
  ArrowRight,
  Award,
  Bell,
  Bot,
  Brain,
  BookOpen,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FilePlus2,
  FileSearch,
  Lightbulb,
  Moon,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  Store,
  Sun,
  Target,
  Trophy,
  WandSparkles,
} from 'lucide-react'
import { lazy, Suspense, useEffect, useState } from 'react'
import { AppBackground } from '../../components/layout/AppBackground'
import { BrandLogo } from '../../components/layout/BrandLogo'
import { ScrollableNav } from '../../components/navigation/ScrollableNav'
import { UserAvatarMenu } from '../../components/navigation/UserAvatarMenu'
import { SectionHeader } from '../../components/ui/SectionHeader'
import { SurfacePanel } from '../../components/ui/SurfacePanel'
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
  { title: '提交漏洞', description: '上传漏洞报告、截图与复现材料', icon: FilePlus2, meta: '报告入口', cta: '开始提交' },
  { title: '进入靶场', description: '选择适合当前能力阶段的训练环境', icon: Target, meta: '训练建议', cta: '继续训练' },
  { title: '学习资源', description: '下载工具资源与安全学习资料', icon: BookOpen, meta: '资料库', cta: '查看路径' },
  { title: '积分商城', description: '查看可兑换奖励和申请记录', icon: Store, meta: '权益中心', cta: '兑换权益' },
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

const aiTasks = [
  { label: '待 AI 补全报告', value: '2', priority: '高', description: '缺少影响截图与资产边界说明', icon: WandSparkles },
  { label: '建议复测漏洞', value: '1', priority: '中', description: '责任单位已标记修复完成', icon: ClipboardCheck },
  { label: '今日学习建议', value: '4', priority: '低', description: '根据靶场进度生成练习清单', icon: Lightbulb },
]

const activities = [
  { title: 'AI 建议为“弱口令风险报告”补充影响范围截图', time: '今天 10:24', tone: 'bg-brand-600', type: '报告优化' },
  { title: 'SQL 注入基础靶场已推荐到你的学习路径', time: '昨天 18:36', tone: 'bg-amber-500', type: '学习推荐' },
  { title: 'Web 基础靶场已完成 70%，建议进入权限控制专题', time: '04-25 21:10', tone: 'bg-blue-500', type: '训练进度' },
]

const learningProgress = [
  { label: '报告完整度', value: '78%', width: 'w-[78%]' },
  { label: '靶场进度', value: '64%', width: 'w-[64%]' },
  { label: '本周活跃', value: '5 天', width: 'w-[72%]' },
]

const menuItems = [
  '首页',
  '提交漏洞',
  '我的漏洞',
  '我的证书',
  '积分商城',
  '排行榜',
  '学习中心',
  'AI 助手',
  '平台公告',
]

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
  const [navAvatarUrl, setNavAvatarUrl] = useState<string | null>(null)

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
    document.documentElement.classList.toggle('dark', nextTheme === 'dark')
    document.documentElement.dataset.motion = preferences.reduceMotion ? 'reduced' : 'default'
    saveUserDevicePreferences(preferenceKey, preferences)
    try { localStorage.setItem('cqupt-theme', nextTheme) } catch { /* ignore storage access errors */ }
  }, [preferenceKey, preferences])

  useEffect(() => {
    if (preferences.themeMode !== 'system') return

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const syncSystemTheme = () => {
      const nextTheme = resolveThemeMode('system')
      setTheme(nextTheme)
      document.documentElement.classList.toggle('dark', nextTheme === 'dark')
    }

    media.addEventListener('change', syncSystemTheme)
    return () => media.removeEventListener('change', syncSystemTheme)
  }, [preferences.themeMode])

  const updatePreferences = (nextPreferences: UserDevicePreferences) => {
    setPreferences(nextPreferences)
  }

  const changeThemeMode = (themeMode: ThemeMode) => {
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
    setActiveMenu('AI 助手')
  }

  return (
    <AppBackground className={preferences.compactMode ? 'user-compact-mode' : ''}>
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-black/[0.08] bg-[#f7f9f7]/95 backdrop-blur-sm transition-colors duration-300 dark:border-white/[0.06] dark:bg-[#0f1511]/95">
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
              onClick={() => changeThemeMode(theme === 'dark' ? 'light' : 'dark')}
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
        <div className="border-t border-black/10 px-5 py-2 md:hidden dark:border-white/10">
          <ScrollableNav activeItem={activeMenu} items={menuItems} mobile onChange={setActiveMenu} />
        </div>
      </header>

      {activeMenu !== '首页' ? (
        <Suspense fallback={<UserPageLoading />}>
          {activeMenu === '提交漏洞' ? (
            <UserSubmitVulnerability />
          ) : activeMenu === '我的漏洞' ? (
            <UserMyVulnerabilities />
          ) : activeMenu === '学习中心' ? (
            <UserLearningCenter />
          ) : activeMenu === 'AI 助手' ? (
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
          <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1.3fr)_410px]">
            <SurfacePanel
              className="h-full overflow-hidden p-0"
              onMouseLeave={() => {
                if (!aiPrompt.trim()) setAiFocused(false)
              }}
            >
              <div className="relative flex min-h-[420px] h-full flex-col p-6 md:p-8">

                <div className="flex h-full flex-col">
                  <div>
                    <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-brand-700 dark:text-green-300">
                      <Sparkles className="h-3.5 w-3.5" />
                      AI Assistant
                    </p>

                    <div className="mt-10 max-w-3xl">
                      <h1 className="text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
                        欢迎回来，{user.name}
                        <span className="mt-3 block text-brand-700 dark:text-green-300">把漏洞报告交给 AI 先整理一遍。</span>
                      </h1>
                      <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 dark:text-slate-400">
                        AI 可以辅助提取报告关键信息、检查复现材料完整度，并根据你的学习进度推荐下一步训练内容。
                      </p>
                    </div>
                  </div>

                  <div className="mt-auto pt-10">
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
                          placeholder="让 AI 帮我分析报告、补全漏洞信息或规划学习路径"
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
              <SurfacePanel className="overflow-hidden p-0">
                <div className="border-b border-black/10 bg-[#f7f9f7] px-5 py-4 dark:border-white/10 dark:bg-[#0f1511]">
                  <SectionHeader description="漏洞提交、积分、证书与训练状态" title="个人安全实践看板" />
                </div>
                <div className="grid grid-cols-2 gap-px bg-black/10 dark:bg-white/10">
                  {stats.map((item) => (
                    <div className="bg-white p-4 dark:bg-[#131a15]" key={item.label}>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{item.label}</p>
                      <p className="mt-2 text-2xl font-semibold tracking-tight">{item.value}</p>
                      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-500">{item.hint}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-3 p-5">
                  {learningProgress.map((item) => (
                    <div key={item.label}>
                      <div className="mb-1.5 flex justify-between text-xs text-slate-500 dark:text-slate-400">
                        <span>{item.label}</span>
                        <span>{item.value}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-black/10 dark:bg-white/10">
                        <div className={`h-full rounded-full bg-brand-600 dark:bg-green-300 ${item.width}`} />
                      </div>
                    </div>
                  ))}
                </div>
              </SurfacePanel>

              <SurfacePanel className="flex h-full flex-col overflow-hidden p-0">
                <div className="border-b border-black/10 bg-[#f7f9f7] px-5 py-4 dark:border-white/10 dark:bg-[#0f1511]">
                  <SectionHeader description="智能体已生成 7 条建议" title="AI 今日待办" />
                </div>
                <div className="grid flex-1 content-start divide-y divide-black/10 dark:divide-white/10">
                  {aiTasks.map((item) => {
                    const Icon = item.icon
                    return (
                      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 px-5 py-4" key={item.label}>
                        <Icon className="mt-1 h-4 w-4 text-brand-700 dark:text-green-300" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium">{item.label}</p>
                            <span className="rounded-md border border-black/10 px-1.5 py-0.5 text-[10px] text-slate-500 dark:border-white/10 dark:text-slate-400">{item.priority}</span>
                          </div>
                          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{item.description}</p>
                        </div>
                        <span className="text-lg font-semibold">{item.value}</span>
                      </div>
                    )
                  })}
                </div>
              </SurfacePanel>
            </div>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
            <SurfacePanel className="overflow-hidden p-0">
              <div className="border-b border-black/10 bg-[#f7f9f7] px-5 py-4 dark:border-white/10 dark:bg-[#0f1511]">
                <div className="flex items-center justify-between gap-4">
                  <SectionHeader description="按常用工作流组织入口" title="快捷工作流" />
                  <Clock3 className="h-5 w-5 text-slate-400" />
                </div>
              </div>
              <div className="divide-y divide-black/10 dark:divide-white/10">
                {quickActions.map((item, index) => {
                  const Icon = item.icon
                  return (
                    <button
                      className="group grid w-full grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 px-5 py-4 text-left transition hover:bg-brand-600/[0.04] dark:hover:bg-green-300/[0.04]"
                      key={item.title}
                      onClick={() => setActiveMenu(item.title === '进入靶场' || item.title === '学习资源' ? '学习中心' : item.title)}
                      type="button"
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-md border border-brand-600/15 bg-brand-600/[0.04] text-brand-700 dark:border-green-300/20 dark:bg-green-300/[0.05] dark:text-green-300">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="font-mono text-xs text-slate-400">0{index + 1}</span>
                          <span className="font-semibold">{item.title}</span>
                          <span className="rounded-md border border-black/10 px-1.5 py-0.5 text-[10px] text-slate-500 dark:border-white/10 dark:text-slate-400">{item.meta}</span>
                        </span>
                        <span className="mt-1 block truncate text-sm text-slate-500 dark:text-slate-400">{item.description}</span>
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 dark:text-green-300">
                        {item.cta}
                        <ChevronRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
                      </span>
                    </button>
                  )
                })}
              </div>
            </SurfacePanel>

            <SurfacePanel className="overflow-hidden p-0">
              <div className="border-b border-black/10 bg-[#f7f9f7] px-5 py-4 dark:border-white/10 dark:bg-[#0f1511]">
                <div className="flex items-center justify-between gap-4">
                  <SectionHeader description="按时间线汇总 AI 与学习系统动作" title="动态与学习提醒" />
                  <Sparkles className="h-5 w-5 text-slate-400" />
                </div>
              </div>
              <div className="divide-y divide-black/10 dark:divide-white/10">
                {activities.map((item) => (
                  <div className="grid grid-cols-[92px_minmax(0,1fr)_76px] gap-4 px-5 py-4 text-sm" key={item.title}>
                    <span className="w-fit rounded-md border border-black/10 px-2 py-1 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">{item.type}</span>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.title}</p>
                      <div className="mt-2 h-1 rounded-full bg-black/10 dark:bg-white/10">
                        <div className={`h-full w-1/2 rounded-full ${item.tone}`} />
                      </div>
                    </div>
                    <span className="text-right text-xs text-slate-500 dark:text-slate-400">{item.time}</span>
                  </div>
                ))}
              </div>
            </SurfacePanel>
          </div>
        </section>
      )}
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
