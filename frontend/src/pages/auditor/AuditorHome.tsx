import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Bot,
  Eye,
  FileCheck2,
  FileSearch,
  History,
  Megaphone,
  Moon,
  PenLine,
  Pin,
  Plus,
  RotateCcw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Sun,
  UserCheck,
  X,
} from 'lucide-react'
import { lazy, Suspense, type ReactNode, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AppBackground } from '../../components/layout/AppBackground'
import { BrandLogo } from '../../components/layout/BrandLogo'
import { ScrollableNav } from '../../components/navigation/ScrollableNav'
import { UserAvatarMenu } from '../../components/navigation/UserAvatarMenu'
import { NotificationBell, NotificationPanel } from '../../components/ui/NotificationPanel'
import { FloatingNotice } from '../../components/ui/FloatingNotice'
import { PageHeader } from '../../components/ui/PageHeader'
import { SearchInput } from '../../components/ui/SearchInput'
import { SelectInput } from '../../components/ui/SelectInput'
import { SurfacePanel } from '../../components/ui/SurfacePanel'
import { auditorNavItems, auditorUtilityPaths, getLabelFromPath, getPathFromLabel, isKnownWorkspacePath } from '../../routes/routeConfig'
import { type AuthUser } from '../../services/auth'
import { getAuditorDashboard } from '../../services/dashboard'
import { applyColorTheme, getSavedColorTheme, transitionColorTheme } from '../../utils/themeTransition'
import {
  listRetestQueue,
  listReviewQueue,
  markFixing,
  openAttachmentPreview,
  retestVulnerability,
  reviewVulnerability,
} from '../../services/vulnerabilities'
import type { RetestPayload, RetestQueueItem, ReviewDecisionPayload, ReviewQueueItem } from '../../services/vulnerabilities'

const AdminAnnouncementManagement = lazy(() =>
  import('../admin/AdminAnnouncementManagement').then((module) => ({ default: module.AdminAnnouncementManagement })),
)
const AdminCertificateManagement = lazy(() =>
  import('../admin/AdminCertificateManagement').then((module) => ({ default: module.AdminCertificateManagement })),
)
const AdminVulnerabilityManagement = lazy(() =>
  import('../admin/AdminVulnerabilityManagement').then((module) => ({ default: module.AdminVulnerabilityManagement })),
)

type AuditorHomeProps = {
  onLogout: () => void
  user: AuthUser
}

type ReviewLevel = '严重' | '高危' | '中危' | '低危' | '信息'
type ReviewStatus = '待初审' | '审核中' | '待补充' | '已确认' | '已驳回'
type RetestStatus = '待复测' | '复测中' | '复测通过' | '退回修复' | '修复中' | '已归档'
type AnnouncementStatus = '草稿' | '已发布' | '已下架'

type ReviewReport = {
  attachments: ReviewQueueItem['attachments']
  id: string
  reportId: string
  title: string
  asset: string
  owner: string
  submitter: string
  level: ReviewLevel
  status: ReviewStatus
  submittedAt: string
  updatedAt: string
  aiScore: number
  aiTags: string[]
  aiSummary: string
  description: string
  reproduce: string
  requestPacket: string
  repair: string
  points: number
}

type RetestItem = {
  id: string
  title: string
  asset: string
  owner: string
  level: ReviewLevel
  status: RetestStatus
  fixedAt: string
  note: string
}

type AuditorAnnouncement = {
  id: string
  title: string
  category: '审核通知' | '规则更新' | '安全提醒' | '活动通知'
  status: AnnouncementStatus
  range: '全体用户' | '学生用户' | '审核员'
  pinned: boolean
  date: string
  summary: string
  content: string
  readCount: number
}

type ConfirmAction = {
  title: string
  description: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void | Promise<void>
} | null

const auditorMenuItems = auditorNavItems.map((item) => item.label)
const reviewStatusOptions = ['全部状态', '待初审', '审核中', '待补充', '已确认', '已驳回']
const levelOptions = ['全部等级', '严重', '高危', '中危', '低危', '信息']

const reviewReports: ReviewReport[] = [
  {
    attachments: [],
    id: 'SRC-2026-0008',
    reportId: 'mock-src-2026-0008',
    title: '统一认证入口弱口令策略绕过风险',
    asset: 'auth.cqupt.edu.cn',
    owner: '信息化办公室',
    submitter: '星火同学',
    level: '高危',
    status: '待初审',
    submittedAt: '2026-04-27 10:24',
    updatedAt: '2026-04-27 14:36',
    aiScore: 86,
    aiTags: ['疑似高价值', '建议优先', '材料待补充'],
    aiSummary: 'AI 判断该漏洞影响统一认证入口，建议优先复现。需补充测试边界和影响账号范围。',
    description: '统一认证入口在特定弱口令策略组合下可能绕过校验，导致低强度口令账号仍可完成登录。',
    reproduce: '1. 使用授权测试账号进入统一认证登录页。\n2. 构造弱口令边界条件。\n3. 观察服务端策略校验结果。\n4. 记录前后端响应差异。',
    requestPacket: 'POST /cas/login HTTP/1.1\nHost: auth.cqupt.edu.cn\nContent-Type: application/x-www-form-urlencoded\n\nusername=test&password=******',
    repair: '统一服务端密码策略校验逻辑，补充弱口令命中日志，并对历史弱口令账号进行强制改密。',
    points: 0,
  },
  {
    attachments: [],
    id: 'SRC-2026-0007',
    reportId: 'mock-src-2026-0007',
    title: '实验教学平台越权访问课程附件',
    asset: 'lab.cqupt.edu.cn',
    owner: '教务处',
    submitter: '南山同学',
    level: '中危',
    status: '审核中',
    submittedAt: '2026-04-26 21:18',
    updatedAt: '2026-04-27 09:12',
    aiScore: 74,
    aiTags: ['复现完整', '建议确认责任单位'],
    aiSummary: 'AI 判断复现路径较完整，建议重点确认课程关系校验是否缺失。',
    description: '不同课程之间的附件下载接口存在权限校验不足，授权账号可能访问未选课程资料。',
    reproduce: '1. 登录授权学生账号。\n2. 获取本人课程附件下载链接。\n3. 替换 courseId 与 fileId。\n4. 验证是否可下载非授权课程资料。',
    requestPacket: 'GET /api/course/file/download?courseId=1024&fileId=7788 HTTP/1.1\nHost: lab.cqupt.edu.cn',
    repair: '下载接口应校验用户与课程、班级、附件之间的授权关系，并记录异常访问日志。',
    points: 0,
  },
  {
    attachments: [],
    id: 'SRC-2026-0006',
    reportId: 'mock-src-2026-0006',
    title: '校园门户接口敏感信息返回过多',
    asset: 'portal.cqupt.edu.cn/api/user',
    owner: '信息化办公室',
    submitter: '青木同学',
    level: '中危',
    status: '已确认',
    submittedAt: '2026-04-24 16:42',
    updatedAt: '2026-04-26 11:30',
    aiScore: 68,
    aiTags: ['可复测', '可签发证书'],
    aiSummary: 'AI 建议进入复测队列，若修复确认通过可由审核员直接签发贡献证书。',
    description: '用户信息接口返回了不必要的联系方式、组织关系等字段。',
    reproduce: '1. 登录普通账号。\n2. 请求用户详情接口。\n3. 检查响应字段。\n4. 验证是否返回超出业务需要的数据。',
    requestPacket: 'GET /api/user/profile HTTP/1.1\nHost: portal.cqupt.edu.cn\nAuthorization: Bearer ******',
    repair: '按业务场景拆分接口字段，默认隐藏敏感字段，增加字段级访问控制。',
    points: 260,
  },
]

export const retestItems: RetestItem[] = [
  {
    id: 'SRC-2026-0006',
    title: '校园门户接口敏感信息返回过多',
    asset: 'portal.cqupt.edu.cn/api/user',
    owner: '信息化办公室',
    level: '中危',
    status: '待复测',
    fixedAt: '2026-04-26 11:30',
    note: '责任单位已提交接口字段收敛说明，需验证历史敏感字段是否仍返回。',
  },
  {
    id: 'SRC-2026-0004',
    title: '在线靶场资源下载链接未鉴权',
    asset: 'range.cqupt-src.edu.cn',
    owner: '网络安全学院',
    level: '高危',
    status: '复测中',
    fixedAt: '2026-04-22 10:16',
    note: '需验证旧临时链接、缓存链接和未登录状态下的访问结果。',
  },
  {
    id: 'SRC-2026-0005',
    title: '学生社团系统后台登录验证码复用',
    asset: 'club.cqupt.edu.cn',
    owner: '团委',
    level: '低危',
    status: '复测通过',
    fixedAt: '2026-04-25 16:30',
    note: '验证码已改为一次性使用，可归档。',
  },
]

const reviewHistory = [
  { id: 'HIS-001', action: '进入审核', target: 'SRC-2026-0007', time: '2026-04-28 09:20', result: '进行中' },
  { id: 'HIS-002', action: '要求补充材料', target: 'SRC-2026-0008', time: '2026-04-27 14:36', result: '已通知' },
  { id: 'HIS-003', action: '复测通过', target: 'SRC-2026-0005', time: '2026-04-25 16:30', result: '已归档' },
  { id: 'HIS-004', action: '签发证书', target: 'SRC-2026-0006', time: '2026-04-26 15:08', result: '已完成' },
]

const auditorAnnouncements: AuditorAnnouncement[] = [
  {
    id: 'ANN-AUD-003',
    title: '高危漏洞优先审核提醒',
    category: '审核通知',
    status: '已发布',
    range: '审核员',
    pinned: true,
    date: '2026-04-28',
    summary: '统一认证、账号安全和数据暴露类漏洞应优先处理。',
    content: '统一认证、账号安全、敏感数据暴露和影响业务连续性的漏洞需要优先进入审核流程。审核员应先确认授权边界、复现证据、影响范围和修复建议，再给出最终审核结论。',
    readCount: 86,
  },
  {
    id: 'ANN-AUD-002',
    title: '审核意见填写规范更新',
    category: '规则更新',
    status: '草稿',
    range: '审核员',
    pinned: false,
    date: '2026-04-26',
    summary: '要求补充材料时需明确缺失项、补充原因和截止时间。',
    content: '审核员在要求用户补充材料时，应明确说明缺失项、补充原因、补充截止时间和可接受的材料格式。涉及敏感信息时，应提醒用户脱敏后再上传。',
    readCount: 0,
  },
  {
    id: 'ANN-AUD-001',
    title: '复测归档材料留存要求',
    category: '安全提醒',
    status: '已下架',
    range: '全体用户',
    pinned: false,
    date: '2026-04-24',
    summary: '复测通过后需保留修复前后证据、时间线和责任单位反馈。',
    content: '复测归档应包含修复前后证据、时间线、责任单位反馈、复测结论和证书签发依据。涉及漏洞细节的材料仅在平台内留存，不应公开传播。',
    readCount: 142,
  },
]

const levelStyles: Record<ReviewLevel, string> = {
  严重: 'bg-red-600 text-white',
  高危: 'bg-orange-500 text-white',
  中危: 'bg-amber-500 text-white',
  低危: 'bg-slate-500 text-white',
  信息: 'bg-sky-500 text-white',
}

const reviewStatusStyles: Record<ReviewStatus, string> = {
  待初审: 'border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  审核中: 'border-brand-600/20 bg-brand-600/10 text-brand-800 dark:text-green-300',
  待补充: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  已确认: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  已驳回: 'border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300',
}

const retestStatusStyles: Record<RetestStatus, string> = {
  待复测: 'border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  复测中: 'border-brand-600/20 bg-brand-600/10 text-brand-800 dark:text-green-300',
  复测通过: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  退回修复: 'border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300',
  修复中: 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  已归档: 'border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-300',
}

const announcementStatusStyles: Record<AnnouncementStatus, string> = {
  草稿: 'border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-300',
  已发布: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  已下架: 'border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300',
}

export function AuditorHome({ onLogout, user }: AuditorHomeProps) {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => getSavedColorTheme())
  const location = useLocation()
  const navigate = useNavigate()
  const activeMenu = getLabelFromPath(location.pathname, auditorNavItems, auditorUtilityPaths)

  const openMenu = (label: string) => {
    const path = getPathFromLabel(label, auditorNavItems, auditorUtilityPaths)
    if (path) navigate(path)
  }

  useEffect(() => {
    if (!isKnownWorkspacePath(location.pathname, auditorNavItems, auditorUtilityPaths)) {
      navigate('/auditor', { replace: true })
    }
  }, [location.pathname, navigate])

  useEffect(() => {
    applyColorTheme(theme)
  }, [theme])

  return (
    <AppBackground>
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-black/[0.08] bg-[#f7f9f7]/80 backdrop-blur-xl transition-colors duration-300 dark:border-white/[0.06] dark:bg-[#0f1511]/75">
        <div className="mx-auto grid h-16 max-w-[1440px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-5 md:px-8">
          <BrandLogo />
          <ScrollableNav activeItem={activeMenu} items={auditorMenuItems} onChange={openMenu} />
          <div className="flex items-center justify-end gap-2">
            <NotificationBell onClick={() => navigate('/auditor/notifications')} />
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
              onAccountSecurity={() => navigate('/auditor/profile')}
              onLogout={onLogout}
              onProfile={() => navigate('/auditor/profile')}
              onSystemSettings={() => navigate('/auditor/profile')}
            />
          </div>
        </div>
        <div className="border-t border-black/5 px-5 py-2 md:hidden dark:border-white/10">
          <ScrollableNav activeItem={activeMenu} items={auditorMenuItems} mobile onChange={openMenu} />
        </div>
      </header>

      {activeMenu === '通知' ? (
        <NotificationPanel onClose={() => navigate('/auditor')} />
      ) : activeMenu === '首页' ? (
        <AuditorDashboard onNavigate={openMenu} />
      ) : activeMenu === '漏洞审核' ? (
        <Suspense fallback={<AuditorPageLoading />}>
          <AdminVulnerabilityManagement />
        </Suspense>
      ) : activeMenu === '复测归档' ? (
        <AuditorRetestArchive />
      ) : activeMenu === '证书管理' ? (
        <Suspense fallback={<AuditorPageLoading />}>
          <AdminCertificateManagement />
        </Suspense>
      ) : activeMenu === 'AI 辅助' ? (
        <AuditorAIAssistant />
      ) : activeMenu === '审核记录' ? (
        <AuditorReviewHistory />
      ) : activeMenu === '公告管理' ? (
        <Suspense fallback={<AuditorPageLoading />}>
          <AdminAnnouncementManagement />
        </Suspense>
      ) : (
        <AuditorProfile user={user} />
      )}
    </AppBackground>
  )
}

function AuditorPageLoading() {
  return (
    <section className="relative z-10 mx-auto max-w-[960px] px-5 pb-8 pt-24 md:px-8">
      <SurfacePanel className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
        正在加载审核页面...
      </SurfacePanel>
    </section>
  )
}

function AuditorDashboard({ onNavigate }: { onNavigate: (item: string) => void }) {
  const [stats, setStats] = useState({ pendingInitReview: 0, pendingRetest: 0, pendingCerts: 0, pendingArchive: 0 })

  useEffect(() => {
    getAuditorDashboard()
      .then((data) => setStats(data))
      .catch(() => { /* 静默失败 */ })
  }, [])

  const overview = [
    { label: '待初审', value: String(stats.pendingInitReview), hint: '提交/审核中', icon: FileSearch, menu: '漏洞审核' },
    { label: '待复测', value: String(stats.pendingRetest), hint: '可推动归档', icon: RotateCcw, menu: '复测归档' },
    { label: '待签发证书', value: String(stats.pendingCerts), hint: '已归档未签发', icon: FileCheck2, menu: '证书管理' },
    { label: '待推入复测', value: String(stats.pendingArchive), hint: '已确认/修复中', icon: Sparkles, menu: '复测归档' },
  ]

  return (
    <section className="relative z-10 mx-auto max-w-[1360px] px-5 pb-8 pt-24 md:px-8">
      <PageHeader
        eyebrow="Auditor Console"
        eyebrowIcon={<ShieldCheck className="h-3.5 w-3.5" />}
        title="审核员工作台"
        description="聚合漏洞初审、复测归档、证书管理和 AI 辅助判断，帮助审核员按优先级完成从提交到证书的闭环响应。"
      />

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        {overview.map((item) => {
          const Icon = item.icon
          return (
            <button
              className="rounded-lg border border-black/10 bg-white/75 p-5 text-left shadow-sm backdrop-blur-xl transition hover:border-brand-600/25 hover:bg-brand-600/5 dark:border-white/10 dark:bg-white/[0.035]"
              key={item.label}
              onClick={() => onNavigate(item.menu)}
              type="button"
            >
              <div className="flex items-start justify-between gap-4">
                <Icon className="h-5 w-5 text-brand-700 dark:text-green-300" />
                <span className="text-3xl font-semibold">{item.value}</span>
              </div>
              <p className="mt-3 text-sm font-medium">{item.label}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.hint}</p>
            </button>
          )
        })}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <SurfacePanel className="p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold">高优先级审核队列</h2>
            <ShieldAlert className="h-5 w-5 text-brand-700 dark:text-green-300" />
          </div>
          <div className="mt-5 space-y-3">
            {reviewReports.slice(0, 3).map((item) => (
              <div className="rounded-lg border border-black/5 bg-black/[0.025] p-4 dark:border-white/10 dark:bg-white/[0.035]" key={item.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{item.id}</span>
                  <LevelBadge level={item.level} />
                  <ReviewStatusBadge status={item.status} />
                </div>
                <p className="mt-3 font-medium">{item.title}</p>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  {item.asset} · {item.owner} · AI {item.aiScore}
                </p>
              </div>
            ))}
          </div>
        </SurfacePanel>

        <SurfacePanel className="p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold">AI 今日摘要</h2>
            <Bot className="h-5 w-5 text-brand-700 dark:text-green-300" />
          </div>
          <div className="mt-5 space-y-3 text-sm">
            <div className="rounded-lg border border-black/5 bg-black/[0.025] p-4 dark:border-white/10 dark:bg-white/[0.035]">
              <p className="font-medium">建议优先处理统一认证相关报告</p>
              <p className="mt-2 leading-6 text-slate-500 dark:text-slate-400">该类漏洞影响面较大，应先确认授权边界、复现材料和实际风险。</p>
            </div>
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 text-amber-800 dark:text-amber-200">
              2 份报告缺少测试边界说明，建议先要求补充再进入正式复现。
            </div>
          </div>
        </SurfacePanel>
      </div>
    </section>
  )
}


export function AuditorReviewQueue() {
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('全部状态')
  const [level, setLevel] = useState('全部等级')
  const [reports, setReports] = useState<ReviewReport[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [selectedReport, setSelectedReport] = useState<ReviewReport | null>(null)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)
  const [done, setDone] = useState('')
  const [reviewNote, setReviewNote] = useState('')
  const [finalSeverity, setFinalSeverity] = useState<ReviewLevel>('中危')
  const [reviewPoints, setReviewPoints] = useState('260')
  const [previewingAttachmentId, setPreviewingAttachmentId] = useState<string | null>(null)

  const loadReports = async () => {
    setIsLoading(true)
    setErrorMessage('')

    try {
      const result = await listReviewQueue()
      setReports(result.items.map(mapReviewQueueItem))
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '审核队列加载失败')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadReports()
  }, [])

  const filteredReports = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()
    return reports.filter((item) => {
      const matchesKeyword =
        !normalizedKeyword ||
        item.id.toLowerCase().includes(normalizedKeyword) ||
        item.title.toLowerCase().includes(normalizedKeyword) ||
        item.asset.toLowerCase().includes(normalizedKeyword) ||
        item.submitter.toLowerCase().includes(normalizedKeyword)
      const matchesStatus = status === '全部状态' || item.status === status
      const matchesLevel = level === '全部等级' || item.level === level
      return matchesKeyword && matchesStatus && matchesLevel
    })
  }, [keyword, level, reports, status])

  const complete = (message: string) => {
    setDone(message)
    window.setTimeout(() => setDone(''), 2200)
  }

  const openReport = (item: ReviewReport) => {
    setSelectedReport(item)
    setReviewNote(defaultReviewNote(item.status))
    setFinalSeverity(item.level)
    setReviewPoints(String(item.points || defaultPointsForLevel(item.level)))
  }

  const submitReview = async (decision: ReviewDecisionPayload['decision']) => {
    if (!selectedReport) return

    try {
      const payload: ReviewDecisionPayload = {
        decision,
        note: reviewNote,
      }

      if (decision === 'CONFIRM') {
        payload.finalSeverity = finalSeverity
        payload.points = Number(reviewPoints)
      }

      const result = await reviewVulnerability(selectedReport.reportId, payload)
      complete(`审核已完成：${result.reportNo} 已更新为 ${result.status}`)
      setSelectedReport(null)
      await loadReports()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '审核操作失败')
    }
  }

  const handlePreviewAttachment = async (attachmentId: string) => {
    setPreviewingAttachmentId(attachmentId)
    setErrorMessage('')

    try {
      await openAttachmentPreview(attachmentId)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'PDF 预览失败')
    } finally {
      setPreviewingAttachmentId(null)
    }
  }

  if (selectedReport) {
    return (
      <>
        <section className="relative z-10 mx-auto max-w-[1360px] px-5 pb-8 pt-24 md:px-8">
          <button
            className="inline-flex items-center gap-2 rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
            onClick={() => setSelectedReport(null)}
            type="button"
          >
            <ArrowLeft className="h-4 w-4" />
            返回审核队列
          </button>
          {done && <SuccessNotice>{done}</SuccessNotice>}
          <div className="mt-5 grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
            <div className="space-y-6 xl:sticky xl:top-24 xl:self-start">
              <SurfacePanel className="p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{selectedReport.id}</span>
                  <LevelBadge level={selectedReport.level} />
                  <ReviewStatusBadge status={selectedReport.status} />
                </div>
                <h1 className="mt-4 text-2xl font-semibold leading-snug">{selectedReport.title}</h1>
                <div className="mt-5 space-y-3 text-sm text-slate-600 dark:text-slate-400">
                  <p>影响资产：{selectedReport.asset}</p>
                  <p>责任单位：{selectedReport.owner}</p>
                  <p>提交人：{selectedReport.submitter}</p>
                  <p>提交时间：{selectedReport.submittedAt}</p>
                  <p>最近更新：{selectedReport.updatedAt}</p>
                </div>
              </SurfacePanel>

              <SurfacePanel className="p-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 font-semibold">
                    <Sparkles className="h-5 w-5 text-brand-700 dark:text-green-300" />
                    AI 初评
                  </div>
                  <span className="text-2xl font-semibold text-brand-700 dark:text-green-300">{selectedReport.aiScore}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedReport.aiTags.map((tag) => (
                    <span className="rounded-md bg-brand-600/10 px-2 py-1 text-xs text-brand-800 dark:text-green-300" key={tag}>
                      {tag}
                    </span>
                  ))}
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-400">{selectedReport.aiSummary}</p>
              </SurfacePanel>

              <SurfacePanel className="p-4">
                <div className="mb-4 grid gap-3">
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">审核意见</span>
                    <textarea
                      className="mt-2 min-h-28 w-full resize-y rounded-lg border border-black/10 bg-white/70 px-3 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10 dark:bg-white/5 dark:text-white"
                      onChange={(event) => setReviewNote(event.target.value)}
                      placeholder="请填写审核依据、复现结论、补充要求或驳回原因"
                      value={reviewNote}
                    />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <SelectInput label="最终等级" onChange={(value) => setFinalSeverity(value as ReviewLevel)} options={levelOptions.filter((item) => item !== '全部等级')} value={finalSeverity} />
                    <label className="block">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">奖励积分</span>
                      <input
                        className="mt-2 w-full rounded-lg border border-black/10 bg-white/70 px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10 dark:bg-white/5 dark:text-white"
                        min={0}
                        max={10000}
                        onChange={(event) => setReviewPoints(event.target.value)}
                        type="number"
                        value={reviewPoints}
                      />
                    </label>
                  </div>
                </div>
                <div className="grid gap-2">
                  <ReviewActionButton
                    label="确认有效"
                    onClick={() =>
                      setConfirmAction({
                        title: '确认该漏洞有效？',
                        description: '确认后，该报告将进入修复协同流程，并通知资产责任单位处理。',
                        onConfirm: () => submitReview('CONFIRM'),
                      })
                    }
                  />
                  <ReviewActionButton
                    label="要求补充材料"
                    onClick={() =>
                      setConfirmAction({
                        title: '确认要求补充材料？',
                        description: '系统将通知提交人补充复现边界、影响证明、截图或请求包等材料。',
                        onConfirm: () => submitReview('NEEDS_SUPPLEMENT'),
                      })
                    }
                  />
                  <ReviewActionButton
                    danger
                    label="驳回报告"
                    onClick={() =>
                      setConfirmAction({
                        title: '确认驳回该报告？',
                        description: '驳回后将通知提交人原因。请确认该报告确实不符合平台提交规范或无法复现。',
                        danger: true,
                        confirmLabel: '确认驳回',
                        onConfirm: () => submitReview('REJECT'),
                      })
                    }
                  />
                </div>
              </SurfacePanel>
            </div>

            <div className="space-y-6">
              <SurfacePanel className="p-6">
                <h2 className="text-xl font-semibold">漏洞详情</h2>
                <section className="mt-5">
                  <h3 className="text-sm font-semibold">漏洞描述</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-400">{selectedReport.description}</p>
                </section>
                <section className="mt-5">
                  <h3 className="text-sm font-semibold">复现步骤</h3>
                  <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-black/10 bg-black/[0.025] p-4 text-sm leading-7 dark:border-white/10 dark:bg-white/[0.035]">
                    {selectedReport.reproduce}
                  </pre>
                </section>
                <section className="mt-5">
                  <h3 className="text-sm font-semibold">修复建议</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-400">{selectedReport.repair}</p>
                </section>
                {selectedReport.attachments.length > 0 && (
                  <section className="mt-5">
                    <h3 className="text-sm font-semibold">PDF 附件</h3>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      {selectedReport.attachments.map((attachment) => (
                        <div
                          className="flex items-center justify-between gap-3 rounded-lg border border-black/10 bg-black/[0.025] px-3 py-2 text-sm dark:border-white/10 dark:bg-white/[0.035]"
                          key={attachment.id}
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium">{attachment.originalName}</p>
                            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                              {formatFileSize(attachment.sizeBytes)}
                            </p>
                          </div>
                          <button
                            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-black/10 px-2.5 py-1.5 text-xs font-medium transition hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
                            disabled={previewingAttachmentId === attachment.id}
                            onClick={() => void handlePreviewAttachment(attachment.id)}
                            type="button"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            {previewingAttachmentId === attachment.id ? '打开中' : '预览'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </SurfacePanel>

              <SurfacePanel className="p-6">
                <h2 className="text-xl font-semibold">触发请求包</h2>
                <pre className="mt-5 overflow-x-auto rounded-lg border border-black/10 bg-slate-950 p-4 text-sm leading-7 text-green-100 dark:border-white/10">
                  {selectedReport.requestPacket}
                </pre>
              </SurfacePanel>
            </div>
          </div>
        </section>
        <ConfirmDialog state={confirmAction} onCancel={() => setConfirmAction(null)} onConfirm={() => { confirmAction?.onConfirm(); setConfirmAction(null) }} />
      </>
    )
  }

  return (
    <>
      <PageShell>
        <PageHeader
          eyebrow="Review Queue"
          eyebrowIcon={<FileSearch className="h-3.5 w-3.5" />}
          title="漏洞审核"
          description="处理分派给你的漏洞报告，结合 AI 初评完成复现、价值判断、补充材料要求和审核结论。"
        />
        {errorMessage && <FloatingNotice message={errorMessage} onClose={() => setErrorMessage('')} variant="error" />}
        {done && <SuccessNotice>{done}</SuccessNotice>}
        <FilterBar>
          <SearchInput label="搜索漏洞" onChange={setKeyword} placeholder="编号、标题、资产或提交人" value={keyword} />
          <SelectInput label="审核状态" onChange={setStatus} options={reviewStatusOptions} value={status} />
          <SelectInput label="风险等级" onChange={setLevel} options={levelOptions} value={level} />
          <ResetButton onClick={() => { setKeyword(''); setStatus('全部状态'); setLevel('全部等级') }} />
        </FilterBar>
        <div className="mt-5 grid gap-3">
          {isLoading && (
            <SurfacePanel className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              正在加载审核队列...
            </SurfacePanel>
          )}
          {filteredReports.map((item) => (
            <ReviewReportRow item={item} key={item.reportId} onOpen={() => openReport(item)} />
          ))}
          {!isLoading && filteredReports.length === 0 && <EmptyState label="没有匹配的漏洞报告" />}
        </div>
      </PageShell>
      <ConfirmDialog state={confirmAction} onCancel={() => setConfirmAction(null)} onConfirm={() => { confirmAction?.onConfirm(); setConfirmAction(null) }} />
    </>
  )
}

function AuditorRetestArchive() {
  const [tab, setTab] = useState<'pending' | 'archived'>('pending')
  const [items, setItems] = useState<RetestQueueItem[]>([])
  const [stats, setStats] = useState({ pendingRetest: 0, archived: 0 })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionDialog, setActionDialog] = useState<{
    item: RetestQueueItem
    decision: RetestPayload['decision'] | 'MARK_FIXING'
  } | null>(null)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState('')

  const load = () => {
    setLoading(true)
    setLoadError('')
    listRetestQueue()
      .then((res) => {
        setItems(res.items)
        setStats(res.stats)
      })
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : '加载失败'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const showToast = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(''), 2800)
  }

  const openAction = (item: RetestQueueItem, decision: RetestPayload['decision'] | 'MARK_FIXING') => {
    setNote('')
    setActionDialog({ item, decision })
  }

  const handleConfirm = async () => {
    if (!actionDialog) return
    if (!note.trim() || note.trim().length < 4) return
    setSubmitting(true)
    try {
      if (actionDialog.decision === 'MARK_FIXING') {
        await markFixing(actionDialog.item.id, note.trim())
        showToast('已标记为待复测')
      } else {
        await retestVulnerability(actionDialog.item.id, {
          decision: actionDialog.decision,
          note: note.trim(),
        })
        const labels: Record<RetestPayload['decision'], string> = {
          RETEST_PASS: '复测通过，已归档',
          RETURN_TO_FIX: '已退回责任单位继续修复',
          ARCHIVE: '已直接归档',
        }
        showToast(labels[actionDialog.decision])
      }
      setActionDialog(null)
      load()
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : '操作失败')
    } finally {
      setSubmitting(false)
    }
  }

  const pendingItems = items.filter((i) => i.status === '修复中' || i.status === '待复测')
  const archivedItems = items.filter((i) => i.status === '已归档')
  const displayed = tab === 'pending' ? pendingItems : archivedItems

  const actionMeta: Record<RetestPayload['decision'] | 'MARK_FIXING', { title: string; desc: string; label: string; danger?: boolean }> = {
    MARK_FIXING: {
      title: '确认标记为待复测？',
      desc: '将当前漏洞状态设置为"待复测"，请填写通知责任单位的说明。',
      label: '确认标记',
    },
    RETEST_PASS: {
      title: '确认复测通过？',
      desc: '通过后漏洞将进入已归档状态，可后续进入证书签发流程。',
      label: '确认通过',
    },
    RETURN_TO_FIX: {
      title: '确认退回修复？',
      desc: '退回后漏洞修复状态将重置为"修复中"，请填写不通过原因。',
      label: '确认退回',
      danger: true,
    },
    ARCHIVE: {
      title: '确认直接归档？',
      desc: '直接归档后将关闭该漏洞生命周期，请确认不需要复测。',
      label: '确认归档',
      danger: true,
    },
  }

  return (
    <>
      <PageShell>
        <PageHeader
          eyebrow="Retest"
          eyebrowIcon={<RotateCcw className="h-3.5 w-3.5" />}
          title="复测归档"
          description="核验资产责任单位提交的修复结果，完成复测通过、退回修复、归档记录和证书签发衔接。"
        />
        {toast && <SuccessNotice>{toast}</SuccessNotice>}

        {/* 分页 tab */}
        <div className="mt-6 flex items-center gap-1 rounded-xl border border-black/10 bg-black/[0.025] p-1 w-fit dark:border-white/10 dark:bg-white/[0.03]">
          <button
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === 'pending'
                ? 'bg-white shadow-sm dark:bg-white/10'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
            onClick={() => setTab('pending')}
            type="button"
          >
            待复测
            {stats.pendingRetest > 0 && (
              <span className="ml-2 rounded-full bg-brand-600/15 px-1.5 py-0.5 text-xs font-semibold text-brand-700 dark:text-green-300">
                {stats.pendingRetest}
              </span>
            )}
          </button>
          <button
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === 'archived'
                ? 'bg-white shadow-sm dark:bg-white/10'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
            onClick={() => setTab('archived')}
            type="button"
          >
            已归档
            {stats.archived > 0 && (
              <span className="ml-2 rounded-full bg-slate-500/10 px-1.5 py-0.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
                {stats.archived}
              </span>
            )}
          </button>
        </div>

        {/* 内容区 */}
        {loading ? (
          <SurfacePanel className="mt-4 p-10 text-center text-sm text-slate-500">正在加载复测队列...</SurfacePanel>
        ) : loadError ? (
          <SurfacePanel className="mt-4 p-10 text-center">
            <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
            <button className="mt-4 text-sm text-brand-700 dark:text-green-300 underline" onClick={load} type="button">重试</button>
          </SurfacePanel>
        ) : displayed.length === 0 ? (
          <SurfacePanel className="mt-4 p-10 text-center text-sm text-slate-500 dark:text-slate-400">
            {tab === 'pending' ? '暂无待复测的漏洞' : '暂无已归档的漏洞'}
          </SurfacePanel>
        ) : (
          <div className="mt-4 grid gap-3">
            {displayed.map((item) => (
              <SurfacePanel className="p-5" key={item.id}>
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-slate-400">{item.reportNo}</span>
                      {item.finalSeverity && (
                        <LevelBadge level={item.finalSeverity as ReviewLevel} />
                      )}
                      <RetestStatusBadge status={item.status as RetestStatus} />
                    </div>
                    <h2 className="mt-2 text-base font-semibold leading-snug">{item.title}</h2>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                      <span>{item.assetName}</span>
                      {item.ownerUnit && <span>{item.ownerUnit}</span>}
                      <span>提交人：{item.submitter.name}</span>
                      <span>更新：{new Date(item.updatedAt).toLocaleDateString('zh-CN')}</span>
                    </div>
                    {item.lastFixNote && (
                      <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400 line-clamp-2">
                        <span className="font-medium">最近备注：</span>{item.lastFixNote}
                      </p>
                    )}
                  </div>
                  {tab === 'pending' && (
                    <div className="flex flex-wrap items-start justify-end gap-2">
                      {item.status === '修复中' && (
                        <ReviewActionButton
                          label="标记待复测"
                          onClick={() => openAction(item, 'MARK_FIXING')}
                        />
                      )}
                      {item.status === '待复测' && (
                        <>
                          <ReviewActionButton
                            label="复测通过"
                            onClick={() => openAction(item, 'RETEST_PASS')}
                          />
                          <ReviewActionButton
                            danger
                            label="退回修复"
                            onClick={() => openAction(item, 'RETURN_TO_FIX')}
                          />
                          <ReviewActionButton
                            label="直接归档"
                            onClick={() => openAction(item, 'ARCHIVE')}
                          />
                        </>
                      )}
                    </div>
                  )}
                  {tab === 'archived' && item.archivedAt && (
                    <div className="text-right">
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        归档于 {new Date(item.archivedAt).toLocaleDateString('zh-CN')}
                      </p>
                    </div>
                  )}
                </div>
              </SurfacePanel>
            ))}
          </div>
        )}
      </PageShell>

      {/* 复测操作对话框 */}
      {actionDialog && (
        <RetestActionDialog
          meta={actionMeta[actionDialog.decision]}
          note={note}
          onCancel={() => setActionDialog(null)}
          onConfirm={() => void handleConfirm()}
          onNoteChange={setNote}
          submitting={submitting}
        />
      )}
    </>
  )
}


function AuditorAIAssistant() {
  const [hasMessage, setHasMessage] = useState(false)
  return (
    <PageShell size="md">
      <div className={`flex min-h-[64vh] flex-col ${hasMessage ? 'justify-end' : 'justify-center'}`}>
        {!hasMessage && (
          <div className="mx-auto max-w-2xl text-center">
            <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-brand-700 dark:text-green-300">
              <Bot className="h-3.5 w-3.5" />
              Auditor AI
            </p>
            <h1 className="mt-5 text-3xl font-semibold tracking-tight md:text-4xl">审核辅助智能体</h1>
            <p className="mt-4 leading-7 text-slate-600 dark:text-slate-400">
              可用于漏洞价值预判、复现材料检查、修复建议润色和测试边界核对。AI 仅提供辅助建议，最终结论由审核员确认。
            </p>
          </div>
        )}
        {hasMessage && (
          <div className="mx-auto mb-6 grid w-full max-w-3xl gap-4">
            <SurfacePanel className="p-4">
              <p className="text-sm text-slate-500 dark:text-slate-400">你</p>
              <p className="mt-2">帮我检查 SRC-2026-0008 的材料完整度。</p>
            </SurfacePanel>
            <SurfacePanel className="p-4">
              <p className="text-sm text-brand-700 dark:text-green-300">AI 审核助手</p>
              <p className="mt-2 leading-7 text-slate-600 dark:text-slate-400">
                建议补充测试边界、授权账号来源、弱口令影响范围和修复前保密承诺。当前材料可进入初审，但不宜直接确认有效。
              </p>
            </SurfacePanel>
          </div>
        )}
        <SurfacePanel className="mx-auto w-full max-w-3xl p-3">
          <div className="flex items-end gap-2">
            <textarea
              className="min-h-16 flex-1 resize-none rounded-lg border border-black/10 bg-white/70 px-3 py-3 text-sm outline-none transition focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10 dark:bg-white/5 dark:text-white"
              placeholder="询问漏洞价值、复现材料、修复建议或审核结论风险..."
            />
            <button
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-brand-600 text-white transition hover:bg-brand-700"
              onClick={() => setHasMessage(true)}
              type="button"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </SurfacePanel>
      </div>
    </PageShell>
  )
}

function AuditorReviewHistory() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Review History"
        eyebrowIcon={<History className="h-3.5 w-3.5" />}
        title="审核记录"
        description="查看你的审核动作、复测结论、证书签发和补充材料通知记录。"
      />
      <SurfacePanel className="mt-6 overflow-hidden p-0">
        <div className="grid grid-cols-[160px_minmax(0,1fr)_160px_120px] gap-4 border-b border-black/10 px-4 py-3 text-xs font-medium text-slate-500 dark:border-white/10 dark:text-slate-400">
          <span>时间</span>
          <span>动作</span>
          <span>目标</span>
          <span>结果</span>
        </div>
        <div className="divide-y divide-black/10 dark:divide-white/10">
          {reviewHistory.map((item) => (
            <div className="grid gap-4 px-4 py-3 text-sm md:grid-cols-[160px_minmax(0,1fr)_160px_120px]" key={item.id}>
              <span className="text-slate-500 dark:text-slate-400">{item.time}</span>
              <span className="font-medium">{item.action}</span>
              <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{item.target}</span>
              <span>{item.result}</span>
            </div>
          ))}
        </div>
      </SurfacePanel>
    </PageShell>
  )
}

function AuditorAnnouncementManagement() {
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('全部状态')
  const [range, setRange] = useState('全部范围')
  const [editingAnnouncement, setEditingAnnouncement] = useState<AuditorAnnouncement | null>(null)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)
  const [done, setDone] = useState('')

  const filteredAnnouncements = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()
    return auditorAnnouncements.filter((item) => {
      const matchesKeyword =
        !normalizedKeyword ||
        item.id.toLowerCase().includes(normalizedKeyword) ||
        item.title.toLowerCase().includes(normalizedKeyword) ||
        item.summary.toLowerCase().includes(normalizedKeyword)
      const matchesStatus = status === '全部状态' || item.status === status
      const matchesRange = range === '全部范围' || item.range === range
      return matchesKeyword && matchesStatus && matchesRange
    })
  }, [keyword, range, status])

  const complete = (message: string) => {
    setDone(message)
    window.setTimeout(() => setDone(''), 2200)
  }

  return (
    <>
      <PageShell>
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <PageHeader
            eyebrow="Announcement Ops"
            eyebrowIcon={<Megaphone className="h-3.5 w-3.5" />}
            title="公告管理"
            description="审核员可维护面向学生和审核工作的公告，支持草稿、发布、下架和置顶，重要规则变更可直接通知用户。"
          />
          <button
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-brand-700"
            onClick={() =>
              setEditingAnnouncement({
                id: 'ANN-AUD-NEW',
                title: '',
                category: '审核通知',
                status: '草稿',
                range: '全体用户',
                pinned: false,
                date: '2026-04-28',
                summary: '',
                content: '',
                readCount: 0,
              })
            }
            type="button"
          >
            <Plus className="h-4 w-4" />
            新建公告
          </button>
        </div>
        {done && <SuccessNotice>{done}</SuccessNotice>}

        <SurfacePanel className="relative z-30 mt-6 p-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px_180px_auto] lg:items-end">
            <SearchInput label="搜索公告" onChange={setKeyword} placeholder="公告编号、标题或摘要" value={keyword} />
            <SelectInput label="发布状态" onChange={setStatus} options={['全部状态', '草稿', '已发布', '已下架']} value={status} />
            <SelectInput label="发布范围" onChange={setRange} options={['全部范围', '全体用户', '学生用户', '审核员']} value={range} />
            <ResetButton onClick={() => { setKeyword(''); setStatus('全部状态'); setRange('全部范围') }} />
          </div>
        </SurfacePanel>

        <div className="mt-5 grid gap-3">
          {filteredAnnouncements.map((item) => (
            <SurfacePanel className="p-4 transition hover:border-brand-600/25 hover:bg-white/85 dark:hover:bg-white/[0.055]" key={item.id}>
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px] xl:items-start">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{item.id}</span>
                    <span className="rounded-md border border-brand-600/20 bg-brand-600/10 px-2 py-1 text-xs font-medium text-brand-800 dark:text-green-300">
                      {item.category}
                    </span>
                    <AnnouncementStatusBadge status={item.status} />
                    {item.pinned && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-brand-600/20 bg-brand-600/10 px-2 py-1 text-xs font-medium text-brand-800 dark:text-green-300">
                        <Pin className="h-3.5 w-3.5" />
                        置顶
                      </span>
                    )}
                  </div>
                  <h2 className="mt-3 text-lg font-semibold">{item.title || '未命名公告草稿'}</h2>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{item.summary || '暂无摘要，编辑后保存为草稿。'}</p>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                    <span>范围：{item.range}</span>
                    <span>日期：{item.date}</span>
                    <span>阅读：{item.readCount}</span>
                  </div>
                </div>
                <div className="flex flex-wrap justify-start gap-2 xl:justify-end">
                  <button
                    className="inline-flex items-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
                    onClick={() => setEditingAnnouncement(item)}
                    type="button"
                  >
                    <PenLine className="h-4 w-4" />
                    编辑
                  </button>
                  <button
                    className="inline-flex items-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
                    onClick={() => setEditingAnnouncement(item)}
                    type="button"
                  >
                    <Eye className="h-4 w-4" />
                    预览
                  </button>
                  <button
                    className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
                    onClick={() =>
                      setConfirmAction({
                        title: '确认发布公告？',
                        description: `公告将发布给「${item.range}」。发布后用户将在公告页看到该内容，相关操作会写入审计日志。`,
                        onConfirm: () => complete('公告发布已记录'),
                      })
                    }
                    type="button"
                  >
                    <Send className="h-4 w-4" />
                    发布
                  </button>
                  <button
                    className="rounded-lg border border-red-500/20 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-500/10 dark:text-red-300"
                    onClick={() =>
                      setConfirmAction({
                        title: '确认下架公告？',
                        description: '下架后普通用户将无法在公告列表看到该公告，但平台仍会保留历史记录用于审计。',
                        confirmLabel: '确认下架',
                        danger: true,
                        onConfirm: () => complete('公告下架已记录'),
                      })
                    }
                    type="button"
                  >
                    下架
                  </button>
                </div>
              </div>
            </SurfacePanel>
          ))}
          {filteredAnnouncements.length === 0 && <EmptyState label="没有匹配的公告" />}
        </div>
      </PageShell>

      <EditAuditorAnnouncementModal
        announcement={editingAnnouncement}
        onClose={() => setEditingAnnouncement(null)}
        onDone={() => complete('公告草稿已更新')}
      />
      <ConfirmDialog state={confirmAction} onCancel={() => setConfirmAction(null)} onConfirm={() => { confirmAction?.onConfirm(); setConfirmAction(null) }} />
    </>
  )
}

function AnnouncementStatusBadge({ status }: { status: AnnouncementStatus }) {
  return <span className={`rounded-md border px-2 py-1 text-xs font-medium ${announcementStatusStyles[status]}`}>{status}</span>
}

function EditAuditorAnnouncementModal({
  announcement,
  onClose,
  onDone,
}: {
  announcement: AuditorAnnouncement | null
  onClose: () => void
  onDone: () => void
}) {
  if (!announcement) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/35 px-5 backdrop-blur-sm">
      <div className="max-h-[86vh] w-full max-w-[820px] overflow-y-auto rounded-lg border border-black/10 bg-[#f7f9f7]/95 p-6 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-[#0f1511]/95">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-brand-700 dark:text-green-300">
              <PenLine className="h-5 w-5" />
              <span className="text-sm font-medium">Announcement Editor</span>
            </div>
            <h2 className="mt-2 text-2xl font-semibold">{announcement.id === 'ANN-AUD-NEW' ? '新建公告' : '编辑公告'}</h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">保存为草稿后可在公告管理中预览，发布或下架会二次确认。</p>
          </div>
          <button
            aria-label="关闭公告编辑"
            className="rounded-lg p-2 text-slate-500 transition hover:bg-black/5 hover:text-slate-950 dark:hover:bg-white/10 dark:hover:text-white"
            onClick={onClose}
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 grid gap-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">公告标题</span>
            <input
              className="mt-2 w-full rounded-lg border border-black/10 bg-white/70 px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10 dark:bg-white/5 dark:text-white"
              defaultValue={announcement.title}
              placeholder="请输入公告标题"
            />
          </label>
          <div className="grid gap-4 md:grid-cols-3">
            <SelectInput label="公告分类" options={['审核通知', '规则更新', '安全提醒', '活动通知']} value={announcement.category} />
            <SelectInput label="发布范围" options={['全体用户', '学生用户', '审核员']} value={announcement.range} />
            <SelectInput label="是否置顶" options={['不置顶', '置顶']} value={announcement.pinned ? '置顶' : '不置顶'} />
          </div>
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">公告摘要</span>
            <textarea
              className="mt-2 min-h-20 w-full resize-none rounded-lg border border-black/10 bg-white/70 px-3 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10 dark:bg-white/5 dark:text-white"
              defaultValue={announcement.summary}
              placeholder="用于公告列表展示的简短说明"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">公告正文</span>
            <textarea
              className="mt-2 min-h-56 w-full resize-y rounded-lg border border-black/10 bg-white/70 px-3 py-3 text-sm leading-7 text-slate-900 outline-none transition focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10 dark:bg-white/5 dark:text-white"
              defaultValue={announcement.content}
              placeholder="请输入公告正文，支持分段"
            />
          </label>
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-800 dark:text-amber-200">
            公告中如涉及漏洞细节、测试边界或敏感数据，请确认内容已脱敏且符合平台公开规则。
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            className="rounded-lg border border-black/10 px-4 py-2.5 text-sm font-medium transition hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
            onClick={onClose}
            type="button"
          >
            取消
          </button>
          <button
            className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700"
            onClick={() => {
              onDone()
              onClose()
            }}
            type="button"
          >
            保存草稿
          </button>
        </div>
      </div>
    </div>
  )
}

void AuditorAnnouncementManagement

function AuditorProfile({ user }: { user: AuthUser }) {
  return (
    <PageShell size="md">
      <PageHeader
        eyebrow="Profile"
        eyebrowIcon={<UserCheck className="h-3.5 w-3.5" />}
        title="个人中心"
        description="查看审核员账号、权限范围和最近工作状态。"
      />
      <SurfacePanel className="mt-6 p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-600 text-2xl font-semibold text-white">
            {user.name.slice(0, 1)}
          </div>
          <div>
            <h2 className="text-2xl font-semibold">{user.name}</h2>
            <p className="mt-1 font-mono text-sm text-slate-500 dark:text-slate-400">{user.unifiedCode}</p>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{user.email}</p>
          </div>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <InfoBox label="角色" value="审核员" />
          <InfoBox label="权限范围" value="漏洞审核 / 复测 / 证书管理 / 公告管理" />
          <InfoBox label="今日完成" value="4 项" />
        </div>
      </SurfacePanel>
    </PageShell>
  )
}

function ReviewReportRow({ item, onOpen }: { item: ReviewReport; onOpen: () => void }) {
  return (
    <SurfacePanel className="p-4 transition hover:border-brand-600/25 hover:bg-white/85 dark:hover:bg-white/[0.055]">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{item.id}</span>
            <LevelBadge level={item.level} />
            <ReviewStatusBadge status={item.status} />
          </div>
          <h2 className="mt-2 text-lg font-semibold">{item.title}</h2>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
            <span>{item.asset}</span>
            <span>{item.owner}</span>
            <span>提交人：{item.submitter}</span>
            <span>AI：{item.aiScore}</span>
          </div>
          <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{item.aiSummary}</p>
        </div>
        <div className="flex flex-wrap justify-start gap-2 xl:justify-end">
          <button
            className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
            onClick={onOpen}
            type="button"
          >
            进入审核
          </button>
        </div>
      </div>
    </SurfacePanel>
  )
}

function mapReviewQueueItem(item: ReviewQueueItem): ReviewReport {
  return {
    aiScore: item.attachments.length > 0 ? 82 : 68,
    aiSummary: item.lastEvent?.note || getReviewHint(item.status),
    aiTags: buildReviewTags(item),
    asset: item.assetName,
    attachments: item.attachments,
    description: item.impactAssessment,
    id: item.reportNo,
    level: (item.finalSeverity ?? item.selfSeverity) as ReviewLevel,
    owner: item.ownerUnit || '待确认',
    points: item.points,
    repair: item.repairSuggestion,
    reportId: item.id,
    reproduce: item.reproductionSteps,
    requestPacket: item.requestPacket || '提交材料未包含触发请求包。',
    status: item.status as ReviewStatus,
    submittedAt: formatDateTime(item.submittedAt),
    submitter: `${item.submitter.name}（${item.submitter.unifiedCode}）`,
    title: item.title,
    updatedAt: formatDateTime(item.updatedAt),
  }
}

function buildReviewTags(item: ReviewQueueItem) {
  const tags = [item.vulnerabilityType]
  if (item.attachments.length > 0) tags.push('含附件')
  if (item.status === '待初审') tags.push('待复现')
  if (item.status === '待补充') tags.push('材料补充')
  if (item.finalSeverity) tags.push('已定级')
  return tags.slice(0, 4)
}

function getReviewHint(status: string) {
  if (status === '待补充') return '该报告已要求提交人补充材料，请等待用户完善复现证据后继续审核。'
  if (status === '审核中') return '该报告正在审核中，请结合附件、请求包和测试边界确认漏洞有效性。'
  if (status === '已确认') return '该报告已确认有效，可进入修复协同、复测和证书流程。'
  if (status === '已驳回') return '该报告已驳回，历史意见已保留用于审计。'
  return '该报告等待初审，请先确认授权边界、复现完整性和影响范围。'
}

function defaultReviewNote(status: ReviewStatus) {
  if (status === '待补充') return '请补充复现步骤、影响范围、测试边界说明或必要的脱敏证明材料。'
  if (status === '已驳回') return '该报告暂不符合平台漏洞提交规范或无法在授权范围内复现。'
  return '经审核，报告材料基本完整，漏洞影响和复现路径明确。'
}

function defaultPointsForLevel(level: ReviewLevel) {
  if (level === '严重') return 800
  if (level === '高危') return 500
  if (level === '中危') return 260
  if (level === '低危') return 80
  return 20
}

function formatDateTime(value: string | null) {
  if (!value) return '未提交'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024) return `${sizeBytes} B`
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`
  return `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`
}

function PageShell({ children, size = 'lg' }: { children: ReactNode; size?: 'md' | 'lg' }) {
  const width = size === 'md' ? 'max-w-[1080px]' : 'max-w-[1360px]'
  return <section className={`relative z-10 mx-auto ${width} px-5 pb-8 pt-24 md:px-8`}>{children}</section>
}

function FilterBar({ children }: { children: ReactNode }) {
  return (
    <SurfacePanel className="relative z-30 mt-6 p-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px_180px_auto] lg:items-end">{children}</div>
    </SurfacePanel>
  )
}

function ResetButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      className="inline-flex items-center justify-center gap-2 rounded-lg border border-black/10 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
      onClick={onClick}
      type="button"
    >
      <Activity className="h-4 w-4" />
      重置
    </button>
  )
}

function ReviewActionButton({ danger = false, label, onClick }: { danger?: boolean; label: string; onClick: () => void }) {
  return (
    <button
      className={`rounded-lg border px-4 py-3 text-sm font-medium transition ${
        danger
          ? 'border-red-500/20 text-red-700 hover:bg-red-500/10 dark:text-red-300'
          : 'border-black/10 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10'
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  )
}

function LevelBadge({ level }: { level: ReviewLevel }) {
  return <span className={`rounded-md px-2 py-1 text-xs font-medium ${levelStyles[level]}`}>{level}</span>
}

function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  return <span className={`rounded-md border px-2 py-1 text-xs font-medium ${reviewStatusStyles[status]}`}>{status}</span>
}

function RetestStatusBadge({ status }: { status: RetestStatus }) {
  return <span className={`rounded-md border px-2 py-1 text-xs font-medium ${retestStatusStyles[status]}`}>{status}</span>
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-black/10 bg-black/[0.025] p-4 dark:border-white/10 dark:bg-white/[0.035]">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-semibold">{value}</p>
    </div>
  )
}

function SuccessNotice({ children }: { children: ReactNode }) {
  return (
    <FloatingNotice message={children} variant="success" />
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <SurfacePanel className="p-10 text-center">
      <AlertTriangle className="mx-auto h-10 w-10 text-slate-400" />
      <h2 className="mt-4 text-xl font-semibold">{label}</h2>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">调整关键词或筛选条件后再试一次。</p>
    </SurfacePanel>
  )
}

function RetestActionDialog({
  meta,
  note,
  onCancel,
  onConfirm,
  onNoteChange,
  submitting,
}: {
  meta: { danger?: boolean; desc: string; label: string; title: string }
  note: string
  onCancel: () => void
  onConfirm: () => void
  onNoteChange: (v: string) => void
  submitting: boolean
}) {
  const noteValid = note.trim().length >= 4

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/35 px-5 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="w-full max-w-[520px] rounded-xl border border-black/10 bg-[#f7f9f7]/97 p-6 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-[#0f1511]/97">
        <div className="flex items-start gap-3">
          <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${meta.danger ? 'bg-red-500/10 text-red-700 dark:text-red-300' : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'}`}>
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold">{meta.title}</h2>
            <p className="mt-1.5 text-sm leading-6 text-slate-600 dark:text-slate-400">{meta.desc}</p>
          </div>
          <button
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-black/5 dark:hover:bg-white/10"
            onClick={onCancel}
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-4">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            说明 <span className="text-red-500">*</span>
          </label>
          <textarea
            className="mt-1.5 w-full resize-none rounded-lg border border-black/10 bg-white/70 px-3 py-2.5 text-sm outline-none transition focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10 dark:bg-white/5"
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder="请填写复测说明（至少 4 个字）"
            rows={3}
            value={note}
          />
          {note.trim().length > 0 && !noteValid && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">至少需要 4 个字符</p>
          )}
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <button
            className="rounded-lg border border-black/10 px-4 py-2.5 text-sm font-medium transition hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
            onClick={onCancel}
            type="button"
          >
            取消
          </button>
          <button
            className={`rounded-lg px-4 py-2.5 text-sm font-medium text-white transition disabled:opacity-50 ${meta.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-600 hover:bg-brand-700'}`}
            disabled={!noteValid || submitting}
            onClick={onConfirm}
            type="button"
          >
            {submitting ? '提交中...' : meta.label}
          </button>
        </div>
      </div>
    </div>
  )
}

function ConfirmDialog({
  onCancel,
  onConfirm,
  state,
}: {
  onCancel: () => void
  onConfirm: () => void
  state: ConfirmAction
}) {
  if (!state) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/35 px-5 backdrop-blur-sm">
      <div className="w-full max-w-[520px] rounded-lg border border-black/10 bg-[#f7f9f7]/95 p-6 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-[#0f1511]/95">
        <div className="flex gap-3">
          <span className={`mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${state.danger ? 'bg-red-500/10 text-red-700 dark:text-red-300' : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'}`}>
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold">{state.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{state.description}</p>
          </div>
          <button
            aria-label="关闭确认弹窗"
            className="h-9 rounded-lg p-2 text-slate-500 transition hover:bg-black/5 hover:text-slate-950 dark:hover:bg-white/10 dark:hover:text-white"
            onClick={onCancel}
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            className="rounded-lg border border-black/10 px-4 py-2.5 text-sm font-medium transition hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
            onClick={onCancel}
            type="button"
          >
            取消
          </button>
          <button
            className={`rounded-lg px-4 py-2.5 text-sm font-medium text-white transition ${state.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-600 hover:bg-brand-700'}`}
            onClick={onConfirm}
            type="button"
          >
            {state.confirmLabel ?? '确认'}
          </button>
        </div>
      </div>
    </div>
  )
}
