import { ArrowLeft, Bell, CalendarClock, Megaphone, Pin } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { PageSection } from '../../components/layout/PageSection'
import { AlertMessage } from '../../components/ui/AlertMessage'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { SearchInput } from '../../components/ui/SearchInput'
import { SelectInput } from '../../components/ui/SelectInput'
import { SurfacePanel } from '../../components/ui/SurfacePanel'
import { listVisibleAnnouncements } from '../../services/announcements'
import type { AnnouncementItem } from '../../services/announcements'

const categoryOptions = ['全部公告', '平台通知', '规则更新', '安全提醒', '活动通知', '审核通知']

const categoryStyles: Record<string, string> = {
  平台通知: 'border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  规则更新: 'border-brand-600/20 bg-brand-600/10 text-brand-800 dark:text-green-300',
  安全提醒: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  活动通知: 'border-purple-500/20 bg-purple-500/10 text-purple-700 dark:text-purple-300',
  审核通知: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
}

export function UserAnnouncements() {
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([])
  const [keyword, setKeyword] = useState('')
  const [category, setCategory] = useState('全部公告')
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<AnnouncementItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadAnnouncements() {
      setError('')
      setLoading(true)
      try {
        const response = await listVisibleAnnouncements()
        setAnnouncements(response.items)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : '平台公告加载失败')
      } finally {
        setLoading(false)
      }
    }

    void loadAnnouncements()
  }, [])

  const filteredAnnouncements = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()
    return announcements.filter((item) => {
      const matchesKeyword =
        !normalizedKeyword ||
        item.title.toLowerCase().includes(normalizedKeyword) ||
        item.summary.toLowerCase().includes(normalizedKeyword) ||
        item.id.toLowerCase().includes(normalizedKeyword)
      const matchesCategory = category === '全部公告' || item.category === category

      return matchesKeyword && matchesCategory
    })
  }, [announcements, category, keyword])

  if (selectedAnnouncement) {
    return (
      <PageSection>
        <button
          className="inline-flex items-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
          onClick={() => setSelectedAnnouncement(null)}
          type="button"
        >
          <ArrowLeft className="h-4 w-4" />
          返回公告列表
        </button>

        <article className="mt-6 grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
          <SurfacePanel className="p-5 lg:sticky lg:top-24">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-md border px-2 py-1 text-xs font-medium ${categoryStyles[selectedAnnouncement.category] ?? categoryStyles.平台通知}`}>
                {selectedAnnouncement.category}
              </span>
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
              <p className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4" />
                {formatDate(selectedAnnouncement.publishedAt)}
              </p>
              <p>发布范围：{selectedAnnouncement.range}</p>
            </div>

            <div className="mt-5 rounded-lg border border-black/10 bg-black/[0.025] p-4 dark:border-white/10 dark:bg-white/[0.035]">
              <p className="text-sm font-medium">概要</p>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{selectedAnnouncement.summary}</p>
            </div>

            <AlertMessage
              className="mt-4"
              message="涉及漏洞细节、敏感信息和测试边界的内容，请以平台规则和审核员要求为准。"
              variant="warning"
            />
          </SurfacePanel>

          <SurfacePanel className="p-6 md:p-8">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">详细原文</p>
            <div className="mt-5 whitespace-pre-line text-base leading-8 text-slate-700 dark:text-slate-300">
              {selectedAnnouncement.content}
            </div>
          </SurfacePanel>
        </article>
      </PageSection>
    )
  }

  return (
    <PageSection>
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <PageHeader
          eyebrow="Announcements"
          eyebrowIcon={<Megaphone className="h-3.5 w-3.5" />}
          title="平台公告"
          description="查看平台通知、规则更新、安全提醒和学习活动安排，及时了解漏洞提交与审核流程变化。"
        />
      </div>

      <SurfacePanel className="relative z-30 mt-6 p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px] lg:items-end">
          <SearchInput label="搜索公告" onChange={setKeyword} placeholder="输入公告标题、编号或关键词" value={keyword} />
          <SelectInput label="公告分类" onChange={setCategory} options={categoryOptions} value={category} />
        </div>
      </SurfacePanel>

      {error && <AlertMessage className="mt-4" message={error} onClose={() => setError('')} variant="error" />}

      <div className="mt-6 grid gap-4">
        {loading && <SurfacePanel className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">正在加载平台公告...</SurfacePanel>}

        {!loading &&
          filteredAnnouncements.map((item) => (
            <SurfacePanel className="p-5 transition hover:border-brand-600/25 hover:bg-white/85 dark:hover:bg-white/[0.055]" key={item.id}>
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_120px] lg:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{item.id}</span>
                    <span className={`rounded-md border px-2 py-1 text-xs font-medium ${categoryStyles[item.category] ?? categoryStyles.平台通知}`}>{item.category}</span>
                    {item.pinned && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-brand-600/20 bg-brand-600/10 px-2 py-1 text-xs font-medium text-brand-800 dark:text-green-300">
                        <Pin className="h-3.5 w-3.5" />
                        置顶
                      </span>
                    )}
                  </div>
                  <h2 className="mt-3 text-lg font-semibold tracking-tight">{item.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{item.summary}</p>
                  <p className="mt-3 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <CalendarClock className="h-4 w-4" />
                    {formatDate(item.publishedAt)}
                  </p>
                </div>
                <button
                  className="rounded-lg border border-black/10 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
                  onClick={() => setSelectedAnnouncement(item)}
                  type="button"
                >
                  查看详情
                </button>
              </div>
            </SurfacePanel>
          ))}

        {!loading && filteredAnnouncements.length === 0 && (
          <EmptyState icon={<Bell className="h-10 w-10" />} title="没有匹配的公告" description="调整关键词或公告分类后再试一次。" />
        )}
      </div>
    </PageSection>
  )
}

function formatDate(value: string | null) {
  if (!value) return '未发布'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleDateString('zh-CN')
}
