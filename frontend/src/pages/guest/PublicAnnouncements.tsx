import { ArrowLeft, Bell, CalendarDays, ChevronRight, Pin } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { AlertMessage } from '../../components/ui/AlertMessage'
import { listPublicAnnouncements } from '../../services/announcements'
import type { AnnouncementItem } from '../../services/announcements'

export function PublicAnnouncements() {
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([])
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<AnnouncementItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadAnnouncements() {
      setError('')
      setLoading(true)
      try {
        const response = await listPublicAnnouncements()
        setAnnouncements(response.items)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : '公开公告加载失败')
      } finally {
        setLoading(false)
      }
    }

    void loadAnnouncements()
  }, [])

  if (selectedAnnouncement) {
    return (
      <motion.main
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 mx-auto max-w-6xl px-5 pb-24 pt-44 md:px-8 md:pt-48"
        initial={{ opacity: 0, y: 18 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        <button
          className="guest-hover-surface inline-flex items-center gap-2 rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-slate-700 dark:border-white/10 dark:text-slate-300"
          onClick={() => setSelectedAnnouncement(null)}
          type="button"
        >
          <ArrowLeft className="h-4 w-4" />
          返回公告列表
        </button>

        <article className="mt-6 grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start">
          <aside className="guest-palette-item rounded-lg border border-black/10 bg-[var(--app-panel-bg)] p-6 backdrop-blur-xl dark:border-white/10">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-brand-600/10 px-2 py-1 text-xs font-medium text-brand-700 dark:text-brand-300">
                {selectedAnnouncement.category}
              </span>
              {selectedAnnouncement.pinned && (
                <span className="inline-flex items-center gap-1 rounded-md border border-brand-600/20 bg-brand-600/10 px-2 py-1 text-xs font-medium text-brand-800 dark:text-brand-300">
                  <Pin className="h-3.5 w-3.5" />
                  置顶
                </span>
              )}
            </div>
            <h1 className="mt-5 text-2xl font-semibold tracking-tight">{selectedAnnouncement.title}</h1>
            <div className="mt-5 space-y-3 border-t border-black/10 pt-5 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
              <p className="font-mono text-xs">{selectedAnnouncement.id}</p>
              <p>发布时间：{formatDate(selectedAnnouncement.publishedAt)}</p>
              <p>发布范围：{selectedAnnouncement.range}</p>
            </div>
            <p className="mt-5 rounded-lg border border-black/10 bg-[var(--app-panel-muted-bg)] p-4 text-sm leading-6 text-slate-600 dark:border-white/10  dark:text-slate-400">
              {selectedAnnouncement.summary}
            </p>
          </aside>

          <section className="rounded-lg border border-black/10 bg-[var(--app-surface)] p-7 dark:border-white/10">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">公告原文</p>
            <div className="mt-5 whitespace-pre-line text-base leading-8 text-slate-700 dark:text-slate-300">
              {selectedAnnouncement.content}
            </div>
          </section>
        </article>
      </motion.main>
    )
  }

  return (
    <main className="relative z-10 mx-auto max-w-6xl px-5 pb-24 pt-44 md:px-8 md:pt-48">
      <motion.section
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-4xl text-center"
        initial={{ opacity: 0, y: 22 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">平台动态与规则更新</h1>
        <p className="mx-auto mt-6 max-w-3xl text-base leading-8 text-slate-600 dark:text-slate-400 md:text-lg">
          查看 CQUPT-SRC 的公开通知、规则调整、学习活动与证书体系说明。涉及漏洞细节、敏感资产和审核信息的内容不会公开展示。
        </p>
      </motion.section>

      <motion.section
        animate="visible"
        className="mt-16 grid gap-5"
        initial="hidden"
        transition={{ delayChildren: 0.16, staggerChildren: 0.08 }}
        variants={{ hidden: {}, visible: {} }}
      >
        {loading && (
          <div className="rounded-lg border border-black/10 bg-[var(--app-panel-bg)] p-8 text-center text-sm text-slate-500 backdrop-blur-xl dark:border-white/10 ">
            正在加载公开公告...
          </div>
        )}

        {error && (
          <AlertMessage message={error} onClose={() => setError('')} variant="error" />
        )}

        {!loading &&
          announcements.map((item) => (
            <motion.article
              className="guest-hover-surface guest-palette-item group rounded-lg border border-black/10 bg-[var(--app-panel-bg)] p-6 backdrop-blur-xl dark:border-white/10"
              key={item.id}
              variants={{ hidden: { opacity: 0, x: -18 }, visible: { opacity: 1, x: 0 } }}
            >
              <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div className="flex gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-brand-600/20 bg-brand-600/10 text-brand-700 dark:text-brand-300">
                    {item.pinned ? <Pin className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
                  </div>
                  <div>
                    <div className="mb-2 flex flex-wrap items-center gap-3">
                      <span className="rounded-md bg-brand-600/10 px-2 py-1 text-xs font-medium text-brand-700 dark:text-brand-300">
                        {item.category}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {formatDate(item.publishedAt)}
                      </span>
                    </div>
                    <h2 className="text-xl font-semibold">{item.title}</h2>
                    <p className="mt-3 leading-7 text-slate-600 dark:text-slate-400">{item.summary}</p>
                  </div>
                </div>
                <button
                  className="guest-hover-surface inline-flex items-center gap-1 self-start rounded-lg border border-black/10 px-3 py-2 text-sm text-slate-700 dark:border-white/10 dark:text-slate-300"
                  onClick={() => setSelectedAnnouncement(item)}
                  type="button"
                >
                  查看详情
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </motion.article>
          ))}

        {!loading && announcements.length === 0 && !error && (
          <div className="rounded-lg border border-black/10 bg-[var(--app-panel-bg)] p-8 text-center text-sm text-slate-500 backdrop-blur-xl dark:border-white/10 ">
            暂无公开公告。
          </div>
        )}
      </motion.section>
    </main>
  )
}

function formatDate(value: string | null) {
  if (!value) return '未发布'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleDateString('zh-CN')
}
