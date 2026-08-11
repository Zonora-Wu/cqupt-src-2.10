import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { BookOpen, ChevronRight, Megaphone, Moon, Network, RefreshCw, ShoppingBag, Sun } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AppBackground } from '../../components/layout/AppBackground'
import { BrandLogo } from '../../components/layout/BrandLogo'
import { ScrollableNav } from '../../components/navigation/ScrollableNav'
import { UserAvatarMenu } from '../../components/navigation/UserAvatarMenu'
import { NotificationBell, NotificationPanel } from '../../components/ui/NotificationPanel'
import { FullScreenLoader } from '../../components/ui/FullScreenLoader'
import { PageHeader } from '../../components/ui/PageHeader'
import { SurfacePanel } from '../../components/ui/SurfacePanel'
import { adminNavItems, adminUtilityPaths, getLabelFromPath, getPathFromLabel, isKnownWorkspacePath } from '../../routes/routeConfig'
import { type AuthUser } from '../../services/auth'
import { type AdminDashboardStats, getAdminDashboard, runAdminDashboardAiInsight } from '../../services/dashboard'
import { applyColorTheme, getSavedColorTheme, transitionColorTheme } from '../../utils/themeTransition'
import { useNotificationUnread } from '../../hooks/useNotificationUnread'
import { getAiKnowledgeStats } from '../../services/aiKnowledge'

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

export function AdminHome({ onLogout, user }: AdminHomeProps) {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => getSavedColorTheme())
  const [dashStats, setDashStats] = useState<AdminDashboardStats | null>(null)
  const [dashboardError, setDashboardError] = useState('')
  const [dashboardLoading, setDashboardLoading] = useState(true)
  const [insightRefreshing, setInsightRefreshing] = useState(false)
  const [knowledgeReviewCount, setKnowledgeReviewCount] = useState(0)
  const [selectedTrendKey, setSelectedTrendKey] = useState<ActivityTrendKey | null>(null)
  const location = useLocation()
  const navigate = useNavigate()
  const activeMenu = getLabelFromPath(location.pathname, adminNavItems, adminUtilityPaths)
  const notificationUnread = useNotificationUnread()
  const navBadges = {
    '漏洞管理': notificationUnread.menu['admin-vulnerabilities'] ?? 0,
    '证书管理': notificationUnread.menu['admin-certificates'] ?? 0,
    'AI 管理': knowledgeReviewCount,
  }

  const openMenu = (label: string) => {
    const path = getPathFromLabel(label, adminNavItems, adminUtilityPaths)
    if (path) navigate(path)
  }

  useEffect(() => {
    let active = true
    getAiKnowledgeStats()
      .then((data) => { if (active) setKnowledgeReviewCount(data.totals.reviewBacklog) })
      .catch(() => { if (active) setKnowledgeReviewCount(0) })
    return () => { active = false }
  }, [location.pathname])

  useEffect(() => {
    if (!isKnownWorkspacePath(location.pathname, adminNavItems, adminUtilityPaths)) {
      navigate('/admin', { replace: true })
    }
  }, [location.pathname, navigate])

  useEffect(() => {
    let active = true
    getAdminDashboard()
      .then((data) => {
        if (!active) return
        setDashStats(data)
        setDashboardError('')
      })
      .catch((error: unknown) => {
        if (!active) return
        setDashboardError(error instanceof Error ? error.message : '驾驶舱数据加载失败')
      })
      .finally(() => {
        if (active) setDashboardLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    applyColorTheme(theme)
  }, [theme])

  const primaryMetrics = useMemo(() => buildPrimaryMetrics(dashStats), [dashStats])
  const workloadMetrics = useMemo(() => buildWorkloadMetrics(dashStats), [dashStats])

  const refreshInsight = async () => {
    if (insightRefreshing) return
    setInsightRefreshing(true)
    try {
      const aiInsight = await runAdminDashboardAiInsight()
      setDashStats((current) => (current ? { ...current, aiInsight } : current))
      setDashboardError('')
    } catch (error) {
      setDashboardError(error instanceof Error ? error.message : 'AI 分析刷新失败')
    } finally {
      setInsightRefreshing(false)
    }
  }

  return (
    <AppBackground>
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-black/[0.08] bg-[var(--app-header-bg)] backdrop-blur-xl transition-colors duration-300 dark:border-white/[0.06] ">
        <div className="mx-auto grid h-16 max-w-[1440px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-5 md:px-8">
          <BrandLogo />

          <ScrollableNav activeItem={activeMenu} badges={navBadges} items={adminMenuItems} onChange={openMenu} />

          <div className="flex items-center justify-end gap-2">
            <NotificationBell notificationUnreadCount={notificationUnread.bell} onClick={() => navigate('/admin/notifications')} />
            <button
              aria-label="切换主题"
              className="theme-toggle-button rounded-lg p-2 text-slate-600 transition hover:bg-black/5 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
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
          <ScrollableNav activeItem={activeMenu} badges={navBadges} items={adminMenuItems} mobile onChange={openMenu} />
        </div>
      </header>

      {activeMenu === '通知' ? (
        <NotificationPanel onClose={() => navigate('/admin')} />
      ) : activeMenu !== '首页' ? (
        <Suspense fallback={<FullScreenLoader label="正在加载管理页面" />}>
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
          ) : activeMenu === 'AI 管理' ? (
            <AdminAiKnowledgeManagement />
          ) : (
            <AdminSystemSettings />
          )}
        </Suspense>
      ) : (
        <section className="relative z-10 mx-auto max-w-[1360px] px-5 pb-8 pt-24 md:px-8">
          <div className="flex flex-col gap-3 border-b border-black/10 pb-5 dark:border-white/10 lg:flex-row lg:items-end lg:justify-between">
            <PageHeader
              title="管理驾驶舱"
              description="平台核心指标、待办压力、风险变化与 Hermes 运营判断。"
            />
            <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
              <span>{dashStats?.period.label ?? '近 7 天'}</span>
              <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600" />
              <span>{formatDateTime(dashStats?.period.end)}</span>
            </div>
          </div>

          {dashboardError ? (
            <div className="mt-4 rounded-lg border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
              {dashboardError}
            </div>
          ) : null}

          <SurfacePanel className="mt-5 overflow-hidden p-0">
            <div className="grid divide-y divide-black/10 dark:divide-white/10 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
              {primaryMetrics.map((item) => (
                <MetricCell item={item} key={item.label} />
              ))}
            </div>
          </SurfacePanel>

          <div className="mt-5 grid items-stretch gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
            <SurfacePanel className="flex h-[620px] min-h-0 flex-col overflow-hidden p-0">
              <SectionHeader
                title="最近漏洞"
                meta={`${dashStats?.recentVulnerabilities.length ?? 0} 条`}
                actionLabel="查看全部"
                onAction={() => navigate('/admin/vulnerabilities')}
              />
              <RecentVulnerabilityTable
                items={dashStats?.recentVulnerabilities ?? []}
                loading={dashboardLoading}
                onOpen={(id) => navigate(`/admin/vulnerabilities?vulnerabilityId=${encodeURIComponent(id)}`)}
              />
            </SurfacePanel>

            <SurfacePanel className="flex h-[620px] min-h-0 flex-col overflow-hidden p-0">
              <div className="flex items-center justify-between gap-3 border-b border-black/10 px-5 py-4 dark:border-white/10">
                <div>
                  <h2 className="text-sm font-semibold">Hermes 平台分析</h2>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{dashStats?.aiInsight.model ?? 'hermes-agent'}</p>
                </div>
                <button
                  aria-label="刷新 AI 分析"
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-black/5 hover:text-brand-700 disabled:cursor-wait disabled:opacity-50 dark:hover:bg-white/10 dark:hover:text-brand-200"
                  disabled={insightRefreshing}
                  onClick={refreshInsight}
                  title="刷新 AI 分析"
                  type="button"
                >
                  <RefreshCw className={`h-4 w-4 ${insightRefreshing ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <div className="platform-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
                <div className="rounded-lg border border-black/10 p-4 text-sm dark:border-white/10">
                  <div className="flex items-center justify-between gap-3">
                    <span className={`rounded-md px-2 py-1 text-xs font-medium ${aiRiskTone(dashStats?.aiInsight.riskLevel)}`}>
                      {aiRiskLabel(dashStats?.aiInsight.riskLevel)}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {formatDateTime(dashStats?.aiInsight.generatedAt)}
                    </span>
                  </div>
                  <p className="mt-3 break-words leading-6 text-slate-700 dark:text-slate-200">
                    {dashStats?.aiInsight.summary ?? '等待平台数据。'}
                  </p>
                </div>
                <DataList title="主要发现" items={dashStats?.aiInsight.findings ?? []} />
                <DataList title="处理建议" items={dashStats?.aiInsight.recommendations ?? []} />
                <ActionList actions={dashStats?.aiInsight.actions ?? []} />
              </div>
            </SurfacePanel>
          </div>

          <div className="mt-5 grid items-stretch gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="grid items-stretch gap-5 lg:grid-cols-[minmax(0,1fr)_320px] xl:col-start-1 xl:row-start-1">
              <SurfacePanel className="flex h-full flex-col p-0">
                <SectionHeader title="活跃趋势" meta="登录 / 漏洞 / 学习 / AI" />
                <div className="flex min-h-0 flex-1 flex-col justify-between gap-5 px-5 py-5">
                  <div className="flex min-h-0 flex-1 items-center">
                    <ActivityLineChart items={dashStats?.activityTrend ?? []} loading={dashboardLoading} selectedKey={selectedTrendKey} />
                  </div>
                  <div className="grid gap-2 text-xs text-slate-500 md:grid-cols-4 dark:text-slate-400">
                    {activitySeries.map((series) => (
                      <TrendMetric
                        active={selectedTrendKey === series.key}
                        color={series.color}
                        key={series.key}
                        label={series.label}
                        onClick={() => setSelectedTrendKey((current) => current === series.key ? null : series.key)}
                        value={sumTrend(dashStats, series.key)}
                      />
                    ))}
                  </div>
                </div>
              </SurfacePanel>

              <SurfacePanel className="flex h-full flex-col p-0">
                <SectionHeader title="等级分布" meta={`${dashStats?.overview.highRiskVulnerabilities ?? 0} 高风险`} />
                <div className="flex min-h-0 flex-1 flex-col justify-between gap-5 px-5 py-5">
                  <div className="space-y-4">
                    {(dashStats?.severityDistribution ?? []).map((item) => (
                      <SeverityRow item={item} total={dashStats?.totalVulnerabilities ?? 0} key={item.level} />
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <SmallData label="已签发证书" value={dashStats?.overview.issuedCerts ?? 0} />
                    <SmallData label="本期新用户" value={dashStats?.overview.newUsers ?? 0} />
                  </div>
                </div>
              </SurfacePanel>
            </div>

            <SurfacePanel className="overflow-hidden p-0 xl:col-start-1 xl:row-start-2">
              <SectionHeader title="最近审计" meta={`${dashStats?.overview.auditToday ?? 0} 今日`} />
              <AuditTable items={dashStats?.recentAuditLogs ?? []} />
            </SurfacePanel>

            <SurfacePanel className="p-0 xl:col-start-2 xl:row-start-1">
              <SectionHeader title="待办压力" meta={`${dashStats?.operations.filter((item) => item.count > 0).length ?? 0} 类`} />
              <div className="divide-y divide-black/5 dark:divide-white/10">
                {(dashStats?.operations ?? []).map((item) => (
                  <button
                    className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-3 text-left transition hover:bg-black/[0.025] dark:hover:bg-white/[0.05]"
                    key={item.title}
                    onClick={() => navigate(item.route)}
                    type="button"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{item.title}</span>
                      <span className="mt-1 block truncate text-xs text-slate-500 dark:text-slate-400">{item.label}</span>
                    </span>
                    <span className={`rounded-md px-2.5 py-1 text-sm font-semibold ${operationTone(item.severity)}`}>{item.count}</span>
                  </button>
                ))}
              </div>
            </SurfacePanel>

            <SurfacePanel className="flex h-full flex-col p-0 xl:col-start-2 xl:row-start-2">
              <SectionHeader title="平台资源" meta="运营面" />
              <div className="grid flex-1 auto-rows-fr gap-2 px-5 py-5">
                <PlatformResourceTile
                  color="#2563EB"
                  description="已发布可见公告"
                  icon={Megaphone}
                  label="公告发布"
                  onClick={() => navigate('/admin/announcements')}
                  value={dashStats?.platform.activeAnnouncements ?? 0}
                />
                <PlatformResourceTile
                  color="#10B981"
                  description="工具资料与课程资源"
                  icon={BookOpen}
                  label="学习资料"
                  onClick={() => navigate('/admin/learning')}
                  value={dashStats?.platform.activeLearningResources ?? 0}
                />
                <PlatformResourceTile
                  color="#F59E0B"
                  description="靶场与实操入口"
                  icon={Network}
                  label="靶场范围"
                  onClick={() => navigate('/admin/learning')}
                  value={dashStats?.platform.learningRanges ?? 0}
                />
                <PlatformResourceTile
                  color="#2A6438"
                  description="当前上架商品"
                  icon={ShoppingBag}
                  label="商城商品"
                  onClick={() => navigate('/admin/mall')}
                  value={dashStats?.platform.activeMallProducts ?? 0}
                />
              </div>
            </SurfacePanel>
          </div>

          <SurfacePanel className="mt-5 overflow-hidden p-0">
            <div className="grid divide-y divide-black/10 dark:divide-white/10 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
              {workloadMetrics.map((item) => (
                <MetricCell item={item} compact key={item.label} />
              ))}
            </div>
          </SurfacePanel>
        </section>
      )}
    </AppBackground>
  )
}

type MetricItem = {
  label: string
  value: number
  helper: string
  tone: 'danger' | 'neutral' | 'success' | 'warning'
}

function buildPrimaryMetrics(stats: AdminDashboardStats | null): MetricItem[] {
  return [
    { helper: `总漏洞 ${stats?.overview.totalVulnerabilities ?? 0}`, label: '待审核漏洞', tone: 'danger', value: stats?.overview.pendingVulnerabilities ?? 0 },
    { helper: `待复测 ${stats?.overview.pendingRetest ?? 0}`, label: '高风险漏洞', tone: 'warning', value: stats?.overview.highRiskVulnerabilities ?? 0 },
    { helper: `本期新增 ${stats?.overview.newUsers ?? 0}`, label: '活跃用户', tone: 'success', value: stats?.overview.totalActiveUsers ?? 0 },
    { helper: `高风险 ${stats?.overview.highRiskAudit ?? 0}`, label: '今日审计', tone: 'neutral', value: stats?.overview.auditToday ?? 0 },
  ]
}

function buildWorkloadMetrics(stats: AdminDashboardStats | null): MetricItem[] {
  return [
    { helper: `已签发 ${stats?.overview.issuedCerts ?? 0}`, label: '待签发证书', tone: 'warning', value: stats?.overview.pendingCerts ?? 0 },
    { helper: '准入审批', label: '待准入用户', tone: 'neutral', value: stats?.overview.pendingAccessUsers ?? 0 },
    { helper: `已完成 ${stats?.overview.completedRedemptions ?? 0}`, label: '待处理兑换', tone: 'warning', value: stats?.overview.pendingRedemptions ?? 0 },
    { helper: '近 7 天', label: 'AI 调用', tone: 'success', value: stats?.overview.aiCalls ?? 0 },
  ]
}

function MetricCell({ compact = false, item }: { compact?: boolean; item: MetricItem }) {
  return (
    <div className={`${compact ? 'px-5 py-4' : 'px-5 py-5'}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{item.label}</p>
          <p className={`${compact ? 'mt-1 text-2xl' : 'mt-2 text-3xl'} font-semibold tracking-normal text-slate-950 dark:text-white`}>
            {item.value}
          </p>
        </div>
        <span className={`mt-1 h-2 w-2 rounded-full ${metricDot(item.tone)}`} />
      </div>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{item.helper}</p>
    </div>
  )
}

function SectionHeader({
  actionLabel,
  meta,
  onAction,
  title,
}: {
  actionLabel?: string
  meta?: string
  onAction?: () => void
  title: string
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-black/10 px-5 py-4 dark:border-white/10">
      <div className="min-w-0">
        <h2 className="truncate text-sm font-semibold text-slate-950 dark:text-white">{title}</h2>
        {meta ? <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{meta}</p> : null}
      </div>
      {actionLabel && onAction ? (
        <button
          className="shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium text-brand-700 transition hover:bg-brand-600/10 dark:text-brand-300"
          onClick={onAction}
          type="button"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  )
}

function RecentVulnerabilityTable({
  items,
  loading,
  onOpen,
}: {
  items: AdminDashboardStats['recentVulnerabilities']
  loading: boolean
  onOpen: (id: string) => void
}) {
  return (
    <div className="min-h-0 flex-1">
      <table className="w-full table-fixed divide-y divide-black/10 text-sm dark:divide-white/10">
        <thead className="bg-black/[0.025] text-left text-xs text-slate-500 dark:bg-white/[0.04] dark:text-slate-400">
          <tr>
            <th className="w-[22%] px-4 py-2 font-medium">编号 / 等级</th>
            <th className="w-[30%] px-3 py-2 font-medium">漏洞名称</th>
            <th className="w-[10%] px-3 py-2 font-medium">状态</th>
            <th className="w-[12%] px-3 py-2 font-medium">提交用户</th>
            <th className="w-[15%] px-3 py-2 font-medium">提交时间</th>
            <th className="w-[11%] px-4 py-2 text-right font-medium">审核员</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black/5 dark:divide-white/10">
          {items.map((item) => (
            <tr
              className="cursor-pointer transition hover:bg-brand-600/5 dark:hover:bg-white/[0.045]"
              key={item.id}
              onClick={() => onOpen(item.id)}
            >
              <td className="px-4 py-2">
                <span className="block truncate font-mono text-xs text-slate-500 dark:text-slate-400">{item.reportNo}</span>
                <span className={`mt-1 inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${severityTone(item.severity)}`}>{item.severity}</span>
              </td>
              <td className="min-w-0 px-3 py-2">
                <p className="truncate font-medium text-slate-950 dark:text-white">{item.title}</p>
                <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                  {item.assetName} · {item.ownerUnit ?? '未知单位'}
                </p>
              </td>
              <td className="px-3 py-2">
                <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${vulnerabilityStatusTone(item.status)}`}>{item.status}</span>
              </td>
              <td className="truncate px-3 py-2 text-slate-600 dark:text-slate-300">{item.submitterName}</td>
              <td className="truncate px-3 py-2 text-slate-500 dark:text-slate-400">{formatDateTime(item.submittedAt ?? item.updatedAt)}</td>
              <td className="truncate px-4 py-2 text-right text-slate-500 dark:text-slate-400">{item.reviewerName ?? '未分派'}</td>
            </tr>
          ))}
          {loading ? <SkeletonRows colSpan={6} rows={5} /> : null}
        </tbody>
      </table>
      {!loading && items.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-slate-500 dark:text-slate-400">暂无已提交漏洞。</div>
      ) : null}
    </div>
  )
}

function AuditTable({ items }: { items: AdminDashboardStats['recentAuditLogs'] }) {
  return (
    <div>
      <table className="w-full table-fixed divide-y divide-black/10 text-sm dark:divide-white/10">
        <thead className="bg-black/[0.025] text-left text-xs text-slate-500 dark:bg-white/[0.04] dark:text-slate-400">
          <tr>
            <th className="w-[18%] px-5 py-3 font-medium">模块</th>
            <th className="w-[28%] px-4 py-3 font-medium">操作</th>
            <th className="w-[20%] px-4 py-3 font-medium">用户</th>
            <th className="w-[14%] px-4 py-3 font-medium">风险</th>
            <th className="w-[20%] px-5 py-3 text-right font-medium">时间</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black/5 dark:divide-white/10">
          {items.map((item) => (
            <tr key={item.id}>
              <td className="truncate px-5 py-3 text-slate-500 dark:text-slate-400">{item.moduleLabel}</td>
              <td className="truncate px-4 py-3 font-medium">{item.actionLabel}</td>
              <td className="truncate px-4 py-3 text-slate-500 dark:text-slate-400">{item.actor?.name ?? '系统'}</td>
              <td className="px-4 py-3">
                <span className={`rounded-md px-2 py-1 text-xs font-medium ${auditRiskTone(item.riskLevel)}`}>{item.riskLabel}</span>
              </td>
              <td className="truncate px-5 py-3 text-right text-slate-500 dark:text-slate-400">{formatDateTime(item.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SkeletonRows({ colSpan, rows }: { colSpan: number; rows: number }) {
  return Array.from({ length: rows }, (_, index) => (
    <tr key={index}>
      <td className="px-5 py-3" colSpan={colSpan}>
        <div className="h-8 animate-pulse rounded bg-black/5 dark:bg-white/10" />
      </td>
    </tr>
  ))
}

function TrendMetric({
  active,
  color,
  label,
  onClick,
  value,
}: {
  active: boolean
  color: string
  label: string
  onClick: () => void
  value: number
}) {
  return (
    <button
      aria-pressed={active}
      className={`rounded-md border px-3 py-2 text-left transition duration-300 ease-out hover:-translate-y-0.5 active:translate-y-0 ${
        active
          ? 'border-brand-600/30 bg-brand-600/10 text-slate-900 dark:border-brand-300/25 dark:text-white'
          : 'border-black/5 hover:border-black/10 hover:bg-black/[0.025] dark:border-white/10 dark:hover:bg-white/[0.045]'
      }`}
      onClick={onClick}
      type="button"
    >
      <span className="inline-flex items-center gap-1.5">
        <span className={`h-1.5 rounded-full transition-[width] duration-200 ${active ? 'w-5' : 'w-3'}`} style={{ backgroundColor: color }} />
        {label}
      </span>
      <span className="ml-2 font-semibold text-slate-800 dark:text-slate-100">{value}</span>
    </button>
  )
}

type ActivityTrendItem = AdminDashboardStats['activityTrend'][number]
type ActivityTrendKey = 'aiCalls' | 'learning' | 'logins' | 'vulnerabilities'

const activitySeries: Array<{
  color: string
  key: ActivityTrendKey
  label: string
}> = [
  { color: '#2A6438', key: 'logins', label: '登录' },
  { color: '#DC2626', key: 'vulnerabilities', label: '漏洞' },
  { color: '#10B981', key: 'learning', label: '学习' },
  { color: '#F59E0B', key: 'aiCalls', label: 'AI' },
]

function ActivityLineChart({
  items,
  loading,
  selectedKey,
}: {
  items: ActivityTrendItem[]
  loading: boolean
  selectedKey: ActivityTrendKey | null
}) {
  const width = 640
  const height = 220
  const padding = { bottom: 34, left: 38, right: 18, top: 18 }
  const innerWidth = width - padding.left - padding.right
  const innerHeight = height - padding.top - padding.bottom
  const visibleSeries = selectedKey ? activitySeries.filter((series) => series.key === selectedKey) : activitySeries
  const guideLines = [0, 0.5, 1]

  if (loading && items.length === 0) {
    return <div className="h-full min-h-[240px] w-full animate-pulse rounded-lg bg-black/5 dark:bg-white/10" />
  }

  if (items.length === 0) {
    return (
      <div className="flex h-full min-h-[240px] w-full items-center justify-center rounded-lg border border-dashed border-black/10 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
        暂无趋势数据
      </div>
    )
  }

  const xFor = (index: number) => padding.left + (items.length === 1 ? innerWidth / 2 : (index / (items.length - 1)) * innerWidth)
  const yFor = (value: number, maxValue: number) => padding.top + innerHeight - (value / maxValue) * innerHeight

  return (
    <div className="flex h-full min-h-[240px] max-h-[320px] w-full flex-col overflow-hidden rounded-lg border border-black/5 bg-[var(--app-panel-bg)] p-3 dark:border-white/10">
      <style>
        {`
          @keyframes activity-line-draw {
            from { stroke-dashoffset: 1; opacity: 0.25; }
            to { stroke-dashoffset: 0; opacity: 1; }
          }
          @keyframes activity-point-rise {
            from { opacity: 0; transform: scale(0.65); }
            to { opacity: 1; transform: scale(1); }
          }
          .activity-line {
            animation: activity-line-draw 520ms cubic-bezier(.22,1,.36,1) both;
            stroke-dasharray: 1;
            stroke-dashoffset: 1;
          }
          .activity-point {
            animation: activity-point-rise 360ms cubic-bezier(.22,1,.36,1) both;
            transform-box: fill-box;
            transform-origin: center;
          }
          @media (prefers-reduced-motion: reduce) {
            .activity-line,
            .activity-point {
              animation: none;
              stroke-dashoffset: 0;
            }
          }
        `}
      </style>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pb-2">
        {activitySeries.map((series) => (
          <span
            className={`inline-flex items-center gap-1.5 text-xs transition ${
              selectedKey && selectedKey !== series.key ? 'text-slate-400 opacity-45 dark:text-slate-500' : 'text-slate-500 dark:text-slate-400'
            }`}
            key={series.key}
          >
            <span className="h-1.5 w-4 rounded-full" style={{ backgroundColor: series.color }} />
            {series.label}
          </span>
        ))}
      </div>
      <svg aria-label="近 7 天活跃趋势折线图" className="min-h-0 flex-1 overflow-visible" preserveAspectRatio="none" viewBox={`0 0 ${width} ${height}`} role="img">
        <title>近 7 天活跃趋势</title>
        {guideLines.map((ratio) => {
          const y = padding.top + ratio * innerHeight
          return (
            <g key={ratio}>
              <line className="stroke-black/10 dark:stroke-white/10" strokeDasharray={ratio === 1 ? '0' : '4 6'} x1={padding.left} x2={width - padding.right} y1={y} y2={y} />
            </g>
          )
        })}
        {items.map((item, index) => (
          <text className="fill-slate-400 text-[11px] dark:fill-slate-500" key={item.date} textAnchor="middle" x={xFor(index)} y={height - 8}>
            {item.date}
          </text>
        ))}
        <g key={selectedKey ?? 'all'}>
        {visibleSeries.map((series, seriesIndex) => {
          const seriesMaxValue = Math.max(1, ...items.map((item) => item[series.key]))
          const points = items.map((item, index) => ({ date: item.date, x: xFor(index), y: yFor(item[series.key], seriesMaxValue), value: item[series.key] }))
          const path = createSmoothPath(points)
          return (
            <g key={series.key}>
              <path
                className="activity-line"
                d={path}
                fill="none"
                pathLength={1}
                stroke={series.color}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.6}
                style={{ animationDelay: `${seriesIndex * 70}ms` }}
              />
              {points.map((point, index) => (
                <g className="group" key={`${series.key}-${items[index].date}`}>
                  <title>{`${point.date} ${series.label}: ${point.value}`}</title>
                  <circle
                    className="activity-point"
                    cx={point.x}
                    cy={point.y}
                    fill="var(--app-panel-bg)"
                    r={3.6}
                    stroke={series.color}
                    strokeWidth={2}
                    style={{ animationDelay: `${140 + seriesIndex * 70 + index * 24}ms` }}
                  />
                  <circle className="cursor-pointer fill-transparent" cx={point.x} cy={point.y} r={10} />
                  <PointTooltip color={series.color} date={point.date} label={series.label} value={point.value} x={point.x} y={point.y} />
                </g>
              ))}
            </g>
          )
        })}
        </g>
      </svg>
    </div>
  )
}

function PointTooltip({
  color,
  date,
  label,
  value,
  x,
  y,
}: {
  color: string
  date: string
  label: string
  value: number
  x: number
  y: number
}) {
  const boxWidth = 104
  const boxHeight = 36
  const boxX = Math.max(4, Math.min(x - boxWidth / 2, 640 - boxWidth - 4))
  const boxY = y < 54 ? y + 14 : y - boxHeight - 12

  return (
    <g className="pointer-events-none opacity-0 transition-opacity group-hover:opacity-100">
      <rect className="fill-slate-950 dark:fill-white" height={boxHeight} rx={6} width={boxWidth} x={boxX} y={boxY} />
      <circle cx={boxX + 11} cy={boxY + 12} fill={color} r={3} />
      <text className="fill-white text-[10px] font-semibold dark:fill-slate-950" x={boxX + 19} y={boxY + 15}>
        {label} {value}
      </text>
      <text className="fill-white/70 text-[10px] dark:fill-slate-700" x={boxX + 11} y={boxY + 29}>
        {date}
      </text>
    </g>
  )
}

function createSmoothPath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`

  const commands = [`M ${points[0].x} ${points[0].y}`]
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index]
    const next = points[index + 1]
    const controlOffset = (next.x - current.x) * 0.42
    const controlOne = { x: current.x + controlOffset, y: current.y }
    const controlTwo = { x: next.x - controlOffset, y: next.y }
    commands.push(`C ${controlOne.x} ${controlOne.y}, ${controlTwo.x} ${controlTwo.y}, ${next.x} ${next.y}`)
  }
  return commands.join(' ')
}

function SeverityRow({
  item,
  total,
}: {
  item: AdminDashboardStats['severityDistribution'][number]
  total: number
}) {
  return (
    <div className="grid grid-cols-[44px_minmax(0,1fr)_32px] items-center gap-3 rounded-md border border-black/5 px-3 py-2.5 dark:border-white/10">
      <span className="text-xs text-slate-500 dark:text-slate-400">{item.label}</span>
      <div className="h-2.5 rounded-full bg-black/5 dark:bg-white/10">
        <div
          className={`h-2.5 rounded-full ${severityBar(item.level)}`}
          style={{ width: `${Math.max(4, percentage(item.count, total))}%` }}
        />
      </div>
      <span className="text-right text-sm font-medium">{item.count}</span>
    </div>
  )
}

function SmallData({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-black/5 px-3 py-2 dark:border-white/10">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  )
}

function PlatformResourceTile({
  color,
  description,
  icon: Icon,
  label,
  onClick,
  value,
}: {
  color: string
  description: string
  icon: typeof Megaphone
  label: string
  onClick: () => void
  value: number
}) {
  return (
    <button
      className="group grid min-h-[76px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-black/5 bg-[var(--app-panel-bg)] px-3.5 py-3 text-left transition duration-300 hover:-translate-y-0.5 hover:border-black/10 hover:bg-black/[0.025] dark:border-white/10 dark:hover:bg-white/[0.045]"
      onClick={onClick}
      type="button"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-md border border-black/5 dark:border-white/10" style={{ color }}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold leading-none text-slate-950 dark:text-white">{value}</span>
          <span className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
        </span>
        <span className="mt-1 block truncate text-xs text-slate-500 dark:text-slate-400">{description}</span>
      </span>
      <ChevronRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500 dark:text-slate-600 dark:group-hover:text-slate-300" />
    </button>
  )
}

function DataList({ items, title }: { items: string[]; title: string }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{title}</p>
      {items.map((item) => (
        <div className="break-words rounded-md border border-black/5 p-3 text-sm leading-6 text-slate-600 dark:border-white/10 dark:text-slate-300" key={item}>
          {item}
        </div>
      ))}
    </div>
  )
}

function ActionList({ actions }: { actions: AdminDashboardStats['aiInsight']['actions'] }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">行动项</p>
      {actions.map((item) => (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-md border border-black/5 p-3 text-sm dark:border-white/10" key={`${item.label}-${item.owner}`}>
          <span className="break-words">{item.label}</span>
          <span className="text-slate-500 dark:text-slate-400">{item.owner}</span>
        </div>
      ))}
    </div>
  )
}

function sumTrend(stats: AdminDashboardStats | null, key: 'aiCalls' | 'learning' | 'logins' | 'vulnerabilities') {
  return stats?.activityTrend.reduce((sum, item) => sum + item[key], 0) ?? 0
}

function percentage(value: number, total: number) {
  if (total <= 0) return 0
  return (value / total) * 100
}

function metricDot(tone: MetricItem['tone']) {
  if (tone === 'danger') return 'bg-red-500'
  if (tone === 'warning') return 'bg-amber-500'
  if (tone === 'success') return 'bg-emerald-500'
  return 'bg-brand-600'
}

function severityBar(level: string) {
  if (level === 'critical') return 'bg-red-600'
  if (level === 'high') return 'bg-orange-500'
  if (level === 'medium') return 'bg-amber-500'
  if (level === 'low') return 'bg-emerald-500'
  return 'bg-slate-400'
}

function operationTone(level: string) {
  if (level === 'high') return 'bg-red-500/10 text-red-700 dark:text-red-200'
  if (level === 'medium') return 'bg-amber-500/10 text-amber-700 dark:text-amber-200'
  return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
}

function auditRiskTone(level: string) {
  if (level === 'HIGH') return 'bg-red-500/10 text-red-700 dark:text-red-200'
  if (level === 'MEDIUM') return 'bg-amber-500/10 text-amber-700 dark:text-amber-200'
  return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
}

function severityTone(level: string) {
  if (level === '严重') return 'bg-red-600 text-white'
  if (level === '高危') return 'bg-orange-500 text-white'
  if (level === '中危') return 'bg-amber-500 text-white'
  if (level === '低危') return 'bg-slate-500 text-white'
  return 'bg-slate-300 text-slate-800 dark:bg-slate-600 dark:text-white'
}

function vulnerabilityStatusTone(status: string) {
  if (status === '待审核') return 'border-cyan-500/20 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300'
  if (status === '审核中') return 'border-brand-600/20 bg-brand-600/10 text-brand-800 dark:text-brand-300'
  if (status === '待补充') return 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300'
  if (status === '已确认') return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
  if (status === '修复中') return 'border-purple-500/20 bg-purple-500/10 text-purple-700 dark:text-purple-300'
  if (status === '待复测') return 'border-indigo-500/20 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300'
  if (status === '已驳回') return 'border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300'
  return 'border-black/10 bg-[var(--app-panel-muted-bg)] text-slate-600 dark:border-white/10 dark:text-slate-300'
}

function aiRiskTone(level?: string) {
  if (level === 'high') return 'bg-red-500 text-white'
  if (level === 'medium') return 'bg-amber-500 text-white'
  return 'bg-emerald-600 text-white'
}

function aiRiskLabel(level?: string) {
  if (level === 'high') return '高风险'
  if (level === 'medium') return '需关注'
  return '稳定'
}

function formatDateTime(value?: string) {
  if (!value) return '暂无'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
  })
}
