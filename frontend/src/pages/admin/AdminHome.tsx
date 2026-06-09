import {
  Activity,
  BarChart3,
  FileCheck2,
  FileSearch,
  LayoutDashboard,
  Megaphone,
  Moon,
  ServerCog,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  Sun,
  UserCog,
  UsersRound,
} from 'lucide-react'
import { lazy, Suspense, useEffect, useState } from 'react'
import { AppBackground } from '../../components/layout/AppBackground'
import { BrandLogo } from '../../components/layout/BrandLogo'
import { ScrollableNav } from '../../components/navigation/ScrollableNav'
import { UserAvatarMenu } from '../../components/navigation/UserAvatarMenu'
import { NotificationBell, NotificationPanel } from '../../components/ui/NotificationPanel'
import { SectionHeader } from '../../components/ui/SectionHeader'
import { SurfacePanel } from '../../components/ui/SurfacePanel'
import { type AuthUser } from '../../services/auth'
import { getAdminDashboard } from '../../services/dashboard'
import { applyColorTheme, getSavedColorTheme, transitionColorTheme } from '../../utils/themeTransition'

const AdminAiKnowledgeManagement = lazy(() =>
  import('./AdminAiKnowledgeManagement').then((module) => ({ default: module.AdminAiKnowledgeManagement })),
)
const AdminAiRetestDashboard = lazy(() =>
  import('./AdminAiRetestDashboard').then((module) => ({ default: module.AdminAiRetestDashboard })),
)
const AdminAiRetestPolicy = lazy(() =>
  import('./AdminAiRetestPolicy').then((module) => ({ default: module.AdminAiRetestPolicy })),
)
const AdminAnnouncementManagement = lazy(() =>
  import('./AdminAnnouncementManagement').then((module) => ({ default: module.AdminAnnouncementManagement })),
)
const AdminAuditLogManagement = lazy(() =>
  import('./AdminAuditLogManagement').then((module) => ({ default: module.AdminAuditLogManagement })),
)
const AdminCertificateManagement = lazy(() =>
  import('./AdminCertificateManagement').then((module) => ({ default: module.AdminCertificateManagement })),
)
const AdminLearningManagement = lazy(() =>
  import('./AdminLearningManagement').then((module) => ({ default: module.AdminLearningManagement })),
)
const AdminPointsMallManagement = lazy(() =>
  import('./AdminPointsMallManagement').then((module) => ({ default: module.AdminPointsMallManagement })),
)
const AdminSystemSettings = lazy(() =>
  import('./AdminSystemSettings').then((module) => ({ default: module.AdminSystemSettings })),
)
const AdminUserManagement = lazy(() =>
  import('./AdminUserManagement').then((module) => ({ default: module.AdminUserManagement })),
)
const AdminVulnerabilityManagement = lazy(() =>
  import('./AdminVulnerabilityManagement').then((module) => ({ default: module.AdminVulnerabilityManagement })),
)

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
  'AI 复测',
  '审计日志',
  'AI 知识库',
  '系统设置',
]



const riskQueue = [
  { title: '统一认证入口弱口令策略绕过风险', level: '高危', owner: '信息化办公室', status: '待分派', time: '10 分钟前', score: 92, sla: '剩 2h', type: '认证安全' },
  { title: '实验教学平台越权访问课程附件', level: '中危', owner: '教务处', status: '审核中', time: '34 分钟前', score: 76, sla: '剩 10h', type: '越权访问' },
  { title: '校园门户接口敏感信息返回过多', level: '中危', owner: '信息化办公室', status: '待复测', time: '今天 09:12', score: 68, sla: '剩 1d', type: '信息泄露' },
  { title: '在线靶场资源下载链接未鉴权', level: '高危', owner: '网络安全学院', status: '修复中', time: '昨天 18:40', score: 84, sla: '剩 6h', type: '访问控制' },
]



const systemHealth = [
  { label: '服务状态', value: '正常', tone: 'bg-emerald-500', detail: 'API / Web / DB', width: 'w-[96%]' },
  { label: 'AI 助手', value: '可用', tone: 'bg-brand-600', detail: '报告提取与预判', width: 'w-[88%]' },
  { label: '邮件服务', value: '待配置', tone: 'bg-amber-500', detail: '通知链路未完整', width: 'w-[45%]' },
  { label: '审计日志', value: '写入中', tone: 'bg-blue-500', detail: '关键操作追踪', width: 'w-[91%]' },
]

const auditLogs = [
  { action: '漏洞状态变更', actor: '审核员 A', target: 'SRC-2026-0008', time: '09:42' },
  { action: '用户角色调整', actor: '平台管理员', target: '学生用户', time: '09:18' },
  { action: '证书签发确认', actor: '审核员 B', target: 'CERT-2026-0002', time: '昨天' },
]

export function AdminHome({ onLogout, user }: AdminHomeProps) {
  const [activeMenu, setActiveMenu] = useState('首页')
  const [theme, setTheme] = useState<'dark' | 'light'>(() => getSavedColorTheme())
  const [dashStats, setDashStats] = useState({
    pendingVulnerabilities: 0,
    pendingCerts: 0,
    pendingAccessUsers: 0,
    pendingRedemptions: 0,
    totalActiveUsers: 0,
    totalVulnerabilities: 0,
  })

  useEffect(() => {
    getAdminDashboard()
      .then((data) => setDashStats(data))
      .catch(() => {})
  }, [])

  const overviewStats = [
    { label: '待审核漏洞', value: String(dashStats.pendingVulnerabilities), hint: '提交/审核中', icon: FileSearch },
    { label: '待签发证书', value: String(dashStats.pendingCerts), hint: '需确认归档', icon: FileCheck2 },
    { label: '待准入用户', value: String(dashStats.pendingAccessUsers), hint: '答题/责任书', icon: UsersRound },
    { label: '待处理兑换', value: String(dashStats.pendingRedemptions), hint: '线下领取确认', icon: Store },
  ]

  const operationItems = [
    { title: '漏洞审核流程', value: `${dashStats.pendingVulnerabilities} 个待处理`, icon: ShieldAlert },
    { title: '用户准入与责任书', value: `${dashStats.pendingAccessUsers} 人待完成`, icon: UserCog },
    { title: '公告与规则发布', value: '草稿管理', icon: Megaphone },
    { title: '证书签发管理', value: `${dashStats.pendingCerts} 张待确认`, icon: FileCheck2 },
  ]

  useEffect(() => {
    applyColorTheme(theme)
  }, [theme])

  return (
    <AppBackground variant="admin">
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-black/[0.08] bg-[#f7f9f7]/95 backdrop-blur-sm transition-colors duration-300 dark:border-white/[0.06] dark:bg-[#0f1511]/95">
        <div className="mx-auto grid h-16 max-w-[1440px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-5 md:px-8">
          <BrandLogo />

          <ScrollableNav activeItem={activeMenu} items={adminMenuItems} onChange={setActiveMenu} />

          <div className="flex items-center justify-end gap-2">
            <NotificationBell onClick={() => setActiveMenu('通知')} />
            <button
              aria-label="切换主题"
              className="rounded-lg p-2 text-slate-600 transition hover:bg-black/5 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
              onClick={(event) => {
                const nextTheme = theme === 'dark' ? 'light' : 'dark'
                transitionColorTheme(nextTheme, event)
                setTheme(nextTheme)
              }}
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
        <div className="border-t border-black/10 px-5 py-2 md:hidden dark:border-white/10">
          <ScrollableNav activeItem={activeMenu} items={adminMenuItems} mobile onChange={setActiveMenu} />
        </div>
      </header>

      {activeMenu === '通知' ? (
        <NotificationPanel onClose={() => setActiveMenu('首页')} />
      ) : activeMenu !== '首页' ? (
        <Suspense fallback={<AdminPageLoading />}>
          {activeMenu === '漏洞管理' ? (
            <AdminVulnerabilityManagement />
          ) : activeMenu === '证书管理' ? (
            <AdminCertificateManagement />
          ) : activeMenu === '用户管理' ? (
            <AdminUserManagement />
          ) : activeMenu === '公告管理' ? (
            <AdminAnnouncementManagement />
          ) : activeMenu === '学习管理' ? (
            <AdminLearningManagement />
          ) : activeMenu === '积分商城' ? (
            <AdminPointsMallManagement />
          ) : activeMenu === 'AI 复测' ? (
            <AiRetestHub />
          ) : activeMenu === '审计日志' ? (
            <AdminAuditLogManagement />
          ) : activeMenu === 'AI 知识库' ? (
            <AdminAiKnowledgeManagement />
          ) : (
            <AdminSystemSettings />
          )}
        </Suspense>
      ) : (
        <section className="relative z-10 mx-auto max-w-[1440px] px-5 pb-8 pt-24 md:px-6">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-brand-700 dark:text-green-300">
                <LayoutDashboard className="h-3.5 w-3.5" />
                Admin Console
              </p>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">管理端首页</h1>
              <p className="mt-3 max-w-2xl leading-7 text-slate-600 dark:text-slate-400">
                关注待办、风险队列、系统状态和审计记录，快速判断平台今日运行情况。
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
            <SurfacePanel className="overflow-hidden p-0">
              <div className="border-b border-black/10 bg-[#f7f9f7] px-5 py-4 dark:border-white/10 dark:bg-[#0f1511]">
                <SectionHeader description="按处理优先级关注今日待办" title="运营待办总览" />
              </div>
              <div className="grid grid-cols-2 gap-px bg-black/10 md:grid-cols-4 dark:bg-white/10">
                {overviewStats.map((item) => (
                  <button
                    className="bg-white p-4 text-left transition hover:bg-brand-600/[0.04] dark:bg-[#131a15] dark:hover:bg-green-300/[0.04]"
                    key={item.label}
                    type="button"
                  >
                    <p className="text-xs text-slate-500 dark:text-slate-400">{item.label}</p>
                    <p className="mt-2 text-3xl font-semibold tracking-tight">{item.value}</p>
                    <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-500">{item.hint}</p>
                  </button>
                ))}
              </div>
              <div className="grid gap-3 p-5 md:grid-cols-3">
                {[
                  ['今日高优先级', '3', '需 4 小时内完成首次研判'],
                  ['待责任单位确认', '5', '建议发送二次提醒'],
                  ['可归档事项', '7', '复测通过后签发证书'],
                ].map(([label, value, hint]) => (
                  <div className="rounded-md border border-black/10 bg-black/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.03]" key={label}>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
                    <p className="mt-1 text-xl font-semibold">{value}</p>
                    <p className="mt-1 text-[11px] leading-4 text-slate-500 dark:text-slate-500">{hint}</p>
                  </div>
                ))}
              </div>
            </SurfacePanel>

            <SurfacePanel className="overflow-hidden p-0">
              <div className="border-b border-black/10 bg-[#f7f9f7] px-5 py-4 dark:border-white/10 dark:bg-[#0f1511]">
                <SectionHeader title="服务健康" />
              </div>
              <div className="divide-y divide-black/10 dark:divide-white/10">
                {systemHealth.map((item) => (
                  <div className="px-5 py-3" key={item.label}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${item.tone}`} />
                        {item.label}
                      </span>
                      <span className="font-medium">{item.value}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="h-1.5 flex-1 rounded-full bg-black/10 dark:bg-white/10">
                        <div className={`h-full rounded-full ${item.tone} ${item.width}`} />
                      </div>
                      <span className="w-24 truncate text-right text-[11px] text-slate-500 dark:text-slate-400">{item.detail}</span>
                    </div>
                  </div>
                ))}
              </div>
            </SurfacePanel>
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
            <SurfacePanel className="overflow-hidden p-0">
              <div className="border-b border-black/10 bg-[#f7f9f7] px-5 py-4 dark:border-white/10 dark:bg-[#0f1511]">
                <SectionHeader description="按风险分值、SLA 和责任单位综合排序" title="待审核漏洞队列" />
              </div>
              <div className="hidden grid-cols-[minmax(0,1fr)_86px_92px_112px_82px_80px] border-b border-black/10 px-5 py-2 text-xs text-slate-500 md:grid dark:border-white/10 dark:text-slate-400">
                <span>漏洞标题</span><span>等级</span><span>分值</span><span>责任单位</span><span>状态</span><span className="text-right">SLA</span>
              </div>
              <div className="divide-y divide-black/10 dark:divide-white/10">
                {riskQueue.map((item) => (
                  <div className="grid gap-3 px-5 py-4 text-sm md:grid-cols-[minmax(0,1fr)_86px_92px_112px_82px_80px] md:items-center" key={item.title}>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.title}</p>
                      <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{item.type} · {item.time}</p>
                    </div>
                    <span className={item.level === '高危' ? 'w-fit rounded-md bg-red-500 px-2 py-1 text-xs font-medium text-white' : 'w-fit rounded-md bg-orange-500 px-2 py-1 text-xs font-medium text-white'}>{item.level}</span>
                    <span>
                      <span className="font-semibold">{item.score}</span>
                      <span className="ml-2 inline-block h-1.5 w-10 rounded-full bg-black/10 align-middle dark:bg-white/10">
                        <span className="block h-full w-3/4 rounded-full bg-brand-600 dark:bg-green-300" />
                      </span>
                    </span>
                    <span className="truncate text-xs text-slate-500 dark:text-slate-400">{item.owner}</span>
                    <span className="w-fit rounded-md border border-black/10 px-2 py-1 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">{item.status}</span>
                    <span className="text-xs font-medium text-amber-700 dark:text-amber-300 md:text-right">{item.sla}</span>
                  </div>
                ))}
              </div>
            </SurfacePanel>

            <SurfacePanel className="overflow-hidden p-0">
              <div className="border-b border-black/10 bg-[#f7f9f7] px-5 py-4 dark:border-white/10 dark:bg-[#0f1511]">
                <SectionHeader description="把常用动作压缩成管理命令" title="快捷管理" />
              </div>
              <div className="grid grid-cols-2 gap-px bg-black/10 dark:bg-white/10">
                {operationItems.map((item) => {
                  const Icon = item.icon
                  return (
                    <button
                      className="min-h-32 bg-white p-4 text-left transition hover:bg-brand-600/[0.04] dark:bg-[#131a15] dark:hover:bg-green-300/[0.04]"
                      key={item.title}
                      type="button"
                    >
                      <Icon className="h-5 w-5 text-brand-700 dark:text-green-300" />
                      <span className="mt-3 block text-sm font-medium">{item.title}</span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">{item.value}</span>
                    </button>
                  )
                })}
              </div>
            </SurfacePanel>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            <SurfacePanel className="p-6">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-xl font-semibold">最近审计日志</h2>
                <Activity className="h-5 w-5 text-brand-700 dark:text-green-300" />
              </div>
              <div className="mt-5 space-y-3">
                {auditLogs.map((item) => (
                  <div className="grid gap-3 rounded-lg border border-black/10 bg-black/[0.025] p-4 text-sm md:grid-cols-[160px_minmax(0,1fr)_80px] dark:border-white/10 dark:bg-[#131a15]" key={`${item.action}-${item.time}`}>
                    <span className="font-medium">{item.action}</span>
                    <span className="text-slate-500 dark:text-slate-400">
                      {item.actor} · {item.target}
                    </span>
                    <span className="text-right text-slate-500 dark:text-slate-400">{item.time}</span>
                  </div>
                ))}
              </div>
            </SurfacePanel>

            <SurfacePanel className="p-6">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-xl font-semibold">AI 审核摘要</h2>
                <ServerCog className="h-5 w-5 text-brand-700 dark:text-green-300" />
              </div>
              <div className="mt-5 space-y-3 text-sm">
                <div className="rounded-lg border border-black/10 bg-black/[0.025] p-4 dark:border-white/10 dark:bg-[#131a15]">
                  <p className="font-medium">已完成初评 23 份报告</p>
                  <p className="mt-2 text-slate-500 dark:text-slate-400">标记高价值 4 份，材料不完整 6 份，疑似重复 2 份。</p>
                </div>
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 text-amber-800 dark:text-amber-200">
                  建议优先处理高危资产、统一认证相关漏洞和影响范围不明确的报告。
                </div>
              </div>
            </SurfacePanel>
          </div>
        </section>
      )}
    </AppBackground>
  )
}

function AdminPageLoading() {
  return (
    <section className="relative z-10 mx-auto max-w-[960px] px-5 pb-8 pt-24 md:px-8">
      <SurfacePanel className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
        正在加载管理页面...
      </SurfacePanel>
    </section>
  )
}

function AiRetestHub() {
  const [subTab, setSubTab] = useState<'dashboard' | 'policy'>('dashboard')
  return (
    <section className="relative z-10 mx-auto max-w-[1360px] px-5 pb-8 pt-24 md:px-8">
      <div className="mb-6 flex items-center gap-3">
        <button
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            subTab === 'dashboard'
              ? 'bg-brand-600 text-white'
              : 'border border-black/[0.08] bg-white text-slate-700 hover:bg-slate-50 dark:border-white/[0.06] dark:bg-[#0f1511] dark:text-slate-300 dark:hover:bg-white/[0.04]'
          }`}
          onClick={() => setSubTab('dashboard')}
          type="button"
        >
          <BarChart3 className="mr-1.5 inline-block h-4 w-4" />
          运营看板
        </button>
        <button
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            subTab === 'policy'
              ? 'bg-brand-600 text-white'
              : 'border border-black/[0.08] bg-white text-slate-700 hover:bg-slate-50 dark:border-white/[0.06] dark:bg-[#0f1511] dark:text-slate-300 dark:hover:bg-white/[0.04]'
          }`}
          onClick={() => setSubTab('policy')}
          type="button"
        >
          <SlidersHorizontal className="mr-1.5 inline-block h-4 w-4" />
          策略配置
        </button>
      </div>
      {subTab === 'dashboard' ? <AdminAiRetestDashboard /> : <AdminAiRetestPolicy />}
    </section>
  )
}
