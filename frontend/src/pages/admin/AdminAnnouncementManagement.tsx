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
  RefreshCw,
  Send,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { AlertMessage } from '../../components/ui/AlertMessage'
import { FloatingNotice } from '../../components/ui/FloatingNotice'
import { PageHeader } from '../../components/ui/PageHeader'
import { SearchInput } from '../../components/ui/SearchInput'
import { SelectInput } from '../../components/ui/SelectInput'
import { SurfacePanel } from '../../components/ui/SurfacePanel'
import {
  createAnnouncement,
  listManagedAnnouncements,
  offlineAnnouncement,
  publishAnnouncement,
  updateAnnouncement,
} from '../../services/announcements'
import type { AnnouncementItem, AnnouncementPayload } from '../../services/announcements'

type ConfirmAction = {
  confirmLabel?: string
  danger?: boolean
  description: string
  onConfirm: () => Promise<void>
  title: string
} | null

const categoryOptions = ['全部分类', '平台通知', '规则更新', '安全提醒', '活动通知', '审核通知']
const statusOptions = ['全部状态', '草稿', '已发布', '已下架']
const rangeOptions = ['全部范围', '全体用户', '学生用户', '审核员', '管理员']
const editCategoryOptions = ['平台通知', '规则更新', '安全提醒', '活动通知', '审核通知']
const editRangeOptions = ['全体用户', '学生用户', '审核员', '管理员']

const categoryStyles: Record<string, string> = {
  平台通知: 'border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  规则更新: 'border-brand-600/20 bg-brand-600/10 text-brand-800 dark:text-green-300',
  安全提醒: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  活动通知: 'border-purple-500/20 bg-purple-500/10 text-purple-700 dark:text-purple-300',
  审核通知: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
}

const statusStyles: Record<string, string> = {
  草稿: 'border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-300',
  已发布: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  已下架: 'border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300',
}

const emptyAnnouncement: AnnouncementPayload = {
  category: '平台通知',
  content: '',
  pinned: false,
  range: '全体用户',
  summary: '',
  title: '',
}

export function AdminAnnouncementManagement() {
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([])
  const [keyword, setKeyword] = useState('')
  const [category, setCategory] = useState('全部分类')
  const [status, setStatus] = useState('全部状态')
  const [range, setRange] = useState('全部范围')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingAnnouncement, setEditingAnnouncement] = useState<AnnouncementItem | 'new' | null>(null)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function loadAnnouncements() {
    setError('')
    setLoading(true)
    try {
      const response = await listManagedAnnouncements()
      setAnnouncements(response.items)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '公告列表加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAnnouncements()
  }, [])

  useEffect(() => {
    if (!message && !error) return undefined
    const timer = window.setTimeout(() => {
      setMessage('')
      setError('')
    }, 3200)
    return () => window.clearTimeout(timer)
  }, [error, message])

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
  }, [announcements, category, keyword, range, status])

  const selectedAnnouncement = selectedId
    ? announcements.find((item) => item.id === selectedId) ?? null
    : null

  async function runAction(action: () => Promise<unknown>, successMessage: string) {
    setError('')
    setMessage('')
    try {
      await action()
      setMessage(successMessage)
      await loadAnnouncements()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : '操作失败')
    }
  }

  async function publish(item: AnnouncementItem) {
    await runAction(() => publishAnnouncement(item.id), '公告已发布，操作已写入审计日志。')
  }

  async function offline(item: AnnouncementItem) {
    await runAction(() => offlineAnnouncement(item.id), '公告已下线，操作已写入审计日志。')
  }

  if (selectedAnnouncement) {
    return (
      <>
        <FloatingNotice
          message={message || error}
          variant={error ? 'error' : 'success'}
          onClose={() => {
            setMessage('')
            setError('')
          }}
        />
        <section className="relative z-10 mx-auto max-w-[1360px] px-5 pb-8 pt-24 md:px-8">
          <button
            className="inline-flex items-center gap-2 rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
            onClick={() => setSelectedId(null)}
            type="button"
          >
            <ArrowLeft className="h-4 w-4" />
            返回公告列表
          </button>


          <article className="mt-5 grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
            <SurfacePanel className="p-5 lg:sticky lg:top-24">
              <div className="flex flex-wrap items-center gap-2">
                <CategoryBadge category={selectedAnnouncement.category} />
                <StatusBadge status={selectedAnnouncement.status} />
                {selectedAnnouncement.pinned && <PinnedBadge />}
              </div>
              <h1 className="mt-5 text-2xl font-semibold tracking-tight">{selectedAnnouncement.title}</h1>
              <div className="mt-5 space-y-3 border-t border-black/10 pt-5 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                <p className="font-mono text-xs">{selectedAnnouncement.id}</p>
                <p>发布范围：{selectedAnnouncement.range}</p>
                <p>创建人：{selectedAnnouncement.author}</p>
                <p>创建时间：{formatDateTime(selectedAnnouncement.createdAt)}</p>
                <p>发布时间：{formatDateTime(selectedAnnouncement.publishedAt)}</p>
                <p>最近更新：{formatDateTime(selectedAnnouncement.updatedAt)}</p>
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
                      description: `公告将发布给「${selectedAnnouncement.range}」，发布后目标用户可见。`,
                      onConfirm: () => publish(selectedAnnouncement),
                      title: '确认发布公告？',
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
                      confirmLabel: '确认下线',
                      danger: true,
                      description: '下线后，目标用户将无法在公告列表中看到该公告，管理端仍保留记录。',
                      onConfirm: () => offline(selectedAnnouncement),
                      title: '确认下线公告？',
                    })
                  }
                  type="button"
                >
                  下线公告
                </button>
              </div>
            </SurfacePanel>

            <SurfacePanel className="p-6 md:p-8">
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">公告详情</p>
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

        <EditAnnouncementModal
          announcement={editingAnnouncement}
          onClose={() => setEditingAnnouncement(null)}
          onSaved={async () => {
            setEditingAnnouncement(null)
            setSelectedId(null)
            setMessage('公告已保存，操作已写入审计日志。')
            await loadAnnouncements()
          }}
        />
        <ConfirmDialog
          state={confirmAction}
          onCancel={() => setConfirmAction(null)}
          onConfirm={async () => {
            await confirmAction?.onConfirm()
            setConfirmAction(null)
          }}
        />
      </>
    )
  }

  return (
    <>
      <FloatingNotice
        message={message || error}
        variant={error ? 'error' : 'success'}
        onClose={() => {
          setMessage('')
          setError('')
        }}
      />
      <section className="relative z-10 mx-auto max-w-[1360px] px-5 pb-8 pt-24 md:px-8">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <PageHeader
            eyebrow="Announcement Ops"
            eyebrowIcon={<Megaphone className="h-3.5 w-3.5" />}
            title="公告管理"
            description="管理平台通知、规则更新、安全提醒和活动公告，支持草稿、发布、置顶、下线和公告详情。"
          />
          <button
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-brand-700"
            onClick={() => setEditingAnnouncement('new')}
            type="button"
          >
            <Plus className="h-4 w-4" />
            新建公告
          </button>
        </div>


        <SurfacePanel className="relative z-30 mt-6 p-5">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_160px_160px_160px_auto_auto] xl:items-end">
            <SearchInput label="搜索公告" onChange={setKeyword} placeholder="公告编号、标题、摘要或创建人" value={keyword} />
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
            <button
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-black/10 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
              onClick={() => void loadAnnouncements()}
              type="button"
            >
              <RefreshCw className="h-4 w-4" />
              刷新
            </button>
          </div>
        </SurfacePanel>

        <div className="mt-5 grid gap-3">
          {loading && (
            <SurfacePanel className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">正在加载公告数据...</SurfacePanel>
          )}

          {!loading &&
            filteredAnnouncements.map((item) => (
              <SurfacePanel className="p-4 transition hover:border-brand-600/25 hover:bg-white/85 dark:hover:bg-white/[0.055]" key={item.id}>
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{item.id}</span>
                      <CategoryBadge category={item.category} />
                      <StatusBadge status={item.status} />
                      {item.pinned && <PinnedBadge />}
                    </div>
                    <h2 className="mt-3 text-lg font-semibold tracking-tight">{item.title}</h2>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{item.summary}</p>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                      <span>范围：{item.range}</span>
                      <span>创建人：{item.author}</span>
                      <span>发布：{formatDateTime(item.publishedAt)}</span>
                      <span>更新：{formatDateTime(item.updatedAt)}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap justify-start gap-2 xl:justify-end">
                    <button className="inline-flex items-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10" onClick={() => setSelectedId(item.id)} type="button">
                      <Eye className="h-4 w-4" />
                      详情
                    </button>
                    <button className="inline-flex items-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10" onClick={() => setEditingAnnouncement(item)} type="button">
                      <PenLine className="h-4 w-4" />
                      编辑
                    </button>
                    <button
                      className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={item.status === '已发布'}
                      onClick={() =>
                        setConfirmAction({
                          description: `公告「${item.title}」将发布给「${item.range}」。`,
                          onConfirm: () => publish(item),
                          title: '确认发布公告？',
                        })
                      }
                      type="button"
                    >
                      <Send className="h-4 w-4" />
                      发布
                    </button>
                    <button
                      className="rounded-lg border border-red-500/20 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60 dark:text-red-300"
                      disabled={item.status === '已下架'}
                      onClick={() =>
                        setConfirmAction({
                          confirmLabel: '确认下线',
                          danger: true,
                          description: '下线后目标用户将不再看到该公告。',
                          onConfirm: () => offline(item),
                          title: '确认下线公告？',
                        })
                      }
                      type="button"
                    >
                      下线
                    </button>
                  </div>
                </div>
              </SurfacePanel>
            ))}

          {!loading && filteredAnnouncements.length === 0 && (
            <SurfacePanel className="p-10 text-center">
              <Bell className="mx-auto h-10 w-10 text-slate-400" />
              <h2 className="mt-4 text-xl font-semibold">没有匹配的公告</h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">调整关键词、分类、状态或发布范围后再试一次。</p>
            </SurfacePanel>
          )}
        </div>
      </section>

      <EditAnnouncementModal
        announcement={editingAnnouncement}
        onClose={() => setEditingAnnouncement(null)}
        onSaved={async () => {
          setEditingAnnouncement(null)
          setMessage('公告已保存，操作已写入审计日志。')
          await loadAnnouncements()
        }}
      />
      <ConfirmDialog
        state={confirmAction}
        onCancel={() => setConfirmAction(null)}
        onConfirm={async () => {
          await confirmAction?.onConfirm()
          setConfirmAction(null)
        }}
      />
    </>
  )
}

function EditAnnouncementModal({
  announcement,
  onClose,
  onSaved,
}: {
  announcement: AnnouncementItem | 'new' | null
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const isNew = announcement === 'new'
  const source = isNew || !announcement ? emptyAnnouncement : announcement
  const [form, setForm] = useState<AnnouncementPayload>(toPayload(source))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setForm(toPayload(source))
    setError('')
  }, [source])

  if (!announcement) return null

  async function save() {
    setSaving(true)
    setError('')
    try {
      if (isNew) {
        await createAnnouncement(form)
      } else {
        await updateAnnouncement(announcement.id, form)
      }
      await onSaved()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '公告保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/35 px-5 backdrop-blur-sm">
      <div className="max-h-[86vh] w-full max-w-[820px] overflow-y-auto rounded-lg border border-black/10 bg-[#f7f9f7]/95 p-6 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-[#0f1511]/95">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-brand-700 dark:text-green-300">
              <PenLine className="h-5 w-5" />
              <span className="text-sm font-medium">Announcement Editor</span>
            </div>
            <h2 className="mt-2 text-2xl font-semibold">{isNew ? '新建公告' : '编辑公告'}</h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">保存后仍为草稿或原状态，发布和下线需要单独确认。</p>
          </div>
          <button aria-label="关闭公告编辑" className="rounded-lg p-2 text-slate-500 transition hover:bg-black/5 hover:text-slate-950 dark:hover:bg-white/10 dark:hover:text-white" onClick={onClose} type="button">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 grid gap-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">公告标题</span>
            <input className="mt-2 w-full rounded-lg border border-black/10 bg-white/70 px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10 dark:bg-white/5 dark:text-white" onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="请输入公告标题" value={form.title} />
          </label>

          <div className="grid gap-4 md:grid-cols-3">
            <SelectInput label="公告分类" onChange={(value) => setForm((current) => ({ ...current, category: value }))} options={editCategoryOptions} value={form.category} />
            <SelectInput label="发布范围" onChange={(value) => setForm((current) => ({ ...current, range: value as AnnouncementPayload['range'] }))} options={editRangeOptions} value={form.range} />
            <SelectInput label="是否置顶" onChange={(value) => setForm((current) => ({ ...current, pinned: value === '置顶' }))} options={['不置顶', '置顶']} value={form.pinned ? '置顶' : '不置顶'} />
          </div>

          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">公告摘要</span>
            <textarea className="mt-2 min-h-20 w-full resize-none rounded-lg border border-black/10 bg-white/70 px-3 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10 dark:bg-white/5 dark:text-white" onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))} placeholder="用于公告列表展示的简短说明" value={form.summary} />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">公告正文</span>
            <textarea className="mt-2 min-h-56 w-full resize-y rounded-lg border border-black/10 bg-white/70 px-3 py-3 text-sm leading-7 text-slate-900 outline-none transition focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10 dark:bg-white/5 dark:text-white" onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))} placeholder="请输入公告正文，支持分段" value={form.content} />
          </label>

          <AlertMessage message="公告中如涉及漏洞细节、测试边界或敏感数据，请确认内容已脱敏且符合平台公开规则。" variant="warning" />
        </div>

        {error && <AlertMessage className="mt-4" message={error} variant="error" />}

        <div className="mt-6 flex justify-end gap-3">
          <button className="rounded-lg border border-black/10 px-4 py-2.5 text-sm font-medium transition hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10" onClick={onClose} type="button">
            取消
          </button>
          <button className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60" disabled={saving} onClick={() => void save()} type="button">
            {saving ? '保存中...' : '保存草稿'}
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
  onConfirm: () => Promise<void>
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
          <button aria-label="关闭确认弹窗" className="h-9 rounded-lg p-2 text-slate-500 transition hover:bg-black/5 hover:text-slate-950 dark:hover:bg-white/10 dark:hover:text-white" onClick={onCancel} type="button">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button className="rounded-lg border border-black/10 px-4 py-2.5 text-sm font-medium transition hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10" onClick={onCancel} type="button">
            取消
          </button>
          <button className={`rounded-lg px-4 py-2.5 text-sm font-medium text-white transition ${state.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-600 hover:bg-brand-700'}`} onClick={() => void onConfirm()} type="button">
            {state.confirmLabel ?? '确认'}
          </button>
        </div>
      </div>
    </div>
  )
}

function CategoryBadge({ category }: { category: string }) {
  return <span className={`rounded-md border px-2 py-1 text-xs font-medium ${categoryStyles[category] ?? categoryStyles.平台通知}`}>{category}</span>
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`rounded-md border px-2 py-1 text-xs font-medium ${statusStyles[status] ?? statusStyles.草稿}`}>{status}</span>
}

function PinnedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-brand-600/20 bg-brand-600/10 px-2 py-1 text-xs font-medium text-brand-800 dark:text-green-300">
      <Pin className="h-3.5 w-3.5" />
      置顶
    </span>
  )
}

function toPayload(source: AnnouncementPayload | AnnouncementItem): AnnouncementPayload {
  return {
    category: source.category,
    content: source.content,
    pinned: source.pinned,
    range: source.range,
    summary: source.summary,
    title: source.title,
  }
}

function formatDateTime(value: string | null) {
  if (!value) return '未发布'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleString('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}
