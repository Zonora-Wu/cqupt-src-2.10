import { MessageCirclePlus, Send } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useChatSocket } from '../../hooks/useChatSocket'
import { getSavedSession } from '../../services/auth'
import { ApiError } from '../../services/apiClient'
import {
  createDirectConversation,
  getChatBootstrap,
  getChatMessages,
  getChatMessagesAfter,
  markChatRead,
  searchChatContact,
  sendChatMessage,
} from '../../services/chat'
import type { ChatContact, ChatConversation, ChatMessage } from '../../services/chat'
import {
  getNotificationSeenAt,
  getNotificationUnreadCount,
  markNotificationSeen,
  NOTIFICATION_READ_STATE_EVENT,
} from '../../services/notificationReadState'
import { getNotifications, markNotificationChannelRead, markNotificationRead } from '../../services/notifications'
import type { NotificationChannel } from '../../services/notifications'
import { SurfacePanel } from './SurfacePanel'

type Selection = { id: string; kind: 'chat' | 'notification' }

const notificationMarks: Record<string, string> = {
  award: 'bg-amber-500',
  bell: 'bg-slate-500',
  megaphone: 'bg-blue-600',
  shield: 'bg-brand-600',
}

export function NotificationChatCenter({ onClose }: { onClose?: () => void }) {
  const currentUser = getSavedSession()?.user
  const navigate = useNavigate()
  const [channels, setChannels] = useState<NotificationChannel[]>([])
  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [staff, setStaff] = useState<ChatContact[]>([])
  const [selection, setSelection] = useState<Selection | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [contactOpen, setContactOpen] = useState(false)
  const [notificationReadVersion, setNotificationReadVersion] = useState(0)
  const [serverNotificationUnread, setServerNotificationUnread] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const messagesRef = useRef<ChatMessage[]>([])
  const loadedConversationIdRef = useRef('')

  const replaceMessages = useCallback((next: ChatMessage[]) => {
    messagesRef.current = next
    setMessages(next)
    return next
  }, [])

  const appendMessages = useCallback((incoming: ChatMessage[]) => {
    if (incoming.length === 0) return messagesRef.current
    const known = new Set(messagesRef.current.map((message) => message.id))
    const next = [...messagesRef.current, ...incoming.filter((message) => !known.has(message.id))]
    messagesRef.current = next
    setMessages(next)
    return next
  }, [])

  const refreshNotifications = useCallback(async () => {
    const notices = await getNotifications()
    setChannels(notices.channels)
    setServerNotificationUnread(notices.unread.bell)
    return notices
  }, [])

  const refreshChat = useCallback(async () => {
    const chat = await getChatBootstrap()
    setConversations(chat.conversations)
    setStaff(chat.staff)
    return chat
  }, [])

  useEffect(() => {
    let active = true
    void Promise.allSettled([getNotifications(), getChatBootstrap()]).then(([noticeResult, chatResult]) => {
      if (!active) return
      if (noticeResult.status === 'fulfilled') {
        setChannels(noticeResult.value.channels)
        setServerNotificationUnread(noticeResult.value.unread.bell)
      }
      if (chatResult.status === 'fulfilled') {
        setConversations(chatResult.value.conversations)
        setStaff(chatResult.value.staff)
      }
      const noticeChannels = noticeResult.status === 'fulfilled' ? noticeResult.value.channels : []
      const chatConversations = chatResult.status === 'fulfilled' ? chatResult.value.conversations : []
      setSelection((current) => current ?? defaultSelection(noticeChannels, chatConversations))
      if (noticeResult.status === 'rejected' && chatResult.status === 'rejected') {
        setError(`通知和聊天加载失败：${messageOf(noticeResult.reason)}`)
      } else if (noticeResult.status === 'rejected') {
        setError(`系统通知加载失败：${messageOf(noticeResult.reason)}`)
      } else if (chatResult.status === 'rejected') {
        setError(`聊天暂不可用，系统通知仍可查看：${messageOf(chatResult.reason)}`)
      }
      setLoading(false)
    })
    return () => { active = false }
  }, [])

  const activeChat = selection?.kind === 'chat'
    ? conversations.find((item) => item.id === selection.id) ?? null
    : null
  const activeChatId = activeChat?.id ?? ''
  const activeChannel = selection?.kind === 'notification'
    ? channels.find((item) => item.id === selection.id) ?? null
    : null
  const activeChannelId = activeChannel?.id ?? ''
  const activeChannelUnread = activeChannel?.messages.filter((message) => message.readAt === null).length ?? 0

  useEffect(() => {
    if (!activeChatId) {
      loadedConversationIdRef.current = ''
      replaceMessages([])
      return
    }

    loadedConversationIdRef.current = activeChatId
    replaceMessages([])
    let cancelled = false
    void getChatMessages(activeChatId)
      .then((data) => {
        if (cancelled) return
        replaceMessages(data.messages)
        const latest = data.messages.at(-1)
        if (latest) {
          void markChatRead(activeChatId, latest.id)
            .then(() => {
              window.dispatchEvent(new Event(NOTIFICATION_READ_STATE_EVENT))
              return refreshChat()
            })
            .catch(() => {})
        }
      })
      .catch((reason) => setError(messageOf(reason)))
    return () => { cancelled = true }
  }, [activeChatId, refreshChat, replaceMessages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, selection])

  useEffect(() => {
    if (!activeChatId) return
    const markVisibleMessagesRead = () => {
      if (document.visibilityState !== 'visible') return
      const latest = messages.at(-1)
      if (!latest) return
      void markChatRead(activeChatId, latest.id)
        .then(() => {
          window.dispatchEvent(new Event(NOTIFICATION_READ_STATE_EVENT))
          return refreshChat()
        })
        .catch(() => {})
    }
    document.addEventListener('visibilitychange', markVisibleMessagesRead)
    window.addEventListener('focus', markVisibleMessagesRead)
    return () => {
      document.removeEventListener('visibilitychange', markVisibleMessagesRead)
      window.removeEventListener('focus', markVisibleMessagesRead)
    }
  }, [activeChatId, messages, refreshChat])

  useEffect(() => {
    if (!activeChannelId) return
    markNotificationSeen(activeChannelId)
    setNotificationReadVersion((current) => current + 1)
    if (activeChannelUnread === 0) return
    void markNotificationChannelRead(activeChannelId).then(() => {
      const readAt = new Date().toISOString()
      setChannels((current) => current.map((channel) => channel.id === activeChannelId
        ? { ...channel, messages: channel.messages.map((message) => ({ ...message, readAt: message.readAt === null ? readAt : message.readAt })) }
        : channel))
      setServerNotificationUnread((current) => Math.max(0, current - activeChannelUnread))
      window.dispatchEvent(new Event(NOTIFICATION_READ_STATE_EVENT))
    }).catch(() => {})
  }, [activeChannelId, activeChannelUnread])

  const onSocket = useCallback((event: string, payload: unknown) => {
    if (event === 'message.created') {
      const data = payload as { conversationId?: string; message?: ChatMessage }
      if (selection?.kind === 'chat' && data.conversationId === selection.id && data.message) {
        appendMessages([data.message])
        if (data.message.senderId !== currentUser?.id && document.visibilityState === 'visible') {
          void markChatRead(selection.id, data.message.id)
            .then(() => {
              window.dispatchEvent(new Event(NOTIFICATION_READ_STATE_EVENT))
              return refreshChat()
            })
            .catch(() => {})
        } else {
          void refreshChat().catch(() => {})
        }
      } else {
        void refreshChat().catch(() => {})
      }
      return
    }
    if (event === 'notification.created') {
      void refreshNotifications().catch(() => {})
      return
    }
    if (event === 'chat.connection.restored') {
      const recoverMessages = async () => {
        if (selection?.kind !== 'chat' || loadedConversationIdRef.current !== selection.id) return
        const latestKnown = messagesRef.current.at(-1)
        const recovered = latestKnown
          ? await getChatMessagesAfter(selection.id, latestKnown.id)
          : (await getChatMessages(selection.id)).messages
        const next = latestKnown ? appendMessages(recovered) : replaceMessages(recovered)
        const latest = next.at(-1)
        if (latest && document.visibilityState === 'visible') {
          await markChatRead(selection.id, latest.id)
          window.dispatchEvent(new Event(NOTIFICATION_READ_STATE_EVENT))
        }
      }
      void Promise.allSettled([
        refreshNotifications(),
        refreshChat(),
        recoverMessages().catch(async () => {
          if (selection?.kind !== 'chat') return
          const data = await getChatMessages(selection.id)
          replaceMessages(data.messages)
          const latest = data.messages.at(-1)
          if (latest && document.visibilityState === 'visible') return markChatRead(selection.id, latest.id)
        }),
      ])
      return
    }
    void refreshChat().catch(() => {})
  }, [appendMessages, currentUser?.id, refreshChat, refreshNotifications, replaceMessages, selection])

  useChatSocket(onSocket)

  void notificationReadVersion
  const notificationCount = serverNotificationUnread
    + getNotificationUnreadCount(channels.filter((channel) => channel.messages.every((message) => message.readAt === undefined)))
  const chatUnread = useMemo(
    () => conversations.reduce((total, item) => total + item.unread, 0),
    [conversations],
  )

  async function send(content: string) {
    if (!activeChat || sending) return

    setSending(true)
    try {
      const result = await sendChatMessage(activeChat.id, content, crypto.randomUUID())
      if (result.blocked) throw new Error('消息包含敏感词，已被拦截')
      if (result.message) {
        appendMessages([result.message])
      }
      await refreshChat()
    } catch (reason) {
      setError(messageOf(reason))
    } finally {
      setSending(false)
    }
  }

  async function openContact(contact: ChatContact) {
    try {
      const conversation = await createDirectConversation(contact.id)
      setContactOpen(false)
      await refreshChat()
      setSelection({ id: conversation.id, kind: 'chat' })
    } catch (reason) {
      setError(messageOf(reason))
    }
  }

  const showDetail = Boolean(selection)

  return (
    <section className="relative z-10 mx-auto max-w-[1360px] px-5 pb-8 pt-24 md:px-8">
      <SurfacePanel className="relative flex h-[calc(100dvh-7rem)] min-h-[34rem] w-full overflow-hidden p-0">
        <aside className={`flex w-full shrink-0 flex-col md:w-72 md:border-r md:border-black/10 dark:md:border-white/10 ${showDetail ? 'max-md:hidden' : ''}`}>
          <div className="flex h-14 shrink-0 items-center border-b border-black/10 px-4 dark:border-white/10">
            <h1 className="text-sm font-semibold">通知中心</h1>
            {onClose && (
              <button className="ml-auto text-xs text-slate-400 hover:text-slate-700 dark:hover:text-white" onClick={onClose} type="button">
                关闭
              </button>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto py-2">
            <InboxSection label="系统信息" count={notificationCount} />
            {loading && <p className="px-4 py-5 text-center text-xs text-slate-400">加载中...</p>}
            {channels.map((channel) => (
              <InboxRow
                active={selection?.kind === 'notification' && selection.id === channel.id}
                key={channel.id}
                mark={<ChannelMark channel={channel} />}
                onClick={() => setSelection({ id: channel.id, kind: 'notification' })}
                preview={channel.messages[0]?.content ?? '暂无消息'}
                title={channel.title}
                unread={channel.messages.filter((message) => message.readAt === null || (message.readAt === undefined && new Date(message.createdAt).getTime() > getNotificationSeenAt(channel.id))).length}
              />
            ))}

            <div className="mx-4 my-3 border-t border-black/10 dark:border-white/10" />
            <InboxSection label="对话" count={chatUnread} onCreate={() => setContactOpen(true)} />
            {conversations.map((conversation) => (
              <InboxRow
                active={selection?.kind === 'chat' && selection.id === conversation.id}
                key={conversation.id}
                mark={<ConversationMark conversation={conversation} />}
                onClick={() => setSelection({ id: conversation.id, kind: 'chat' })}
                preview={conversation.lastMessage?.content ?? chatPreview(conversation)}
                title={conversation.title}
                unread={conversation.unread}
              />
            ))}
          </div>
        </aside>

        <main className={`min-w-0 flex-1 flex-col ${showDetail ? 'flex' : 'hidden md:flex'}`}>
          {error && (
            <div className="flex items-center gap-3 border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
              <span className="min-w-0 flex-1">{error}</span>
              <button className="shrink-0 underline underline-offset-2" onClick={() => setError('')} type="button">知道了</button>
            </div>
          )}
          {activeChannel && <SystemChannel channel={activeChannel} onBack={() => setSelection(null)} onOpen={async (message) => {
            if (!message.route) return
            if (message.readAt === null) await markNotificationRead(message.id).catch(() => ({ success: false }))
            window.dispatchEvent(new Event(NOTIFICATION_READ_STATE_EVENT))
            navigate(message.route)
          }} />}
          {activeChat && (
            <ChatChannel
              bottomRef={bottomRef}
              conversation={activeChat}
              currentUserId={currentUser?.id ?? ''}
              messages={messages}
              onBack={() => setSelection(null)}
              onSend={send}
              sending={sending}
            />
          )}
          {!activeChannel && !activeChat && <EmptyDetail />}
        </main>

        {contactOpen && <ContactPicker staff={staff} onClose={() => setContactOpen(false)} onSelect={openContact} />}
      </SurfacePanel>
    </section>
  )
}

function SystemChannel({ channel, onBack, onOpen }: { channel: NotificationChannel; onBack: () => void; onOpen: (message: NotificationChannel['messages'][number]) => void }) {
  return (
    <>
      <DetailHeader meta={`共 ${channel.messages.length} 条`} onBack={onBack} title={channel.title} />
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 md:px-7">
        <div className="mx-auto max-w-2xl">
          {channel.messages.length === 0 ? (
            <p className="py-20 text-center text-sm text-slate-400">暂无消息</p>
          ) : (
            <div className="space-y-6">
              {channel.messages.map((message) => (
                <article
                  className={`border-l-2 border-brand-600/70 pl-4 ${message.route ? 'cursor-pointer rounded-r-md py-2 transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]' : ''}`}
                  key={message.id}
                  onClick={() => void onOpen(message)}
                >
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400">
                    <span>{channel.title}</span>
                    <time>{formatTime(message.createdAt)}</time>
                  </div>
                  <p className="mt-2 text-sm leading-7 text-slate-700 dark:text-slate-300">{message.content}</p>
                  {message.route && <p className="mt-1 text-xs text-brand-700 dark:text-brand-300">查看详情</p>}
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
      <footer className="shrink-0 border-t border-black/10 px-5 py-3 text-xs text-slate-400 dark:border-white/10 md:px-7">
        系统信息仅供查看，无需回复。
      </footer>
    </>
  )
}

function ChatChannel({
  bottomRef,
  conversation,
  currentUserId,
  messages,
  onBack,
  onSend,
  sending,
}: {
  bottomRef: React.RefObject<HTMLDivElement | null>
  conversation: ChatConversation
  currentUserId: string
  messages: ChatMessage[]
  onBack: () => void
  onSend: (content: string) => Promise<void>
  sending: boolean
}) {
  const [value, setValue] = useState('')
  const [quotaNoticeOpen, setQuotaNoticeOpen] = useState(false)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const disabled = !conversation.canSend || conversation.status !== 'OPEN'

  useEffect(() => {
    const composer = composerRef.current
    if (!composer) return

    const maxHeight = 112
    composer.style.height = '40px'
    const nextHeight = Math.min(Math.max(composer.scrollHeight, 40), maxHeight)
    composer.style.height = `${nextHeight}px`
    composer.style.overflowY = composer.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }, [value])

  async function submit(confirmed = false) {
    const content = value.trim()
    if (!content || disabled) return
    if (!confirmed && !conversation.accepted && conversation.strangerRemaining === 3) {
      setQuotaNoticeOpen(true)
      return
    }
    setValue('')
    await onSend(content)
  }

  return (
    <>
      <DetailHeader meta={conversationMeta(conversation)} onBack={onBack} title={conversation.title} />
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 md:px-7">
        <div className="w-full space-y-4">
          {messages.length === 0 && <p className="py-20 text-center text-sm text-slate-400">开始对话</p>}
          {messages.map((message) => <ChatBubble currentUserId={currentUserId} key={message.id} message={message} />)}
          {!conversation.accepted && conversation.strangerRemaining === 0 && <FirstReplyLimitNotice />}
          <div ref={bottomRef} />
        </div>
      </div>
      <footer className="shrink-0 border-t border-black/10 px-5 py-3 dark:border-white/10 md:px-7">
        <div className="flex items-end gap-2">
          <textarea
            className="h-10 min-h-10 flex-1 resize-none rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-brand-600/60 disabled:bg-black/[0.03] dark:border-white/10 dark:disabled:bg-white/[0.04]"
            disabled={disabled || sending}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void submit()
              }
            }}
            placeholder={composerPlaceholder(conversation, disabled)}
            ref={composerRef}
            value={value}
          />
          <button
            aria-label="发送"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-600 text-white transition-colors hover:bg-brand-700 disabled:bg-slate-300 dark:disabled:bg-white/15"
            disabled={disabled || sending || !value.trim()}
            onClick={() => void submit()}
            title="发送"
            type="button"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1.5 text-[11px] text-slate-400">聊天记录受平台安全审计与管理规则约束。</p>
      </footer>
      {quotaNoticeOpen && (
        <FirstMessageNotice
          onCancel={() => setQuotaNoticeOpen(false)}
          onConfirm={() => {
            setQuotaNoticeOpen(false)
            void submit(true)
          }}
        />
      )}
    </>
  )
}

function FirstReplyLimitNotice() {
  return (
    <div className="mx-auto max-w-xl border-y border-brand-600/20 py-3 text-center text-xs leading-5 text-slate-500 dark:text-slate-400">
      已发送 3 条消息。请等待对方回复后继续发送，额度不会随时间恢复。
    </div>
  )
}

function FirstMessageNotice({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
      <SurfacePanel className="w-full max-w-md p-0 shadow-xl">
        <div className="border-b border-black/10 px-5 py-4 dark:border-white/10">
          <h2 className="text-base font-semibold">首次消息规则</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">对方回复前，当前对话最多发送 3 条消息。额度不会随时间恢复。</p>
        </div>
        <div className="flex justify-end gap-3 px-5 py-3">
          <button className="rounded-md px-3 py-2 text-sm text-slate-500 hover:bg-black/[0.05] dark:hover:bg-white/[0.06]" onClick={onCancel} type="button">返回修改</button>
          <button className="rounded-md bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700" onClick={onConfirm} type="button">继续发送</button>
        </div>
      </SurfacePanel>
    </div>
  )
}

function ContactPicker({ staff, onClose, onSelect }: { staff: ChatContact[]; onClose: () => void; onSelect: (contact: ChatContact) => void }) {
  const [code, setCode] = useState('')
  const [result, setResult] = useState<ChatContact | null>(null)

  async function search() {
    try {
      setResult(await searchChatContact(code))
    } catch {
      setResult(null)
    }
  }

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
      <SurfacePanel className="w-full max-w-sm p-0 shadow-xl">
        <div className="flex items-center border-b border-black/10 px-4 py-3 dark:border-white/10">
          <h2 className="text-sm font-semibold">发起对话</h2>
          <button className="ml-auto text-xs text-slate-400 hover:text-slate-700 dark:hover:text-white" onClick={onClose} type="button">关闭</button>
        </div>
        <div className="p-4">
          <div className="flex gap-2">
            <input className="min-w-0 flex-1 rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-600/60 dark:border-white/10" onChange={(event) => setCode(event.target.value)} placeholder="统一认证码" value={code} />
            <button className="rounded-md border border-brand-600/30 px-3 text-xs text-brand-700 hover:bg-brand-600/10 dark:text-brand-300" onClick={() => void search()} type="button">查找</button>
          </div>
          {result && <ContactButton contact={result} onClick={() => onSelect(result)} />}
          <p className="mb-1 mt-4 text-xs text-slate-400">管理员与审核员</p>
          {staff.map((contact) => <ContactButton contact={contact} key={contact.id} onClick={() => onSelect(contact)} />)}
        </div>
      </SurfacePanel>
    </div>
  )
}

function DetailHeader({ meta, onBack, title }: { meta: string; onBack: () => void; title: string }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-black/10 px-5 dark:border-white/10 md:px-7">
      <button className="text-xs text-brand-700 hover:text-brand-800 dark:text-brand-300 md:hidden" onClick={onBack} type="button">会话</button>
      <div className="min-w-0">
        <h2 className="truncate text-sm font-semibold">{title}</h2>
        <p className="truncate text-[11px] text-slate-400">{meta}</p>
      </div>
    </header>
  )
}

function InboxSection({ label, count, onCreate }: { label: string; count?: number; onCreate?: () => void }) {
  return (
    <div className="flex h-8 items-center px-4">
      <span className="text-[11px] font-medium text-slate-400">{label}</span>
      {count ? <span className="ml-1 text-[11px] text-brand-700 dark:text-brand-300">{count}</span> : null}
      {onCreate && (
        <button aria-label="发起对话" className="ml-auto flex h-7 w-7 items-center justify-center rounded-md text-brand-700 hover:bg-brand-600/10 dark:text-brand-300" onClick={onCreate} title="发起对话" type="button">
          <MessageCirclePlus className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

function InboxRow({ active, mark, onClick, preview, title, unread }: { active: boolean; mark: React.ReactNode; onClick: () => void; preview: string; title: string; unread?: number }) {
  return (
    <button className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${active ? 'bg-brand-600/10' : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.05]'}`} onClick={onClick} type="button">
      {mark}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{title}</span>
          {unread ? <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] text-white">{unread > 9 ? '9+' : unread}</span> : null}
        </span>
        <span className="mt-0.5 block truncate text-xs text-slate-400">{preview}</span>
      </span>
    </button>
  )
}

function ChannelMark({ channel }: { channel: NotificationChannel }) {
  return <span className={`flex h-8 w-1 shrink-0 rounded-full ${notificationMarks[channel.iconType] ?? 'bg-slate-500'}`} />
}

function ConversationMark({ conversation }: { conversation: ChatConversation }) {
  if (conversation.avatarUrl) {
    return <img alt={`${conversation.title}头像`} className="h-8 w-8 shrink-0 rounded-full object-cover" src={conversation.avatarUrl} />
  }

  const background = conversation.type === 'GLOBAL'
    ? 'bg-amber-500'
    : conversation.type === 'GROUP'
      ? 'bg-slate-600'
      : 'bg-brand-600'
  const label = conversation.type === 'GLOBAL' ? '全' : conversation.type === 'GROUP' ? '群' : conversation.title.slice(0, 1)

  return <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium text-white ${background}`}>{label}</span>
}

function ContactButton({ contact, onClick }: { contact: ChatContact; onClick: () => void }) {
  return (
    <button className="mt-2 flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-brand-600/10" onClick={onClick} type="button">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-xs text-white">{contact.name.slice(0, 1)}</span>
      <span className="min-w-0 flex-1 truncate text-sm">{contact.name}</span>
      <span className="text-xs text-slate-400">{roleName(contact.role)}</span>
    </button>
  )
}

function ChatBubble({ currentUserId, message }: { currentUserId: string; message: ChatMessage }) {
  const mine = message.senderId === currentUserId

  return (
    <div className={`flex gap-3 ${mine ? 'justify-end' : ''}`}>
      {!mine && <MessageAvatar sender={message.sender} />}
      <div className="max-w-[78%]">
        <p className={`mb-1 text-xs text-slate-400 ${mine ? 'text-right' : ''}`}>{message.sender.name} · {formatTime(message.createdAt)}</p>
        <p className={`rounded-md px-4 py-3 text-[15px] leading-7 ${mine ? 'bg-brand-600 text-white' : 'bg-[var(--app-panel-muted-bg)] text-slate-700 dark:bg-white/[0.06] dark:text-slate-300'}`}>{message.content}</p>
      </div>
      {mine && <MessageAvatar sender={message.sender} />}
    </div>
  )
}

function MessageAvatar({ sender }: { sender: ChatContact }) {
  if (sender.avatarUrl) {
    return <img alt={`${sender.name}头像`} className="h-11 w-11 shrink-0 rounded-full object-cover" src={sender.avatarUrl} />
  }

  return <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm text-white">{sender.name.slice(0, 1)}</span>
}

function EmptyDetail() {
  return <div className="flex flex-1 items-center justify-center text-sm text-slate-400">选择一条信息查看内容</div>
}

function defaultSelection(channels: NotificationChannel[], conversations: ChatConversation[]): Selection | null {
  if (channels[0]) return { id: channels[0].id, kind: 'notification' }
  if (conversations[0]) return { id: conversations[0].id, kind: 'chat' }
  return null
}

function chatPreview(conversation: ChatConversation) {
  if (conversation.type === 'GLOBAL') return '全体人员交流'
  if (conversation.type === 'GROUP') return '群组对话'
  return '开始聊天'
}

function conversationMeta(conversation: ChatConversation) {
  if (conversation.type === 'GROUP') return `${conversation.members.length} 名成员`
  if (conversation.type === 'GLOBAL') return '全体人员'
  return conversation.accepted ? '已建立对话' : `对方回复前可再发 ${conversation.strangerRemaining ?? 0} 条`
}

function composerPlaceholder(conversation: ChatConversation, disabled: boolean) {
  if (!disabled) return '输入消息，Enter 发送'
  return conversation.strangerRemaining === 0 ? '对方回复后可继续发送' : '会话已关闭'
}

function roleName(role: ChatContact['role']) {
  if (role === 'ADMIN') return '管理员'
  if (role === 'AUDITOR') return '审核员'
  return '用户'
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function messageOf(error: unknown) {
  return error instanceof ApiError || error instanceof Error ? error.message : '操作失败，请稍后重试'
}
