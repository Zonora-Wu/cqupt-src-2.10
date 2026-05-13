import {
  Award,
  Bell,
  CheckCircle2,
  Megaphone,
  MessageSquare,
  ShieldCheck,
} from 'lucide-react'
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import type { NotificationChannel } from '../../services/notifications'
import { getNotifications } from '../../services/notifications'


/* ─── 已读状态 key 前缀（存 localStorage，值为最后查看时间戳） ─── */
const SEEN_KEY_PREFIX = 'notif_seen_'

function getSeenAt(channelId: string): number {
  return Number(localStorage.getItem(`${SEEN_KEY_PREFIX}${channelId}`) ?? 0)
}

function markSeen(channelId: string) {
  localStorage.setItem(`${SEEN_KEY_PREFIX}${channelId}`, String(Date.now()))
}

/* ─── 图标映射 ─── */
const iconMap: Record<string, ReactNode> = {
  award: <Award className="h-5 w-5" />,
  bell: <Bell className="h-5 w-5" />,
  megaphone: <Megaphone className="h-5 w-5" />,
  shield: <ShieldCheck className="h-5 w-5" />,
}

const iconBgMap: Record<string, string> = {
  award: 'bg-amber-500',
  bell: 'bg-slate-500',
  megaphone: 'bg-blue-500',
  shield: 'bg-brand-600',
}

/* ─── 主组件 ─── */
export function UserNotifications() {
  const [channels, setChannels] = useState<NotificationChannel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeId, setActiveId] = useState<string>('')
  const [seenMap, setSeenMap] = useState<Record<string, number>>({})
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLoading(true)
    setError('')
    getNotifications()
      .then((data) => {
        setChannels(data.channels)
        if (data.channels.length > 0) {
          setActiveId(data.channels[0].id)
        }
        const map: Record<string, number> = {}
        for (const ch of data.channels) {
          map[ch.id] = getSeenAt(ch.id)
        }
        setSeenMap(map)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : '通知加载失败，请刷新重试')
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeId])

  function handleSelect(id: string) {
    setActiveId(id)
    markSeen(id)
    setSeenMap((prev) => ({ ...prev, [id]: Date.now() }))
  }

  const unreadMap = useMemo(() => {
    const map: Record<string, number> = {}
    for (const ch of channels) {
      const seen = seenMap[ch.id] ?? 0
      map[ch.id] = ch.messages.filter((m) => new Date(m.createdAt).getTime() > seen).length
    }
    return map
  }, [channels, seenMap])

  const activeChannel = channels.find((c) => c.id === activeId) ?? channels[0]

  const groupedMessages = useMemo(() => {
    if (!activeChannel) return []
    return groupByDate(activeChannel.messages)
  }, [activeChannel])

  return (
    <section className="relative z-10 mx-auto flex max-w-[1180px] gap-0 px-5 pb-8 pt-24 md:px-8">
      <div className="flex h-[calc(100vh-7rem)] w-full overflow-hidden rounded-lg border border-black/10 bg-white/95 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/[0.035]">

        {/* 左侧频道列表 */}
        <aside className="flex w-64 shrink-0 flex-col border-r border-black/10 dark:border-white/10">
          <div className="flex h-14 items-center gap-2 border-b border-black/10 px-4 dark:border-white/10">
            <MessageSquare className="h-4 w-4 text-brand-600 dark:text-green-300" />
            <span className="text-sm font-semibold">通知中心</span>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {loading && (
              <p className="px-4 py-6 text-center text-xs text-slate-400 dark:text-slate-500">加载中…</p>
            )}
            {!loading && error && (
              <p className="px-4 py-6 text-center text-xs text-red-500">{error}</p>
            )}
            {!loading && !error && channels.map((ch) => {
              const isActive = ch.id === activeId
              const unread = unreadMap[ch.id] ?? 0
              const last = ch.messages[0]
              return (
                <button
                  className={`flex w-full items-center gap-3 px-3 py-3 text-left transition ${
                    isActive ? 'bg-brand-600/10 dark:bg-green-300/10' : 'hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                  key={ch.id}
                  onClick={() => handleSelect(ch.id)}
                  type="button"
                >
                  <div className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white ${iconBgMap[ch.iconType] ?? 'bg-slate-500'}`}>
                    {iconMap[ch.iconType]}
                    {unread > 0 && (
                      <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                        {unread > 9 ? '9+' : unread}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm font-medium ${isActive ? 'text-brand-700 dark:text-green-300' : ''}`}>
                        {ch.title}
                      </span>
                      {last && (
                        <span className="shrink-0 text-[11px] text-slate-400 dark:text-slate-500">
                          {formatRelativeDate(last.createdAt)}
                        </span>
                      )}
                    </div>
                    <p className={`mt-0.5 truncate text-xs ${unread > 0 ? 'font-medium text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500'}`}>
                      {last?.content ?? '暂无消息'}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </aside>

        {/* 右侧消息内容 */}
        <div className="flex min-w-0 flex-1 flex-col">
          {activeChannel && (
            <>
              <div className="flex h-14 shrink-0 items-center gap-3 border-b border-black/10 px-5 dark:border-white/10">
                <div className={`flex h-7 w-7 items-center justify-center rounded-full text-white [&>svg]:h-3.5 [&>svg]:w-3.5 ${iconBgMap[activeChannel.iconType] ?? 'bg-slate-500'}`}>
                  {iconMap[activeChannel.iconType]}
                </div>
                <span className="text-sm font-semibold">{activeChannel.title}</span>
                <span className="ml-auto text-xs text-slate-400 dark:text-slate-500">
                  共 {activeChannel.messages.length} 条消息
                </span>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4">
                <div className="mx-auto max-w-2xl space-y-1">
                  {activeChannel.messages.length === 0 && (
                    <p className="py-16 text-center text-sm text-slate-400 dark:text-slate-500">暂无消息</p>
                  )}
                  {groupedMessages.map((item) => {
                    if (item.type === 'date') {
                      return (
                        <div className="flex items-center gap-3 py-3" key={item.label}>
                          <div className="h-px flex-1 bg-black/10 dark:bg-white/10" />
                          <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">{item.label}</span>
                          <div className="h-px flex-1 bg-black/10 dark:bg-white/10" />
                        </div>
                      )
                    }
                    return (
                      <MessageBubble
                        content={item.message.content}
                        icon={iconMap[activeChannel.iconType]}
                        iconBg={iconBgMap[activeChannel.iconType] ?? 'bg-slate-500'}
                        key={item.message.id}
                        time={formatTime(item.message.createdAt)}
                        title={activeChannel.title}
                      />
                    )
                  })}
                  <div ref={bottomRef} />
                </div>
              </div>
            </>
          )}
          {!activeChannel && !loading && (
            <div className="flex flex-1 items-center justify-center text-sm text-slate-400 dark:text-slate-500">
              暂无通知频道
            </div>
          )}
          <div className="shrink-0 border-t border-black/10 px-5 py-3 dark:border-white/10">
            <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              通知由系统自动发送，无需回复。如有问题请联系管理员。
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─── 消息气泡 ─── */
function MessageBubble({
  content,
  icon,
  iconBg,
  time,
  title,
}: {
  content: string
  icon: ReactNode
  iconBg: string
  time: string
  title: string
}) {
  return (
    <div className="flex items-start gap-3 py-1">
      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white [&>svg]:h-4 [&>svg]:w-4 ${iconBg}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{title}</span>
          <span className="text-[11px] text-slate-400 dark:text-slate-500">{time}</span>
        </div>
        <div className="mt-1 max-w-lg rounded-lg rounded-tl-sm bg-black/[0.04] px-3.5 py-2.5 text-sm leading-6 text-slate-700 dark:bg-white/[0.06] dark:text-slate-300">
          {content}
        </div>
      </div>
    </div>
  )
}

/* ─── 工具函数 ─── */
type DateGroupItem =
  | { label: string; type: 'date' }
  | { message: { content: string; createdAt: string; id: string }; type: 'message' }

function groupByDate(
  messages: Array<{ content: string; createdAt: string; id: string }>,
): DateGroupItem[] {
  const result: DateGroupItem[] = []
  const sorted = [...messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  let lastDate = ''
  for (const msg of sorted) {
    const dateLabel = new Date(msg.createdAt).toLocaleDateString('zh-CN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    if (dateLabel !== lastDate) {
      result.push({ label: dateLabel, type: 'date' })
      lastDate = dateLabel
    }
    result.push({ message: msg, type: 'message' })
  }
  return result
}

function formatTime(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', hour12: false, minute: '2-digit' })
}

function formatRelativeDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diffDays === 0) return '今天'
  if (diffDays === 1) return '昨天'
  if (diffDays < 7) return `${diffDays}天前`
  return d.toLocaleDateString('zh-CN', { day: 'numeric', month: 'numeric' })
}
