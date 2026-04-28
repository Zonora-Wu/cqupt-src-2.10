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
  Gauge,
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
import { useEffect, useState } from 'react'
import { AppBackground } from '../../components/layout/AppBackground'
import { BrandLogo } from '../../components/layout/BrandLogo'
import { ScrollableNav } from '../../components/navigation/ScrollableNav'
import { UserAvatarMenu } from '../../components/navigation/UserAvatarMenu'
import { SurfacePanel } from '../../components/ui/SurfacePanel'
import { type AuthUser } from '../../services/auth'
import { UserAIAssistant } from './UserAIAssistant'
import { UserAnnouncements } from './UserAnnouncements'
import { UserCertificates } from './UserCertificates'
import { UserLeaderboard } from './UserLeaderboard'
import { UserLearningCenter } from './UserLearningCenter'
import { UserMyVulnerabilities } from './UserMyVulnerabilities'
import { UserNotifications } from './UserNotifications'
import { UserPointsMall } from './UserPointsMall'
import { UserProfile } from './UserProfile'
import { UserSubmitVulnerability } from './UserSubmitVulnerability'
import { UserSystemSettings } from './UserSystemSettings'

type UserHomeProps = {
  onLogout: () => void
  user: AuthUser
}

const stats = [
  { label: '累计提交', value: '8', hint: '漏洞报告', icon: FilePlus2 },
  { label: '有效漏洞', value: '5', hint: '已通过审核', icon: ShieldCheck },
  { label: '当前积分', value: '1260', hint: '可兑换资源', icon: Trophy },
  { label: '证书数量', value: '2', hint: '高价值贡献', icon: Award },
]

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

const aiTasks = [
  { label: '待 AI 补全报告', value: '2', icon: WandSparkles },
  { label: '建议复测漏洞', value: '1', icon: ClipboardCheck },
  { label: '今日学习建议', value: '4', icon: Lightbulb },
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
  '学习中心',
  'AI 助手',
  '积分商城',
  '我的证书',
  '排行榜',
  '平台公告',
]

export function UserHome({ onLogout, user }: UserHomeProps) {
  const [activeMenu, setActiveMenu] = useState('首页')
  const [notifUnread] = useState(3)
  const [aiFocused, setAiFocused] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [theme, setTheme] = useState<'dark' | 'light'>(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light',
  )

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  return (
    <AppBackground>
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
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              type="button"
            >
              {theme === 'dark' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </button>
            <UserAvatarMenu
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

      {activeMenu === '提交漏洞' ? (
        <UserSubmitVulnerability />
      ) : activeMenu === '我的漏洞' ? (
        <UserMyVulnerabilities />
      ) : activeMenu === '学习中心' ? (
        <UserLearningCenter />
      ) : activeMenu === 'AI 助手' ? (
        <UserAIAssistant />
      ) : activeMenu === '积分商城' ? (
        <UserPointsMall />
      ) : activeMenu === '我的证书' ? (
        <UserCertificates />
      ) : activeMenu === '排行榜' ? (
        <UserLeaderboard />
      ) : activeMenu === '平台公告' ? (
        <UserAnnouncements />
      ) : activeMenu === '个人中心' ? (
        <UserProfile user={user} />
      ) : activeMenu === '系统设置' ? (
        <UserSystemSettings theme={theme} onThemeChange={setTheme} />
      ) : activeMenu === '通知' ? (
        <UserNotifications />
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
                      AI Assistant
                    </p>

                    <div className="mt-12 max-w-3xl">
                      <h1 className="text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
                        欢迎回来，{user.name}
                        <span className="mt-3 block text-brand-700 dark:text-green-300">把漏洞报告交给 AI 先整理一遍。</span>
                      </h1>
                      <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 dark:text-slate-400">
                        AI 可以辅助提取报告关键信息、检查复现材料完整度，并根据你的学习进度推荐下一步训练内容。
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
                      <span className="flex min-w-0 items-center gap-3">
                        <Bot className="h-5 w-5 shrink-0 text-brand-700 dark:text-green-300" />
                        <input
                          className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-500 dark:text-slate-100 dark:placeholder:text-slate-400"
                          onChange={(event) => setAiPrompt(event.target.value)}
                          onFocus={() => setAiFocused(true)}
                          placeholder="让 AI 帮我分析报告、补全漏洞信息或规划学习路径"
                          type="text"
                          value={aiPrompt}
                        />
                      </span>
                      <button
                        className="inline-flex shrink-0 items-center gap-2 rounded-md px-2 py-1 text-sm font-medium text-brand-700 transition hover:bg-brand-600/10 dark:text-green-300 dark:hover:bg-green-300/10"
                        onClick={(event) => {
                          event.stopPropagation()
                          setAiFocused(true)
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
                    <p className="text-sm text-slate-500 dark:text-slate-400">AI 今日待办</p>
                    <h2 className="mt-1 text-xl font-semibold">智能体已生成 7 条建议</h2>
                  </div>
                  <Gauge className="h-9 w-9 text-brand-700 dark:text-green-300" />
                </div>
                <div className="mt-4 grid flex-1 content-start gap-3">
                  {aiTasks.map((item) => {
                    const Icon = item.icon
                    return (
                      <div
                        className="flex items-center justify-between rounded-lg border border-black/5 bg-black/[0.025] p-3 dark:border-white/10 dark:bg-white/[0.035]"
                        key={item.label}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="h-4 w-4 text-brand-700 dark:text-green-300" />
                          <span className="text-sm">{item.label}</span>
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
    </AppBackground>
  )
}
