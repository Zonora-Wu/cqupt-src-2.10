import {
  Activity,
  Bell,
  Boxes,
  FileCheck2,
  FileSearch,
  Gauge,
  LayoutDashboard,
  Megaphone,
  Moon,
  ServerCog,
  ShieldAlert,
  ShieldCheck,
  Store,
  Sun,
  UserCog,
  UsersRound,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { AppBackground } from '../../components/layout/AppBackground'
import { BrandLogo } from '../../components/layout/BrandLogo'
import { ScrollableNav } from '../../components/navigation/ScrollableNav'
import { UserAvatarMenu } from '../../components/navigation/UserAvatarMenu'
import { SurfacePanel } from '../../components/ui/SurfacePanel'
import { type AuthUser } from '../../services/auth'

type AdminHomeProps = {
  onLogout: () => void
  user: AuthUser
}

const adminMenuItems = [
  '首页',
  '漏洞管理',
  '证书管理',
  '用户管理',
  '公告管理',
  '学习管理',
  '积分商城',
  '审计日志',
  '系统设置',
]

const overviewStats = [
  { label: '待审核漏洞', value: '18', hint: '其中高危 4 个', icon: FileSearch },
  { label: '注册用户', value: '326', hint: '今日新增 12 人', icon: UsersRound },
  { label: '待处理兑换', value: '9', hint: '线下领取确认', icon: Store },
  { label: '审计事件', value: '1,284', hint: '近 7 天记录', icon: Activity },
]

const riskQueue = [
  { title: '统一认证入口弱口令策略绕过风险', level: '高危', owner: '信息化办公室', time: '10 分钟前' },
  { title: '实验教学平台越权访问课程附件', level: '中危', owner: '教务处', time: '34 分钟前' },
  { title: '校园门户接口敏感信息返回过多', level: '中危', owner: '信息化办公室', time: '今天 09:12' },
]

const operationItems = [
  { title: '漏洞审核流程', value: '12 个待分派', icon: ShieldAlert },
  { title: '用户准入与责任书', value: '28 人待完成', icon: UserCog },
  { title: '公告与规则发布', value: '2 条草稿', icon: Megaphone },
  { title: '证书签发管理', value: '5 张待确认', icon: FileCheck2 },
]

const systemHealth = [
  { label: '服务状态', value: '正常', tone: 'bg-emerald-500' },
  { label: 'AI 助手', value: '可用', tone: 'bg-brand-600' },
  { label: '邮件服务', value: '待配置', tone: 'bg-amber-500' },
  { label: '审计日志', value: '写入中', tone: 'bg-blue-500' },
]

export function AdminHome({ onLogout, user }: AdminHomeProps) {
  const [activeMenu, setActiveMenu] = useState('首页')
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
          <BrandLogo />

          <ScrollableNav activeItem={activeMenu} items={adminMenuItems} onChange={setActiveMenu} />

          <div className="flex items-center justify-end gap-2">
            <button
              aria-label="通知"
              className="relative rounded-lg p-2 text-slate-600 transition hover:bg-black/5 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
              type="button"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                6
              </span>
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
          <ScrollableNav activeItem={activeMenu} items={adminMenuItems} mobile onChange={setActiveMenu} />
        </div>
      </header>

      {activeMenu === '首页' ? (
        <section className="relative z-10 mx-auto max-w-[1360px] px-5 pb-8 pt-24 md:px-8">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <SurfacePanel className="overflow-hidden p-0">
              <div className="relative p-7 md:p-8">
                <div className="pointer-events-none absolute right-10 top-8 h-32 w-32 rounded-full bg-brand-600/10 blur-3xl dark:bg-green-300/10" />
                <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-brand-700 dark:text-green-300">
                  <LayoutDashboard className="h-3.5 w-3.5" />
                  Admin Console
                </p>
                <h1 className="mt-5 text-3xl font-semibold tracking-tight md:text-4xl">管理端首页</h1>
                <p className="mt-4 max-w-3xl leading-7 text-slate-600 dark:text-slate-400">
                  面向平台管理员的运行驾驶舱，集中查看漏洞审核、用户准入、积分兑换、证书签发、系统状态与审计事件。
                </p>

                <div className="mt-7 grid gap-4 md:grid-cols-4">
                  {overviewStats.map((item) => {
                    const Icon = item.icon
                    return (
                      <div className="rounded-lg border border-black/5 bg-black/[0.025] p-4 dark:border-white/10 dark:bg-white/[0.035]" key={item.label}>
                        <Icon className="h-5 w-5 text-brand-700 dark:text-green-300" />
                        <p className="mt-4 text-3xl font-semibold">{item.value}</p>
                        <p className="mt-1 text-sm font-medium">{item.label}</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.hint}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            </SurfacePanel>

            <SurfacePanel className="p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">系统健康</p>
                  <h2 className="mt-1 text-xl font-semibold">运行状态</h2>
                </div>
                <Gauge className="h-8 w-8 text-brand-700 dark:text-green-300" />
              </div>
              <div className="mt-5 space-y-3">
                {systemHealth.map((item) => (
                  <div className="flex items-center justify-between rounded-lg border border-black/5 bg-black/[0.025] p-3 dark:border-white/10 dark:bg-white/[0.035]" key={item.label}>
                    <div className="flex items-center gap-3">
                      <span className={`h-2.5 w-2.5 rounded-full ${item.tone}`} />
                      <span className="text-sm">{item.label}</span>
                    </div>
                    <span className="text-sm font-medium">{item.value}</span>
                  </div>
                ))}
              </div>
            </SurfacePanel>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            <SurfacePanel className="p-6">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-xl font-semibold">待审核漏洞队列</h2>
                <ShieldCheck className="h-5 w-5 text-brand-700 dark:text-green-300" />
              </div>
              <div className="mt-5 space-y-3">
                {riskQueue.map((item) => (
                  <div className="rounded-lg border border-black/5 bg-black/[0.025] p-4 dark:border-white/10 dark:bg-white/[0.035]" key={item.title}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-orange-500 px-2 py-1 text-xs font-medium text-white">{item.level}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{item.time}</span>
                    </div>
                    <p className="mt-3 font-medium">{item.title}</p>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">责任单位：{item.owner}</p>
                  </div>
                ))}
              </div>
            </SurfacePanel>

            <SurfacePanel className="p-6">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-xl font-semibold">快捷管理</h2>
                <ServerCog className="h-5 w-5 text-brand-700 dark:text-green-300" />
              </div>
              <div className="mt-5 grid gap-3">
                {operationItems.map((item) => {
                  const Icon = item.icon
                  return (
                    <button
                      className="flex items-center justify-between rounded-lg border border-black/10 p-4 text-left transition hover:border-brand-600/30 hover:bg-brand-600/5 dark:border-white/10 dark:hover:bg-white/[0.06]"
                      key={item.title}
                      type="button"
                    >
                      <span className="flex items-center gap-3">
                        <Icon className="h-5 w-5 text-brand-700 dark:text-green-300" />
                        <span>
                          <span className="block font-medium">{item.title}</span>
                          <span className="mt-1 block text-sm text-slate-500 dark:text-slate-400">{item.value}</span>
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </SurfacePanel>
          </div>
        </section>
      ) : (
        <section className="relative z-10 mx-auto max-w-[960px] px-5 pb-8 pt-24 md:px-8">
          <SurfacePanel className="p-8 text-center">
            <Boxes className="mx-auto h-10 w-10 text-brand-700 dark:text-green-300" />
            <h1 className="mt-4 text-2xl font-semibold">{activeMenu}</h1>
            <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
              当前先完成管理端首页与菜单栏，该模块后续可继续按业务流程展开。
            </p>
          </SurfacePanel>
        </section>
      )}
    </AppBackground>
  )
}
