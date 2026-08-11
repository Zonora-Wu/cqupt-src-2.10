import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpDown,
  Bell,
  ChevronDown,
  ChevronUp,
  Filter,
  Megaphone,
  PenLine,
  Pin,
  Plus,
  RefreshCw,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { AlertMessage } from '../../components/ui/AlertMessage'
import { FloatingNotice } from '../../components/ui/FloatingNotice'
import { PageHeader } from '../../components/ui/PageHeader'
import { PaginationBar } from '../../components/ui/PaginationBar'
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
const defaultPageSize = 10
type SortDirection = 'asc' | 'desc'
type AnnouncementSortKey = 'author' | 'category' | 'publishedAt' | 'range' | 'readCount' | 'status' | 'title' | 'updatedAt'

const defaultSort: { direction: SortDirection; key: AnnouncementSortKey } = {
  direction: 'desc',
  key: 'updatedAt',
}

const announcementSortColumns: Array<{ className?: string; key: AnnouncementSortKey; label: string }> = [
  { key: 'title', label: '公告标题 / 编号' },
  { className: 'hidden xl:flex', key: 'category', label: '分类' },
  { className: 'hidden xl:flex', key: 'status', label: '状态' },
  { className: 'hidden xl:flex', key: 'range', label: '范围' },
  { className: 'hidden 2xl:flex', key: 'author', label: '创建人' },
  { className: 'hidden 2xl:flex', key: 'readCount', label: '阅读' },
  { className: 'hidden xl:flex', key: 'publishedAt', label: '发布时间' },
  { className: 'hidden xl:flex', key: 'updatedAt', label: '更新时间' },
]

const announcementStatusRank: Record<string, number> = {
  草稿: 1,
  已发布: 3,
  已下架: 0,
}

const categoryStyles: Record<string, string> = {
  平台通知: 'border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  规则更新: 'border-brand-600/20 bg-brand-600/10 text-brand-800 dark:text-brand-300',
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

function SortHeaderButton({
  active,
  className = '',
  direction,
  label,
  onClick,
}: {
  active: boolean
  className?: string
  direction: SortDirection
  label: string
  onClick: () => void
}) {
  const Icon = active ? direction === 'asc' ? ChevronUp : ChevronDown : ArrowUpDown
  return (
    <button
      className={`group -ml-1 inline-flex min-w-0 items-center gap-1 rounded-md px-1.5 py-1 text-left transition hover:bg-black/5 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-200 ${className}`}
      onClick={onClick}
      title={`按${label}排序`}
      type="button"
    >
      <span className="truncate">{label}</span>
      <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-brand-700 dark:text-brand-300' : 'opacity-45 group-hover:opacity-80'}`} />
    </button>
  )
}

function LedgerCell({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">{label}</p>
      <p className={`mt-1 truncate text-sm ${strong ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>
        {value || '—'}
      </p>
    </div>
  )
}

function compareAnnouncements(a: AnnouncementItem, b: AnnouncementItem, key: AnnouncementSortKey, direction: SortDirection) {
  const modifier = direction === 'asc' ? 1 : -1
  const result = compareAnnouncementValue(a, b, key)
  if (result !== 0) return result * modifier
  return compareTimeValue(b.updatedAt, a.updatedAt) || compareTextValue(a.id, b.id)
}

function compareAnnouncementValue(a: AnnouncementItem, b: AnnouncementItem, key: AnnouncementSortKey) {
  switch (key) {
    case 'author':
      return compareTextValue(a.author, b.author)
    case 'category':
      return compareTextValue(a.category, b.category)
    case 'publishedAt':
      return compareTimeValue(a.publishedAt, b.publishedAt)
    case 'range':
      return compareTextValue(a.range, b.range)
    case 'readCount':
      return a.readCount - b.readCount
    case 'status':
      return (announcementStatusRank[a.status] ?? 0) - (announcementStatusRank[b.status] ?? 0)
    case 'title':
      return compareTextValue(`${a.title} ${a.id}`, `${b.title} ${b.id}`)
    case 'updatedAt':
      return compareTimeValue(a.updatedAt, b.updatedAt)
  }
}

function compareTextValue(a: string, b: string) {
  if (!a && !b) return 0
  if (!a) return 1
  if (!b) return -1
  return a.localeCompare(b, 'zh-Hans-CN', { numeric: true, sensitivity: 'base' })
}

function compareTimeValue(a: string | null | undefined, b: string | null | undefined) {
  const left = a ? new Date(a).getTime() : Number.NaN
  const right = b ? new Date(b).getTime() : Number.NaN
  const leftValid = Number.isFinite(left)
  const rightValid = Number.isFinite(right)
  if (!leftValid && !rightValid) return 0
  if (!leftValid) return 1
  if (!rightValid) return -1
  return left - right
}

export function AdminAnnouncementManagement() {
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([])
  const [keyword, setKeyword] = useState('')
  const [category, setCategory] = useState('全部分类')
  const [status, setStatus] = useState('全部状态')
  const [range, setRange] = useState('全部范围')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(defaultPageSize)
  const [sortKey, setSortKey] = useState<AnnouncementSortKey | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaultSort.direction)
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
    let active = true
    queueMicrotask(() => {
      if (active) void loadAnnouncements()
    })
    return () => {
      active = false
    }
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

  const sortedAnnouncements = useMemo(() => {
    return [...filteredAnnouncements].sort((a, b) => compareAnnouncements(a, b, sortKey ?? defaultSort.key, sortKey ? sortDirection : defaultSort.direction))
  }, [filteredAnnouncements, sortDirection, sortKey])

  const changeSort = (nextKey: AnnouncementSortKey) => {
    if (sortKey !== nextKey) {
      setSortKey(nextKey)
      setSortDirection('asc')
    } else if (sortDirection === 'asc') {
      setSortDirection('desc')
    } else {
      setSortKey(null)
      setSortDirection(defaultSort.direction)
    }
    setPage(1)
  }

  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (active) setPage(1)
    })
    return () => {
      active = false
    }
  }, [category, keyword, pageSize, range, status])

  const totalPages = Math.max(1, Math.ceil(sortedAnnouncements.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paginatedAnnouncements = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return sortedAnnouncements.slice(start, start + pageSize)
  }, [pageSize, safePage, sortedAnnouncements])

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
              <h1 className="mt-0 text-2xl font-semibold tracking-tight">{selectedAnnouncement.title}</h1>
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
              <p className="mt-4 rounded-lg border border-black/10 bg-[var(--app-panel-muted-bg)] p-4 text-sm leading-6 text-slate-600 dark:border-white/10  dark:text-slate-400">
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

        {loading && <SurfacePanel className="mt-5 p-10 text-center text-sm text-slate-500 dark:text-slate-400">正在加载公告数据...</SurfacePanel>}

        {!loading && (
          <SurfacePanel className="mt-5 overflow-hidden p-0">
            <div className="flex items-center justify-between gap-4 border-b border-black/10 px-4 py-3 dark:border-white/10">
              <div>
                <h2 className="text-sm font-semibold">公告台账</h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">共 {filteredAnnouncements.length} 条，按当前筛选条件展示</p>
              </div>
              <span className="rounded-md bg-[var(--app-panel-muted-bg)] px-2.5 py-1 text-xs text-slate-500 dark:text-slate-400">数据视图</span>
            </div>

            <div className="grid grid-cols-[260px_minmax(0,1fr)_128px] gap-4 border-b border-black/10 bg-[var(--app-panel-muted-bg)] px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:border-white/10 dark:text-slate-500 xl:grid-cols-[240px_84px_84px_84px_128px_128px_156px] 2xl:grid-cols-[minmax(280px,1fr)_88px_88px_88px_96px_78px_132px_132px_168px]">
              {announcementSortColumns.map((column) => (
                <SortHeaderButton
                  active={sortKey === column.key}
                  className={column.className}
                  direction={sortDirection}
                  key={column.key}
                  label={column.label}
                  onClick={() => changeSort(column.key)}
                />
              ))}
              <span className="col-start-3 justify-self-end text-right xl:col-start-auto">操作</span>
            </div>

            {paginatedAnnouncements.map((item) => (
              <div
                className="grid grid-cols-[260px_minmax(0,1fr)_128px] gap-4 border-b border-black/10 px-3 py-3 transition last:border-b-0 hover:bg-black/[0.025] dark:border-white/10 dark:hover:bg-white/[0.045] xl:grid-cols-[240px_84px_84px_84px_128px_128px_156px] 2xl:grid-cols-[minmax(280px,1fr)_88px_88px_88px_96px_78px_132px_132px_168px]"
                key={item.id}
              >
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">{item.title}</p>
                    {item.pinned && <PinnedBadge />}
                  </div>
                  <p className="mt-1 truncate font-mono text-xs text-slate-500 dark:text-slate-400">{item.id}</p>
                  <p className="mt-1 line-clamp-1 text-xs text-slate-500 dark:text-slate-400 xl:hidden">{item.summary}</p>
                </div>
                <div className="hidden min-w-0 xl:block"><CategoryBadge category={item.category} /></div>
                <div className="hidden min-w-0 xl:block"><StatusBadge status={item.status} /></div>
                <div className="hidden min-w-0 xl:block"><LedgerCell label="范围" value={item.range} /></div>
                <div className="hidden min-w-0 2xl:block"><LedgerCell label="创建人" value={item.author} /></div>
                <div className="hidden min-w-0 2xl:block"><LedgerCell label="阅读" value={`${item.readCount}`} /></div>
                <div className="hidden min-w-0 xl:block"><LedgerCell label="发布" value={formatDateTime(item.publishedAt)} /></div>
                <div className="hidden min-w-0 xl:block"><LedgerCell label="更新" value={formatDateTime(item.updatedAt)} strong /></div>
                <div className="col-start-3 flex w-max max-w-full flex-wrap items-center justify-end gap-1.5 justify-self-end xl:col-start-auto">
                  <button className="rounded-md border border-black/10 px-2 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10" onClick={() => setSelectedId(item.id)} type="button">
                    详情
                  </button>
                  <button className="rounded-md border border-black/10 px-2 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10" onClick={() => setEditingAnnouncement(item)} type="button">
                    编辑
                  </button>
                  <button
                    className="rounded-md bg-brand-600 px-2 py-1.5 text-xs font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
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
                    发布
                  </button>
                  <button
                    className="rounded-md border border-red-500/20 px-2 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60 dark:text-red-300"
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
            ))}

            {filteredAnnouncements.length === 0 && (
              <div className="p-10 text-center">
              <Bell className="mx-auto h-10 w-10 text-slate-400" />
              <h2 className="mt-4 text-xl font-semibold">没有匹配的公告</h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">调整关键词、分类、状态或发布范围后再试一次。</p>
              </div>
            )}

            <PaginationBar
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              page={safePage}
              pageSize={pageSize}
              total={filteredAnnouncements.length}
            />
          </SurfacePanel>
        )}
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
    let active = true
    queueMicrotask(() => {
      if (!active) return
      setForm(toPayload(source))
      setError('')
    })
    return () => {
      active = false
    }
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
      <div className="max-h-[86vh] w-full max-w-[820px] overflow-y-auto rounded-lg border border-black/10 bg-[var(--app-menu-bg)] p-6 shadow-2xl backdrop-blur-xl dark:border-white/10 ">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-brand-700 dark:text-brand-300">
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
            <input autoComplete="off" className="mt-2 w-full rounded-lg border border-black/10 bg-[var(--app-panel-bg)] px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10  dark:text-white" maxLength={120} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="请输入公告标题" value={form.title} />
          </label>

          <div className="grid gap-4 md:grid-cols-3">
            <SelectInput label="公告分类" onChange={(value) => setForm((current) => ({ ...current, category: value }))} options={editCategoryOptions} value={form.category} />
            <SelectInput label="发布范围" onChange={(value) => setForm((current) => ({ ...current, range: value as AnnouncementPayload['range'] }))} options={editRangeOptions} value={form.range} />
            <SelectInput label="是否置顶" onChange={(value) => setForm((current) => ({ ...current, pinned: value === '置顶' }))} options={['不置顶', '置顶']} value={form.pinned ? '置顶' : '不置顶'} />
          </div>

          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">公告摘要</span>
            <textarea className="mt-2 min-h-20 w-full resize-none rounded-lg border border-black/10 bg-[var(--app-panel-bg)] px-3 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10  dark:text-white" maxLength={500} onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))} placeholder="用于公告列表展示的简短说明" value={form.summary} />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">公告正文</span>
            <textarea className="mt-2 min-h-56 w-full resize-y rounded-lg border border-black/10 bg-[var(--app-panel-bg)] px-3 py-3 text-sm leading-7 text-slate-900 outline-none transition focus:border-brand-600/60 focus:ring-1 focus:ring-brand-600/40 dark:border-white/10  dark:text-white" maxLength={20000} onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))} placeholder="请输入公告正文，支持分段" value={form.content} />
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
      <div className="w-full max-w-[520px] rounded-lg border border-black/10 bg-[var(--app-menu-bg)] p-6 shadow-2xl backdrop-blur-xl dark:border-white/10 ">
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
    <span className="inline-flex items-center gap-1 rounded-md border border-brand-600/20 bg-brand-600/10 px-2 py-1 text-xs font-medium text-brand-800 dark:text-brand-300">
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
