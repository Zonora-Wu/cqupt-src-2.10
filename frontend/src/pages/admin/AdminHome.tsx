import {
  Activity,
  FileCheck2,
  FileSearch,
  Gauge,
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
import { lazy, Suspense, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AppBackground } from '../../components/layout/AppBackground'
import { BrandLogo } from '../../components/layout/BrandLogo'
import { ScrollableNav } from '../../components/navigation/ScrollableNav'
import { UserAvatarMenu } from '../../components/navigation/UserAvatarMenu'
import { NotificationBell, NotificationPanel } from '../../components/ui/NotificationPanel'
import { PageHeader } from '../../components/ui/PageHeader'
import { SurfacePanel } from '../../components/ui/SurfacePanel'
import { adminNavItems, adminUtilityPaths, getLabelFromPath, getPathFromLabel, isKnownWorkspacePath } from '../../routes/routeConfig'
import { type AuthUser } from '../../services/auth'
import { getAdminDashboard } from '../../services/dashboard'
import { applyColorTheme, getSavedColorTheme, transitionColorTheme } from '../../utils/themeTransition'

const AdminAiKnowledgeManagement = lazy(() =>
  import('./AdminAiKnowledgeManagement').then((module) => ({ default: module.AdminAiKnowledgeManagement })),
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

const adminMenuItems = adminNavItems.map((item) => item.label)



const riskQueue = [
  { title: '统一认证入口弱口令策略绕过风险', level: '高危', owner: '信息化办公室', status: '待分派', time: '10 分钟前' },
  { title: '实验教学平台越权访问课程附件', level: '中危', owner: '教务处', status: '审核中', time: '34 分钟前' },
  { title: '校园门户接口敏感信息返回过多', level: '中危', owner: '信息化办公室', status: '待复测', time: '今天 09:12' },
  { title: '在线靶场资源下载链接未鉴权', level: '高危', owner: '网络安全学院', status: '修复中', time: '昨天 18:40' },
]



const systemHealth = [
  { label: '服务状态', value: '正常', tone: 'bg-emerald-500' },
  { label: 'AI 助手', value: '可用', tone: 'bg-brand-600' },
  { label: '邮件服务', value: '待配置', tone: 'bg-amber-500' },
  { label: '审计日志', value: '写入中', tone: 'bg-blue-500' },
]

const auditLogs = [
  { action: '漏洞状态变更', actor: '审核员 A', target: 'SRC-2026-0008', time: '09:42' },
  { action: '用户角色调整', actor: '平台管理员', target: '学生用户', time: '09:18' },
  { action: '证书签发确认', actor: '审核员 B', target: 'CERT-2026-0002', time: '昨天' },
]

export function AdminHome({ onLogout, user }: AdminHomeProps) {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => getSavedColorTheme())
  const [dashStats, setDashStats] = useState({
    pendingVulnerabilities: 0,
    pendingCerts: 0,
    pendingAccessUsers: 0,
    pendingRedemptions: 0,
    totalActiveUsers: 0,
    totalVulnerabilities: 0,
  })
  const location = useLocation()
  const navigate = useNavigate()
  const activeMenu = getLabelFromPath(location.pathname, adminNavItems, adminUtilityPaths)

  const openMenu = (label: string) => {
    const path = getPathFromLabel(label, adminNavItems, adminUtilityPaths)
    if (path) navigate(path)
  }

  useEffect(() => {
    if (!isKnownWorkspacePath(location.pathname, adminNavItems, adminUtilityPaths)) {
      navigate('/admin', { replace: true })
    }
  }, [location.pathname, navigate])

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
    <AppBackground>
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-black/[0.08] bg-[var(--app-header-bg)] backdrop-blur-xl transition-colors duration-300 dark:border-white/[0.06] ">
        <div className="mx-auto grid h-16 max-w-[1440px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-5 md:px-8">
          <BrandLogo />

          <ScrollableNav activeItem={activeMenu} items={adminMenuItems} onChange={openMenu} />

          <div className="flex items-center justify-end gap-2">
            <NotificationBell onClick={() => navigate('/admin/notifications')} />
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
              onAccountSecurity={() => navigate('/admin/account-security')}
              onLogout={onLogout}
              onProfile={() => navigate('/admin/profile')}
              onSystemSettings={() => navigate('/admin/settings')}
            />
          </div>
        </div>
        <div className="border-t border-black/5 px-5 py-2 md:hidden dark:border-white/10">
          <ScrollableNav activeItem={activeMenu} items={adminMenuItems} mobile onChange={openMenu} />
        </div>
      </header>

      {activeMenu === '通知' ? (
        <NotificationPanel onClose={() => navigate('/admin')} />
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
          ) : activeMenu === '审计日志' ? (
            <AdminAuditLogManagement />
          ) : activeMenu === 'AI 知识库' ? (
            <AdminAiKnowledgeManagement />
          ) : (
            <AdminSystemSettings />
          )}
        </Suspense>
      ) : (
        <section className="relative z-10 mx-auto max-w-[1360px] px-5 pb-8 pt-24 md:px-8">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <PageHeader
              title="管理端首页"
              description="关注待办、风险队列、系统状态和审计记录，快速判断平台今日运行情况。"
            />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <SurfacePanel className="p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">今日待办</p>
                  <h2 className="mt-1 text-xl font-semibold">需要处理的事项</h2>
                </div>
                <ShieldAlert className="h-8 w-8 text-brand-700 dark:text-brand-300" />
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-4">
                {overviewStats.map((item) => {
                  const Icon = item.icon
                  return (
                    <button
                      className="rounded-lg border border-black/5 bg-[var(--app-panel-muted-bg)] p-4 text-left transition hover:border-brand-600/25 hover:bg-brand-600/5 dark:border-white/10 "
                      key={item.label}
                      type="button"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <Icon className="h-5 w-5 text-brand-700 dark:text-brand-300" />
                        <span className="text-3xl font-semibold">{item.value}</span>
                      </div>
                      <p className="mt-3 text-sm font-medium">{item.label}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.hint}</p>
                    </button>
                  )
                })}
              </div>
            </SurfacePanel>

            <SurfacePanel className="p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">系统状态</p>
                  <h2 className="mt-1 text-xl font-semibold">服务健康</h2>
                </div>
                <Gauge className="h-8 w-8 text-brand-700 dark:text-brand-300" />
              </div>
              <div className="mt-5 space-y-2">
                {systemHealth.map((item) => (
                  <div className="flex items-center justify-between rounded-lg border border-black/5 bg-[var(--app-panel-muted-bg)] p-3 dark:border-white/10 " key={item.label}>
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
                <ShieldCheck className="h-5 w-5 text-brand-700 dark:text-brand-300" />
              </div>
              <div className="mt-5 space-y-3">
                {riskQueue.map((item) => (
                  <div className="rounded-lg border border-black/5 bg-[var(--app-panel-muted-bg)] p-4 dark:border-white/10 " key={item.title}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-orange-500 px-2 py-1 text-xs font-medium text-white">{item.level}</span>
                        <span className="rounded-md border border-black/10 px-2 py-1 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
                          {item.status}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{item.time}</span>
                    </div>
                    <p className="mt-3 font-medium">{item.title}</p>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">责任单位：{item.owner}</p>
                  </div>
                ))}
              </div>
            </SurfacePanel>

            <div className="grid gap-6">
            <SurfacePanel className="p-6">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-xl font-semibold">快捷管理</h2>
                <ServerCog className="h-5 w-5 text-brand-700 dark:text-brand-300" />
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
                        <Icon className="h-5 w-5 text-brand-700 dark:text-brand-300" />
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
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            <SurfacePanel className="p-6">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-xl font-semibold">最近审计日志</h2>
                <Activity className="h-5 w-5 text-brand-700 dark:text-brand-300" />
              </div>
              <div className="mt-5 space-y-3">
                {auditLogs.map((item) => (
                  <div className="grid gap-3 rounded-lg border border-black/5 bg-[var(--app-panel-muted-bg)] p-4 text-sm md:grid-cols-[160px_minmax(0,1fr)_80px] dark:border-white/10 " key={`${item.action}-${item.time}`}>
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
                <ServerCog className="h-5 w-5 text-brand-700 dark:text-brand-300" />
              </div>
              <div className="mt-5 space-y-3 text-sm">
                <div className="rounded-lg border border-black/5 bg-[var(--app-panel-muted-bg)] p-4 dark:border-white/10 ">
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
