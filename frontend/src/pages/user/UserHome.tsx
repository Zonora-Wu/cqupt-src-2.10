import {
  AlertCircle,
  ArrowRight,
  Bot,
  ChevronRight,
  ClipboardCheck,
  FileSignature,
  RefreshCw,
  X,
} from 'lucide-react'
import { lazy, Suspense, useEffect, useState, type MouseEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { AppBackground } from '../../components/layout/AppBackground'
import { WorkspaceHeader } from '../../components/layout/WorkspaceHeader'
import { CompleteProfileModal } from '../../components/profile/CompleteProfileModal'
import { ResponsibilityAgreementDialog } from '../../components/security/ResponsibilityAgreementDialog'
import { SecurityExamDialog } from '../../components/security/SecurityExamDialog'
import { SurfacePanel } from '../../components/ui/SurfacePanel'
import { FullScreenLoader } from '../../components/ui/FullScreenLoader'
import { getLabelFromPath, getPathFromLabel, isKnownWorkspacePath, userNavItems, userUtilityPaths } from '../../routes/routeConfig'
import { getAccessStatus, type AccessStatus } from '../../services/access'
import { type AuthUser } from '../../services/auth'
import { getUserDashboard, runUserDashboardAiInsight, type UserDashboardAiInsight, type UserDashboardStats } from '../../services/dashboard'
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
import { useNotificationUnread } from '../../hooks/useNotificationUnread'

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

const aiCapabilities = [
  {
    title: '漏洞报告 AI 提交功能',
    description: '上传 PDF 或 Markdown 报告后，辅助提取标题、资产、类型、复现步骤和修复建议。',
  },
  {
    title: '漏洞价值预判',
    description: '结合影响范围、可利用性、复现完整度，给出风险提示和材料补全建议。',
  },
  {
    title: '学习路径推荐',
    description: '根据提交记录、靶场进度和知识薄弱点，推荐工具资源与下一阶段训练。',
  },
]

const menuItems = userNavItems.map((item) => item.label)

function hasPendingAccessTasks(status: AccessStatus | null) {
  if (!status) return false
  const needsProfile = !status.profileCompleted
  const needsAgreement = status.responsibilityAgreementRequired && !status.responsibilitySigned
  const needsExam = status.securityExamRequired && !status.securityExamPassed
  return needsProfile || needsAgreement || needsExam
}

export function UserHome({ onLogout, user }: UserHomeProps) {
  const preferenceKey = user.id ?? user.unifiedCode
  const [aiFocused, setAiFocused] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [pendingAiPrompt, setPendingAiPrompt] = useState<string | null>(null)
  const [pendingAiAdviceReportId, setPendingAiAdviceReportId] = useState<string | null>(null)
  const [preferences, setPreferences] = useState<UserDevicePreferences>(() =>
    getUserDevicePreferences(preferenceKey),
  )
  const [theme, setTheme] = useState<EffectiveTheme>(() => resolveThemeMode(preferences.themeMode))
  const [dashStats, setDashStats] = useState<UserDashboardStats | null>(null)
  const [dashError, setDashError] = useState('')
  const [aiInsight, setAiInsight] = useState<UserDashboardAiInsight | null>(null)
  const [aiInsightError, setAiInsightError] = useState('')
  const [aiInsightRefreshing, setAiInsightRefreshing] = useState(false)
  const [navAvatarUrl, setNavAvatarUrl] = useState<string | null>(null)
  const [accessStatus, setAccessStatus] = useState<AccessStatus | null>(null)
  const [showAccessTodoDialog, setShowAccessTodoDialog] = useState(false)
  const [showResponsibilityDialog, setShowResponsibilityDialog] = useState(false)
  const [showSecurityExamDialog, setShowSecurityExamDialog] = useState(false)
  const [showProfileDialog, setShowProfileDialog] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const activeMenu = getLabelFromPath(location.pathname, userNavItems, userUtilityPaths)
  const notificationUnread = useNotificationUnread()
  const navBadges = {
    '我的漏洞': notificationUnread.menu['user-vulnerabilities'] ?? 0,
    '我的证书': notificationUnread.menu['user-certificates'] ?? 0,
  }

  const openMenu = (label: string) => {
    const path = getPathFromLabel(label, userNavItems, userUtilityPaths)
    if (path) navigate(path)
  }

  useEffect(() => {
    if (!isKnownWorkspacePath(location.pathname, userNavItems, userUtilityPaths)) {
      navigate('/user', { replace: true })
    }
  }, [location.pathname, navigate])

  useEffect(() => {
    const state = location.state as { aiAdviceReportId?: unknown; aiPrompt?: unknown } | null
    if (location.pathname !== '/user/ai') return
    if (typeof state?.aiAdviceReportId === 'string' && state.aiAdviceReportId.trim()) {
      setPendingAiAdviceReportId(state.aiAdviceReportId.trim())
    } else if (typeof state?.aiPrompt === 'string' && state.aiPrompt.trim()) {
      setPendingAiPrompt(state.aiPrompt.trim())
    } else {
      return
    }
    navigate('/user/ai', { replace: true, state: null })
  }, [location.pathname, location.state, navigate])

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

  const loadDashboard = async () => {
    setDashError('')
    try {
      setDashStats(await getUserDashboard())
    } catch (error) {
      setDashError(error instanceof Error ? error.message : '首页进展加载失败')
    }
  }

  useEffect(() => {
    let active = true
    getUserDashboard()
      .then((data) => {
        if (active) setDashStats(data)
      })
      .catch((error: unknown) => {
        if (active) setDashError(error instanceof Error ? error.message : '首页进展加载失败')
      })
    return () => {
      active = false
    }
  }, [])

  const refreshAiInsight = async () => {
    if (aiInsightRefreshing) return
    setAiInsightRefreshing(true)
    setAiInsightError('')
    try {
      setAiInsight(await runUserDashboardAiInsight())
    } catch (error) {
      setAiInsightError(error instanceof Error ? error.message : 'AI 分析失败，请稍后重试')
    } finally {
      setAiInsightRefreshing(false)
    }
  }

  const stats = [
    { label: '累计提交', value: dashStats ? String(dashStats.submitCount) : '—', hint: '漏洞报告' },
    { label: '有效漏洞', value: dashStats ? String(dashStats.confirmedCount) : '—', hint: '已通过审核' },
    { label: '当前积分', value: dashStats ? String(dashStats.currentPoints) : '—', hint: '可兑换资源' },
    { label: '证书数量', value: dashStats ? String(dashStats.certCount) : '—', hint: '高价值贡献' },
  ]
  const quickActions = [
    {
      description: '上传报告与复现材料',
      label: '开始提交',
      path: '/user/submit',
      title: '提交漏洞',
    },
    {
      description: dashStats?.progress.supplementCount
        ? `${dashStats.progress.supplementCount} 个漏洞需要补充材料`
        : '查看审核状态与处理记录',
      label: dashStats?.progress.supplementCount ? '立即处理' : '查看记录',
      path: '/user/vulnerabilities',
      title: '我的漏洞',
      warning: Boolean(dashStats?.progress.supplementCount),
    },
    {
      description: '靶场训练与学习资源',
      label: '进入学习',
      path: '/user/learning',
      title: '学习中心',
    },
    {
      description: dashStats ? `${dashStats.currentPoints} 可用积分` : '查看商品与兑换记录',
      label: '前往商城',
      path: '/user/mall',
      title: '积分商城',
    },
  ]

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
    navigate('/user/ai')
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

  const openProfileDialog = () => {
    setShowAccessTodoDialog(false)
    setShowProfileDialog(true)
  }

  const openSecurityExamDialog = () => {
    setShowAccessTodoDialog(false)
    setShowSecurityExamDialog(true)
  }

  return (
    <AppBackground className={preferences.compactMode ? 'user-compact-mode' : ''}>
      <WorkspaceHeader
        activeItem={activeMenu}
        avatarUrl={navAvatarUrl}
        badges={navBadges}
        items={menuItems}
        name={user.name}
        notificationUnreadCount={notificationUnread.bell}
        onAccountSecurity={() => navigate('/user/account-security')}
        onItemChange={openMenu}
        onLogout={onLogout}
        onNotificationClick={() => navigate('/user/notifications')}
        onProfile={() => navigate('/user/profile')}
        onSystemSettings={() => navigate('/user/settings')}
        onThemeChange={changeThemeMode}
        theme={theme}
      />

      {activeMenu !== '首页' ? (
        <Suspense fallback={<FullScreenLoader label="正在加载页面" />}>
          <div className="user-route-transition" key={location.pathname}>
            {activeMenu === '提交漏洞' ? (
              <UserSubmitVulnerability />
            ) : activeMenu === '我的漏洞' ? (
              <UserMyVulnerabilities />
            ) : activeMenu === '学习中心' ? (
              <UserLearningCenter />
            ) : activeMenu === 'AI助手' ? (
              <UserAIAssistant
                initialAdviceReportId={pendingAiAdviceReportId}
                initialPrompt={pendingAiPrompt}
                onInitialAdviceConsumed={() => setPendingAiAdviceReportId(null)}
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
          </div>
        </Suspense>
      ) : (
        <section className="user-route-transition relative z-10 mx-auto max-w-[1360px] px-5 pb-8 pt-24 md:px-8" key={location.pathname}>
          <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1.45fr)_390px]">
            <SurfacePanel
              className="h-full overflow-hidden p-0"
              onMouseLeave={() => {
                if (!aiPrompt.trim()) setAiFocused(false)
              }}
            >
              <div className="relative flex min-h-[500px] h-full flex-col p-7 md:p-10">
                <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-brand-600/25 to-transparent dark:via-brand-300/25" />
                <div className="pointer-events-none absolute right-12 top-12 hidden h-40 w-40 rounded-full bg-brand-600/10 blur-3xl md:block dark:bg-brand-300/10" />

                <div className="flex h-full flex-col">
                  <div>
                    <div className="mt-0 max-w-3xl">
                      <h1 className="text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
                        欢迎回来，{user.name}
                        <span className="mt-3 block text-brand-700 dark:text-brand-300">把漏洞报告交给邮宝先整理一遍。</span>
                      </h1>
                      <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 dark:text-slate-400">
                        邮宝可以辅助提取报告关键信息、检查复现材料完整度，并根据你的学习进度推荐下一步训练内容。
                      </p>
                    </div>
                  </div>

                  <div className="mt-auto pt-12">
                    <div
                      className={`group flex w-full items-center justify-between gap-4 rounded-lg border px-5 py-4 text-left shadow-sm transition-[transform,border-color,background-color,box-shadow] duration-[220ms] ease-[cubic-bezier(0.23,1,0.32,1)] ${
                        aiFocused
                          ? 'translate-y-1 border-brand-600/35 bg-white/90 shadow-lg shadow-brand-600/10 ring-4 ring-brand-600/10 dark:border-brand-300/25 dark:bg-white/[0.08] dark:ring-brand-300/10'
                          : 'border-black/10 bg-[var(--app-panel-muted-bg)] hover:border-brand-600/25 hover:bg-white/85 dark:border-white/10  dark:hover:bg-white/[0.07]'
                      }`}
                      onClick={() => setAiFocused(true)}
                    >
                      <span className="flex-1 min-w-0 flex items-center gap-3">
                        <Bot className="h-5 w-5 shrink-0 text-brand-700 dark:text-brand-300" />
                        <input
                          autoComplete="off"
                          className="w-full min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-500 dark:text-slate-100 dark:placeholder:text-slate-400"
                          maxLength={4000}
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
                        className="inline-flex shrink-0 items-center gap-2 rounded-md px-2 py-1 text-sm font-medium text-brand-700 transition duration-150 hover:bg-brand-600/10 active:scale-[0.97] dark:text-brand-300 dark:hover:bg-brand-300/10"
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
                      className={`grid items-stretch gap-4 overflow-hidden border-t border-black/10 transition-[max-height,margin,transform,opacity,border-color,padding] duration-[240ms] ease-[cubic-bezier(0.23,1,0.32,1)] md:grid-cols-3 dark:border-white/10 ${
                        aiFocused
                          ? 'mt-0 max-h-0 translate-y-8 border-transparent pt-0 opacity-0'
                          : 'mt-6 max-h-56 translate-y-0 pt-6 opacity-100'
                      }`}
                    >
                      {aiCapabilities.map((item) => (
                        <button
                          className="group flex h-full flex-col rounded-lg px-1 py-1 text-left transition hover:bg-[var(--app-panel-muted-bg)] dark:hover:bg-white/[0.035]"
                          key={item.title}
                          type="button"
                        >
                          <p className="min-h-6 text-sm font-medium">{item.title}</p>
                          <p className="mt-2 flex-1 text-sm leading-6 text-slate-500 dark:text-slate-400">{item.description}</p>
                        </button>
                      ))}
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
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {stats.map((item) => (
                    <div
                      className="rounded-lg border border-black/5 bg-[var(--app-panel-muted-bg)] p-3 dark:border-white/10 "
                      key={item.label}
                    >
                      <span className="text-2xl font-semibold">{item.value}</span>
                      <p className="mt-2 text-sm font-medium">{item.label}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.hint}</p>
                    </div>
                  ))}
                </div>
              </SurfacePanel>

              <SurfacePanel className="flex h-full flex-col overflow-hidden p-0">
                <div className="flex items-center justify-between gap-4">
                  <div className="px-5 py-4">
                    <p className="text-sm text-slate-500 dark:text-slate-400">近 30 天脱敏汇总</p>
                    <h2 className="mt-1 text-xl font-semibold">Hermes 实践分析</h2>
                  </div>
                  <button aria-label="刷新 AI 分析" className="mr-4 rounded-lg p-2 text-slate-400 transition hover:bg-black/5 hover:text-brand-700 disabled:cursor-wait disabled:opacity-50 dark:hover:bg-white/10 dark:hover:text-brand-200" disabled={aiInsightRefreshing} onClick={() => void refreshAiInsight()} title="刷新 AI 分析" type="button"><RefreshCw className={`h-4 w-4 ${aiInsightRefreshing ? 'animate-spin' : ''}`} /></button>
                </div>
                <div className="flex min-h-0 flex-1 flex-col border-t border-black/10 px-5 py-4 dark:border-white/10">
                  {aiInsight ? <>
                    <p className="text-sm leading-6 text-slate-700 dark:text-slate-200">{aiInsight.summary}</p>
                    {aiInsight.findings.length > 0 ? <div className="mt-4 space-y-2">{aiInsight.findings.map((finding) => <p className="border-l-2 border-brand-600/60 pl-3 text-xs leading-5 text-slate-500 dark:text-slate-400" key={finding}>{finding}</p>)}</div> : null}
                    <p className="mt-auto pt-4 text-xs text-slate-400">{new Date(aiInsight.generatedAt).toLocaleString()} · {aiInsight.model}</p>
                  </> : <div className="flex flex-1 items-center text-sm leading-6 text-slate-500 dark:text-slate-400">仅在点击刷新后，将近 30 天漏洞状态与积分汇总发送给 Hermes 分析。</div>}
                  {aiInsightError ? <p className="mt-3 text-xs leading-5 text-red-600 dark:text-red-300">{aiInsightError}</p> : null}
                </div>
              </SurfacePanel>
            </div>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
            <SurfacePanel className="h-full overflow-hidden p-0">
              <div className="border-b border-black/10 px-6 py-5 dark:border-white/10">
                <p className="text-sm text-slate-500 dark:text-slate-400">常用操作</p>
                <h2 className="mt-1 text-xl font-semibold">快捷入口</h2>
              </div>
              <div className="divide-y divide-black/[0.07] px-2 dark:divide-white/[0.08]">
                {quickActions.map((item) => (
                  <button
                    className="group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-md px-4 py-4 text-left transition-colors hover:bg-black/[0.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-600/50 dark:hover:bg-white/[0.05]"
                    key={item.title}
                    onClick={() => navigate(item.path)}
                    type="button"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{item.title}</p>
                      <p className={`mt-1 truncate text-sm ${item.warning ? 'text-amber-700 dark:text-amber-300' : 'text-slate-500 dark:text-slate-400'}`}>
                        {item.description}
                      </p>
                    </div>
                    <span className="flex items-center gap-1 text-sm font-medium text-brand-700 dark:text-brand-300">
                      {item.label}
                      <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </button>
                ))}
              </div>
            </SurfacePanel>

            <UserProgressPanel
              data={dashStats}
              error={dashError}
              onNavigate={navigate}
              onRetry={() => void loadDashboard()}
            />
          </div>
        </section>
      )}
      <AccessTodoDialog
        accessStatus={accessStatus}
        onClose={() => setShowAccessTodoDialog(false)}
        onOpenAgreement={openResponsibilityDialog}
        onOpenProfile={openProfileDialog}
        onStartExam={openSecurityExamDialog}
        open={showAccessTodoDialog && hasPendingAccessTasks(accessStatus)}
      />
      {showProfileDialog && (
        <CompleteProfileModal
          onClose={() => setShowProfileDialog(false)}
          onSaved={async () => {
            setShowProfileDialog(false)
            await refreshAccessStatus()
          }}
          reason="vulnerability"
        />
      )}
      <ResponsibilityAgreementDialog
        accessStatus={accessStatus}
        onClose={() => setShowResponsibilityDialog(false)}
        onSigned={async () => {
          await refreshAccessStatus()
        }}
        open={showResponsibilityDialog}
      />
      <SecurityExamDialog
        onClose={() => setShowSecurityExamDialog(false)}
        onPassed={async () => {
          await refreshAccessStatus()
        }}
        open={showSecurityExamDialog}
      />
    </AppBackground>
  )
}

function UserProgressPanel({
  data,
  error,
  onNavigate,
  onRetry,
}: {
  data: UserDashboardStats | null
  error: string
  onNavigate: (path: string) => void
  onRetry: () => void
}) {
  return (
    <SurfacePanel className="p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">个人数据汇总</p>
          <h2 className="mt-1 text-xl font-semibold">我的进展与待办</h2>
        </div>
      </div>

      {error ? (
        <div className="mt-5 rounded-lg border border-red-500/20 bg-red-500/[0.06] p-4">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          <button className="mt-3 text-sm font-medium text-brand-700 hover:underline dark:text-brand-300" onClick={onRetry} type="button">
            重新加载
          </button>
        </div>
      ) : !data ? (
        <div aria-label="正在加载进展" className="mt-5 space-y-3">
          {Array.from({ length: 5 }, (_, index) => (
            <div className="flex animate-pulse items-center gap-5 border-b border-black/[0.06] py-3 last:border-b-0 dark:border-white/[0.08]" key={index}>
              <span className="h-3 w-20 rounded bg-black/[0.07] dark:bg-white/[0.08]" />
              <span className="h-4 flex-1 rounded bg-black/[0.07] dark:bg-white/[0.08]" />
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-5 divide-y divide-black/[0.07] dark:divide-white/[0.08]">
          <ProgressRow
            label="必须处理"
            value={data.progress.requiredActionCount > 0 ? `${data.progress.requiredActionCount} 个漏洞等待处理` : '当前没有必须处理的漏洞'}
            warning={data.progress.requiredActionCount > 0}
          />
          <ProgressRow
            description={data.progress.latestReport ? `${data.progress.latestReport.reportNo} · ${data.progress.latestReport.title}` : undefined}
            label="审核进度"
            value={data.progress.latestReport?.statusLabel ?? '暂无已提交漏洞'}
          />
          <ProgressRow
            label="补充材料"
            value={data.progress.supplementCount > 0 ? `${data.progress.supplementCount} 个漏洞需要补充` : '无需补充材料'}
            warning={data.progress.supplementCount > 0}
          />
          <ProgressRow
            label="积分与证书"
            value={`${data.currentPoints} 可用积分 · ${data.certCount} 份证书`}
          />
          <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">下一步</p>
              <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{data.progress.nextAction.description}</p>
            </div>
            <button
              className="shrink-0 rounded-md bg-brand-600 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/50"
              onClick={() => onNavigate(data.progress.nextAction.route)}
              type="button"
            >
              {data.progress.nextAction.label}
            </button>
          </div>
        </div>
      )}
    </SurfacePanel>
  )
}

function ProgressRow({
  description,
  label,
  value,
  warning = false,
}: {
  description?: string
  label: string
  value: string
  warning?: boolean
}) {
  return (
    <div className="grid gap-1 py-3.5 sm:grid-cols-[112px_minmax(0,1fr)] sm:gap-4">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <div className="min-w-0 sm:text-right">
        <p className={`text-sm font-medium ${warning ? 'text-amber-700 dark:text-amber-300' : 'text-slate-800 dark:text-slate-100'}`}>{value}</p>
        {description ? <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400" title={description}>{description}</p> : null}
      </div>
    </div>
  )
}

function AccessTodoDialog({
  accessStatus,
  onClose,
  onOpenAgreement,
  onOpenProfile,
  onStartExam,
  open,
}: {
  accessStatus: AccessStatus | null
  onClose: () => void
  onOpenAgreement: () => void
  onOpenProfile: () => void
  onStartExam: () => void
  open: boolean
}) {
  if (!open || typeof document === 'undefined') return null

  const needsProfile = Boolean(accessStatus && !accessStatus.profileCompleted)
  const needsAgreement = Boolean(accessStatus?.responsibilityAgreementRequired && !accessStatus.responsibilitySigned)
  const needsExam = Boolean(accessStatus?.securityExamRequired && !accessStatus.securityExamPassed)

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/35 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-lg border border-black/10 bg-[var(--app-menu-bg)] shadow-2xl dark:border-white/10">
        <div className="flex items-start justify-between gap-4 border-b border-black/10 p-5 dark:border-white/10">
          <div>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-[var(--app-warning)]" />
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">还有待完成的准入事项</h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              完善基础资料、签署责任书并通过安全答题后，即可获得完整的漏洞提交权限。
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
            actionLabel={needsProfile ? '完善资料' : '已完善'}
            description="补全学院、身份、学号等基础信息，用于报告归属、审核沟通和证书签发。"
            disabled={!needsProfile}
            icon={<ClipboardCheck className="h-5 w-5" />}
            onClick={onOpenProfile}
            status={needsProfile ? '待完成' : '已完善'}
            title="基础资料完善"
          />
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
    <div className="rounded-lg border border-black/10 bg-[var(--app-panel-muted-bg)] p-4 dark:border-white/10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-600/10 text-brand-700 dark:text-brand-300">
            {icon}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-slate-950 dark:text-white">{title}</h3>
              <span
                className="rounded-full px-2.5 py-1 text-xs font-medium"
                style={{
                  backgroundColor: disabled ? 'var(--app-success-soft)' : 'var(--app-warning-soft)',
                  color: disabled ? 'var(--app-success-text)' : 'var(--app-warning-text)',
                }}
              >
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
