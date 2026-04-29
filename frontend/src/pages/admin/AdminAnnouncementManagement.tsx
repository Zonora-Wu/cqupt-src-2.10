import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  Eye,
  Filter,
  Megaphone,
  PenLine,
  Pin,
  Plus,
  Send,
  ShieldAlert,
  X,
} from 'lucide-react'
import { type ReactNode, useMemo, useState } from 'react'
import { PageHeader } from '../../components/ui/PageHeader'
import { SearchInput } from '../../components/ui/SearchInput'
import { SelectInput } from '../../components/ui/SelectInput'
import { SurfacePanel } from '../../components/ui/SurfacePanel'

type AnnouncementStatus = '草稿' | '已发布' | '已下架'
type AnnouncementCategory = '平台通知' | '规则更新' | '安全提醒' | '活动通知'
type PublishRange = '全体用户' | '学生用户' | '审核员' | '管理员'

type AdminAnnouncement = {
  id: string
  title: string
  category: AnnouncementCategory
  status: AnnouncementStatus
  range: PublishRange
  pinned: boolean
  author: string
  createdAt: string
  publishedAt: string
  updatedAt: string
  summary: string
  content: string
  readCount: number
}

type ConfirmAction = {
  title: string
  description: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
} | null

const categoryOptions = ['全部分类', '平台通知', '规则更新', '安全提醒', '活动通知']
const statusOptions = ['全部状态', '草稿', '已发布', '已下架']
const rangeOptions = ['全部范围', '全体用户', '学生用户', '审核员', '管理员']

const announcements: AdminAnnouncement[] = [
  {
    id: 'ANN-2026-004',
    title: '关于规范漏洞报告附件提交格式的通知',
    category: '规则更新',
    status: '已发布',
    range: '全体用户',
    pinned: true,
    author: '平台管理员',
    createdAt: '2026-04-27 09:20',
    publishedAt: '2026-04-27 10:00',
    updatedAt: '2026-04-27 10:00',
    summary: '漏洞报告附件建议使用 PDF 格式，截图需去除无关个人信息，敏感数据必须脱敏展示。',
    content:
      '为提升审核效率并保护敏感数据，平台建议漏洞报告附件统一使用 PDF 格式。复现截图中如包含账号、姓名、手机号、Token、Cookie 等敏感信息，应进行脱敏处理。\n\n禁止在附件中上传未授权获取的数据包、数据库导出文件或大规模扫描结果。审核员发现材料不符合要求时，可要求提交人补充或重新上传。',
    readCount: 286,
  },
  {
    id: 'ANN-2026-003',
    title: '五一期间漏洞审核与复测安排',
    category: '平台通知',
    status: '已发布',
    range: '全体用户',
    pinned: true,
    author: '平台管理员',
    createdAt: '2026-04-26 14:12',
    publishedAt: '2026-04-26 15:30',
    updatedAt: '2026-04-26 15:30',
    summary: '假期期间平台可正常提交漏洞，审核与复测响应时间可能顺延。',
    content:
      '五一假期期间，CQUPT-SRC 平台漏洞提交功能正常开放。审核员将保持值守，但部分资产责任单位修复反馈时间可能顺延。\n\n涉及高危风险的报告请保持联系方式畅通，平台将优先协调处理。',
    readCount: 412,
  },
  {
    id: 'ANN-2026-002',
    title: '新增权限控制专题靶场资源',
    category: '活动通知',
    status: '草稿',
    range: '学生用户',
    pinned: false,
    author: '审核员 A',
    createdAt: '2026-04-24 17:15',
    publishedAt: '未发布',
    updatedAt: '2026-04-24 18:40',
    summary: '学习中心已新增权限控制专题靶场，适合完成 Web 基础训练后的同学继续练习。',
    content:
      '学习中心新增权限控制专题靶场，覆盖水平越权、垂直越权、接口鉴权缺失等常见场景。\n\n请注意靶场训练与真实资产测试的边界差异，真实校园资产测试必须在授权范围内进行。',
    readCount: 0,
  },
  {
    id: 'ANN-2026-001',
    title: '漏洞修复前不得公开传播风险细节',
    category: '安全提醒',
    status: '已下架',
    range: '学生用户',
    pinned: false,
    author: '平台管理员',
    createdAt: '2026-04-21 11:32',
    publishedAt: '2026-04-21 12:00',
    updatedAt: '2026-04-25 09:18',
    summary: '漏洞提交后，在平台确认修复与归档前，不得在公开渠道传播漏洞细节。',
    content:
      '为保护校园网络资产安全，漏洞提交者在漏洞修复与归档前不得通过社交媒体、公开仓库、群聊截图等方式传播漏洞细节、复现步骤、利用脚本或敏感数据。\n\n违反平台规则的，将影响积分、证书和后续提交资格。',
    readCount: 538,
  },
]

const categoryStyles: Record<AnnouncementCategory, string> = {
  平台通知: 'border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  规则更新: 'border-brand-600/20 bg-brand-600/10 text-brand-800 dark:text-green-300',
  安全提醒: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  活动通知: 'border-purple-500/20 bg-purple-500/10 text-purple-700 dark:text-purple-300',
}

const statusStyles: Record<AnnouncementStatus, string> = {
  草稿: 'border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-300',
  已发布: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  已下架: 'border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300',
}

export function AdminAnnouncementManagement() {
  const [keyword, setKeyword] = useState('')
  const [category, setCategory] = useState('全部分类')
  const [status, setStatus] = useState('全部状态')
  const [range, setRange] = useState('全部范围')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingAnnouncement, setEditingAnnouncement] = useState<AdminAnnouncement | null>(null)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)
  const [actionDone, setActionDone] = useState('')

  const filteredAnnouncements = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()

    return announcements.filter((item) => {
      const matchesKeyword =
        !normalizedKeyword ||
        item.id.toLowerCase().includes(normalizedKeyword) ||
        item.title.toLowerCase().includes(normalizedKeyword) ||
        item.summary.toLowerCase().includes(normalizedKeyword) ||
        item.author.toLowerCase().includes(normalizedKeyword)
      const matchesCategory = category === '全部分类' || item.category === category
      const matchesStatus = status === '全部状态' || item.status === status
      const matchesRange = range === '全部范围' || item.range === range

      return matchesKeyword && matchesCategory && matchesStatus && matchesRange
    })
  }, [category, keyword, range, status])

  const selectedAnnouncement = selectedId
    ? announcements.find((item) => item.id === selectedId) ?? null
    : null

  const completeAction = (message: string) => {
    setActionDone(message)
    window.setTimeout(() => setActionDone(''), 2200)
  }

  if (selectedAnnouncement) {
    return (
      <>
        <section className="relative z-10 mx-auto max-w-[1360px] px-5 pb-8 pt-24 md:px-8">
          <button
            className="inline-flex items-center gap-2 rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
            onClick={() => setSelectedId(null)}
            type="button"
          >
            <ArrowLeft className="h-4 w-4" />
            返回公告列表
          </button>

          {actionDone && <SuccessNotice>{actionDone}</SuccessNotice>}

          <article className="mt-5 grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
            <SurfacePanel className="p-5 lg:sticky lg:top-24">
              <div className="flex flex-wrap items-center gap-2">
                <CategoryBadge category={selectedAnnouncement.category} />
                <StatusBadge status={selectedAnnouncement.status} />
                {selectedAnnouncement.pinned && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-brand-600/20 bg-brand-600/10 px-2 py-1 text-xs font-medium text-brand-800 dark:text-green-300">
                    <Pin className="h-3.5 w-3.5" />
                    置顶
                  </span>
                )}
              </div>
              <h1 className="mt-5 text-2xl font-semibold tracking-tight">{selectedAnnouncement.title}</h1>
              <div className="mt-5 space-y-3 border-t border-black/10 pt-5 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                <p className="font-mono text-xs">{selectedAnnouncement.id}</p>
                <p>发布范围：{selectedAnnouncement.range}</p>
                <p>创建人：{selectedAnnouncement.author}</p>
                <p>创建时间：{selectedAnnouncement.createdAt}</p>
                <p>发布时间：{selectedAnnouncement.publishedAt}</p>
                <p>最近更新：{selectedAnnouncement.updatedAt}</p>
                <p>阅读次数：{selectedAnnouncement.readCount}</p>
              </div>

              <div className="mt-5 grid gap-2">
                <button
                  className="rounded-lg bg-brand-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-700"
                  onClick={() => setEditingAnnouncement(selectedAnnouncement)}
                  type="button"
                >
                  编辑公告
                </button>
                <button
                  className="rounded-lg border border-black/10 px-4 py-3 text-sm font-medium transition hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
                  onClick={() =>
                    setConfirmAction({
                      title: '确认发布公告？',
                      description: `公告将发布给「${selectedAnnouncement.range}」。发布后用户将在公告页看到该内容，并可能收到通知。`,
                      onConfirm: () => completeAction('公告发布已记录'),
                    })
                  }
                  type="button"
                >
                  发布公告
                </button>
                <button
                  className="rounded-lg border border-red-500/20 px-4 py-3 text-sm font-medium text-red-700 transition hover:bg-red-500/10 dark:text-red-300"
                  onClick={() =>
                    setConfirmAction({
                      title: '确认下架公告？',
                      description: '下架后，普通用户将无法在公告列表中看到该公告，但管理端仍会保留记录用于审计。',
                      danger: true,
                      confirmLabel: '确认下架',
                      onConfirm: () => completeAction('公告已下架'),
                    })
                  }
                  type="button"
                >
                  下架公告
                </button>
              </div>
            </SurfacePanel>

            <SurfacePanel className="p-6 md:p-8">
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">公告预览</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight">{selectedAnnouncement.title}</h2>
              <p className="mt-4 rounded-lg border border-black/10 bg-black/[0.025] p-4 text-sm leading-6 text-slate-600 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-400">
                {selectedAnnouncement.summary}
              </p>
              <div className="mt-6 whitespace-pre-line text-base leading-8 text-slate-700 dark:text-slate-300">
                {selectedAnnouncement.content}
              </div>
            </SurfacePanel>
          </article>
        </section>

        <EditAnnouncementModal announcement={editingAnnouncement} onClose={() => setEditingAnnouncement(null)} onDone={() => completeAction('公告草稿已更新')} />
        <ConfirmDialog
          state={confirmAction}
          onCancel={() => setConfirmAction(null)}
          onConfirm={() => {
            confirmAction?.onConfirm()
            setConfirmAction(null)
          }}
        />
      </>
    )
  }

  return (
    <>
      <section className="relative z-10 mx-auto max-w-[1360px] px-5 pb-8 pt-24 md:px-8">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <PageHeader
            eyebrow="Announcement Ops"
            eyebrowIcon={<Megaphone className="h-3.5 w-3.5" />}
            title="公告管理"
            description="管理平台通知、规则更新、安全提醒和活动公告，支持草稿、发布、置顶、下架和公告预览。"
          />
          <button
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-brand-700"
            onClick={() =>
              setEditingAnnouncement({
                id: 'ANN-2026-NEW',
                title: '',
                category: '平台通知',
                status: '草稿',
                range: '全体用户',
                pinned: false,
                author: '平台管理员',
                createdAt: '2026-04-28 10:00',
                publishedAt: '未发布',
                updatedAt: '2026-04-28 10:00',
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

        {actionDone && <SuccessNotice>{actionDone}</SuccessNotice>}

        <SurfacePanel className="relative z-30 mt-6 p-5">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_160px_160px_160px_auto] xl:items-end">
            <SearchInput
              label="搜索公告"
              onChange={setKeyword}
              placeholder="公告编号、标题、摘要或创建人"
              value={keyword}
            />
            <SelectInput label="公告分类" onChange={setCategory} options={categoryOptions} value={category} />
            <SelectInput label="发布状态" onChange={setStatus} options={statusOptions} value={status} />
            <SelectInput label="发布范围" onChange={setRange} options={rangeOptions} value={range} />
            <button
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-black/10 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
              onClick={() => {
                setKeyword('')
                setCategory('全部分类')
                setStatus('全部状态')
                setRange('全部范围')
              }}
              type="button"
            >
              <Filter className="h-4 w-4" />
              重置
            </button>
          </div>
        </SurfacePanel>

        <div className="mt-5 grid gap-3">
          {filteredAnnouncements.map((item) => (
            <SurfacePanel className="p-4 transition hover:border-brand-600/25 hover:bg-white/85 dark:hover:bg-white/[0.055]" key={item.id}>
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px] xl:items-start">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{item.id}</span>
                    <CategoryBadge category={item.category} />
                    <StatusBadge status={item.status} />
                    {item.pinned && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-brand-600/20 bg-brand-600/10 px-2 py-1 text-xs font-medium text-brand-800 dark:text-green-300">
                        <Pin className="h-3.5 w-3.5" />
                        置顶
                      </span>
                    )}
                  </div>
                  <h2 className="mt-3 text-lg font-semibold tracking-tight">{item.title}</h2>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{item.summary}</p>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                    <span>范围：{item.range}</span>
                    <span>创建人：{item.author}</span>
                    <span>发布：{item.publishedAt}</span>
                    <span>阅读：{item.readCount}</span>
                  </div>
                </div>

                <div className="flex flex-wrap justify-start gap-2 xl:justify-end">
                  <button
                    className="inline-flex items-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
                    onClick={() => setSelectedId(item.id)}
                    type="button"
                  >
                    <Eye className="h-4 w-4" />
                    详情
                  </button>
                  <button
                    className="inline-flex items-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
                    onClick={() => setEditingAnnouncement(item)}
                    type="button"
                  >
                    <PenLine className="h-4 w-4" />
                    编辑
                  </button>
                  <button
                    className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
                    onClick={() =>
                      setConfirmAction({
                        title: '确认发布公告？',
                        description: `公告「${item.title}」将发布给「${item.range}」。发布后用户将在公告页看到该内容。`,
                        onConfirm: () => completeAction('公告发布已记录'),
                      })
                    }
                    type="button"
                  >
                    <Send className="h-4 w-4" />
                    发布
                  </button>
                </div>
              </div>
            </SurfacePanel>
          ))}

          {filteredAnnouncements.length === 0 && (
            <SurfacePanel className="p-10 text-center">
              <Bell className="mx-auto h-10 w-10 text-slate-400" />
              <h2 className="mt-4 text-xl font-semibold">没有匹配的公告</h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">调整关键词、分类、状态或发布范围后再试一次。</p>
            </SurfacePanel>
          )}
        </div>
      </section>

      <EditAnnouncementModal announcement={editingAnnouncement} onClose={() => setEditingAnnouncement(null)} onDone={() => completeAction('公告草稿已更新')} />
      <ConfirmDialog
        state={confirmAction}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => {
          confirmAction?.onConfirm()
          setConfirmAction(null)
        }}
      />
    </>
  )
}

function CategoryBadge({ category }: { category: AnnouncementCategory }) {
  return <span className={`rounded-md border px-2 py-1 text-xs font-medium ${categoryStyles[category]}`}>{category}</span>
}

function StatusBadge({ status }: { status: AnnouncementStatus }) {
  return <span className={`rounded-md border px-2 py-1 text-xs font-medium ${statusStyles[status]}`}>{status}</span>
}

function SuccessNotice({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">
      <CheckIcon />
      {children}
    </div>
  )
}

function CheckIcon() {
  return <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
}

function EditAnnouncementModal({
  announcement,
  onClose,
  onDone,
}: {
  announcement: AdminAnnouncement | null
  onClose: () => void
  onDone: () => void
}) {
  if (!announcement) return null

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/35 px-5 backdrop-blur-sm">
      <div className="max-h-[86vh] w-full max-w-[820px] overflow-y-auto rounded-lg border border-black/10 bg-[#f7f9f7]/95 p-6 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-[#0f1511]/95">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-brand-700 dark:text-green-300">
              <PenLine className="h-5 w-5" />
              <span className="text-sm font-medium">Announcement Editor</span>
            </div>
            <h2 className="mt-2 text-2xl font-semibold">{announcement.id === 'ANN-2026-NEW' ? '新建公告' : '编辑公告'}</h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              保存为草稿后可在列表中预览，发布操作需要二次确认。
            </p>
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
            <SelectInput label="公告分类" options={['平台通知', '规则更新', '安全提醒', '活动通知']} value={announcement.category} />
            <SelectInput label="发布范围" options={['全体用户', '学生用户', '审核员', '管理员']} value={announcement.range} />
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
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
              <p>公告中如涉及漏洞细节、测试边界或敏感数据，请确认内容已脱敏且符合平台公开规则。</p>
            </div>
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
