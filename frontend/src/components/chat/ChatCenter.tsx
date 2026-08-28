import { Archive, Bell, ChevronLeft, Download, LockKeyhole, MessageCirclePlus, Send, Settings2, ShieldAlert, UsersRound, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getSavedSession } from '../../services/auth'
import { ApiError } from '../../services/apiClient'
import { addSensitiveWord, closeChatConversation, createDirectConversation, createGroupConversation, downloadChatExport, executeChatCleanup, getChatBootstrap, getChatMessages, getChatMessagesAfter, getChatStorage, getSensitiveWords, markChatRead, previewChatCleanup, removeSensitiveWord, searchChatContact, sendChatMessage } from '../../services/chat'
import type { ChatContact, ChatConversation, ChatMessage } from '../../services/chat'
import { useChatSocket } from '../../hooks/useChatSocket'
import { AlertMessage } from '../ui/AlertMessage'

export function ChatCenter({ onBackToNotifications }: { onBackToNotifications?: () => void }) {
  const session = getSavedSession()
  const currentUser = session?.user
  const isAdmin = currentUser?.role === 'admin'
  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [staff, setStaff] = useState<ChatContact[]>([])
  const [activeId, setActiveId] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [restriction, setRestriction] = useState<{ expiresAt: string | null; reason: string } | null>(null)
  const [contactOpen, setContactOpen] = useState(false)
  const [groupOpen, setGroupOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const messagesRef = useRef<ChatMessage[]>([])

  function replaceMessages(next: ChatMessage[]) {
    messagesRef.current = next
    setMessages(next)
    return next
  }

  function appendMessages(incoming: ChatMessage[]) {
    const known = new Set(messagesRef.current.map((message) => message.id))
    const next = [...messagesRef.current, ...incoming.filter((message) => !known.has(message.id))]
    messagesRef.current = next
    setMessages(next)
    return next
  }

  const load = useCallback(async (preserveActive = true) => {
    const data = await getChatBootstrap()
    setConversations(data.conversations)
    setStaff(data.staff)
    setRestriction(data.restriction)
    setActiveId((previous) => preserveActive && data.conversations.some((item) => item.id === previous) ? previous : data.conversations[0]?.id ?? '')
  }, [])

  useEffect(() => { void load().catch((reason: unknown) => { setError(messageOf(reason)); setLoading(false) }).finally(() => setLoading(false)) }, [load])

  const handleSocket = useCallback((_event: string, payload: unknown) => {
    if (_event === 'message.created') {
      const value = payload as { conversationId?: string; message?: ChatMessage }
      if (value.conversationId === activeId && value.message) {
        appendMessages([value.message])
        if (value.message.senderId !== currentUser?.id && document.visibilityState === 'visible') {
          void markChatRead(activeId, value.message.id).then(() => load(true)).catch(() => {})
        }
      }
    }
    if (_event === 'chat.connection.restored' && activeId) {
      const latestKnown = messagesRef.current.at(-1)
      const request = latestKnown ? getChatMessagesAfter(activeId, latestKnown.id) : getChatMessages(activeId).then((data) => data.messages)
      void request.then((recovered) => {
        const next = latestKnown ? appendMessages(recovered) : replaceMessages(recovered)
        const latest = next.at(-1)
        if (latest && document.visibilityState === 'visible') return markChatRead(activeId, latest.id)
        return undefined
      }).catch(() => getChatMessages(activeId).then((data) => replaceMessages(data.messages)).catch(() => {}))
    }
    if (_event === 'chat.restrictionChanged') {
      const value = payload as { disabled?: boolean; expiresAt?: string | null; reason?: string }
      setRestriction(value.disabled ? { expiresAt: value.expiresAt ?? null, reason: value.reason ?? '管理员已限制聊天功能' } : null)
    }
    void load(true).catch(() => {})
  }, [activeId, currentUser?.id, load])
  useChatSocket(handleSocket)

  const active = conversations.find((item) => item.id === activeId) ?? null
  useEffect(() => {
    if (!activeId) { replaceMessages([]); return }
    replaceMessages([])
    getChatMessages(activeId).then((data) => {
      replaceMessages(data.messages)
      const latest = data.messages.at(-1)
      if (latest) void markChatRead(activeId, latest.id).catch(() => {})
    }).catch((reason: unknown) => setError(messageOf(reason)))
  }, [activeId])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => {
    if (!activeId) return
    const markVisibleMessagesRead = () => {
      if (document.visibilityState !== 'visible') return
      const latest = messages.at(-1)
      if (latest) void markChatRead(activeId, latest.id).then(() => load(true)).catch(() => {})
    }
    document.addEventListener('visibilitychange', markVisibleMessagesRead)
    window.addEventListener('focus', markVisibleMessagesRead)
    return () => {
      document.removeEventListener('visibilitychange', markVisibleMessagesRead)
      window.removeEventListener('focus', markVisibleMessagesRead)
    }
  }, [activeId, load, messages])

  const totalUnread = useMemo(() => conversations.reduce((total, item) => total + item.unread, 0), [conversations])
  async function chooseConversation(id: string) { setActiveId(id) }
  async function send(content: string) {
    if (!active || sending || restriction) return
    if (active.strangerRemaining === 3 && !active.accepted && !window.confirm('对方回复前最多发送 3 条消息；未回复时额度不会按天恢复。')) return
    setSending(true)
    try {
      const result = await sendChatMessage(active.id, content, crypto.randomUUID())
      if (result.blocked) throw new Error('消息包含敏感词，已被拦截')
      if (result.message) appendMessages([result.message])
      await load(true)
    } catch (reason) { setError(messageOf(reason)) } finally { setSending(false) }
  }
  async function createDirect(contact: ChatContact) {
    try { const conversation = await createDirectConversation(contact.id); setContactOpen(false); setActiveId(conversation.id); await load(true) } catch (reason) { setError(messageOf(reason)) }
  }
  async function createGroup(title: string, members: ChatContact[]) {
    try { const conversation = await createGroupConversation(title, members.map((item) => item.id)); setGroupOpen(false); setActiveId(conversation.id); await load(true) } catch (reason) { setError(messageOf(reason)) }
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-black/10 px-4 dark:border-white/10">
        {onBackToNotifications && <button aria-label="返回通知" className="rounded-md p-1.5 text-slate-500 transition hover:bg-black/5 hover:text-slate-900 dark:hover:bg-white/10 dark:hover:text-white" onClick={onBackToNotifications} type="button"><ChevronLeft className="h-4 w-4" /></button>}
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-600 text-white"><Bell className="h-4 w-4" /></div>
        <div className="min-w-0"><p className="text-sm font-semibold">消息</p><p className="text-[11px] text-slate-400 dark:text-slate-500">安全审计已启用</p></div>
        <div className="ml-auto flex items-center gap-1">
          {totalUnread > 0 && <span className="mr-2 rounded-full bg-brand-600/10 px-2 py-0.5 text-xs font-medium text-brand-700 dark:text-brand-300">{totalUnread} 未读</span>}
          {isAdmin && <IconButton label="聊天管理" onClick={() => setAdminOpen(true)}><Settings2 className="h-4 w-4" /></IconButton>}
          {isAdmin && <IconButton label="新建群聊" onClick={() => setGroupOpen(true)}><UsersRound className="h-4 w-4" /></IconButton>}
          <IconButton label="发起聊天" onClick={() => setContactOpen(true)}><MessageCirclePlus className="h-4 w-4" /></IconButton>
        </div>
      </div>
      {error && <AlertMessage message={error} onClose={() => setError('')} variant="error" />}
      {restriction && <div className="flex shrink-0 items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200"><LockKeyhole className="h-3.5 w-3.5" /><span>聊天已限制：{restriction.reason}{restriction.expiresAt ? `，至 ${formatDateTime(restriction.expiresAt)}` : ''}</span></div>}
      <div className="flex min-h-0 flex-1">
        <aside className={`w-[272px] shrink-0 border-r border-black/10 dark:border-white/10 ${active ? 'hidden md:flex' : 'flex'} flex-col`}>
          <div className="border-b border-black/10 px-4 py-3 dark:border-white/10"><p className="text-xs font-medium text-slate-500 dark:text-slate-400">会话</p></div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {loading && <p className="px-3 py-8 text-center text-xs text-slate-400">加载消息中…</p>}
            {!loading && conversations.map((item) => <ConversationRow active={item.id === activeId} conversation={item} key={item.id} onClick={() => void chooseConversation(item.id)} />)}
          </div>
        </aside>
        <main className={`min-w-0 flex-1 flex-col ${active ? 'flex' : 'hidden md:flex'}`}>
          {active ? <>
            <div className="flex h-14 shrink-0 items-center gap-3 border-b border-black/10 px-4 dark:border-white/10">
              <button aria-label="返回会话列表" className="rounded-md p-1.5 text-slate-500 md:hidden" onClick={() => setActiveId('')} type="button"><ChevronLeft className="h-4 w-4" /></button>
              <Avatar name={active.title} url={active.avatarUrl} type={active.type} />
              <div className="min-w-0"><p className="truncate text-sm font-semibold">{active.title}</p><p className="text-[11px] text-slate-400">{active.type === 'GLOBAL' ? '全体人员' : active.type === 'GROUP' ? `${active.members.length} 名成员` : active.accepted ? '已建立会话' : `对方回复前可再发 ${active.strangerRemaining ?? 0} 条`}</p></div>
              {active.status !== 'OPEN' && <span className="ml-auto text-xs text-red-500">会话已关闭</span>}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto bg-[linear-gradient(180deg,transparent,rgba(var(--app-primary-rgb),0.025))] px-4 py-5 dark:bg-none">
              <div className="mx-auto max-w-3xl space-y-3">
                {messages.length === 0 && <EmptyChat />}
                {messages.map((message, index) => <MessageBubble currentUserId={currentUser?.id ?? ''} key={message.id} message={message} otherReadAt={active.otherReadAt} showDate={index === 0 || !sameDay(messages[index - 1].createdAt, message.createdAt)} />)}
                <div ref={bottomRef} />
              </div>
            </div>
            <Composer disabled={Boolean(restriction) || !active.canSend || active.status !== 'OPEN'} hint={restriction ? '聊天功能已被管理员限制' : active.status !== 'OPEN' ? active.closedReason ?? '会话已关闭' : active.strangerRemaining === 0 ? '对方回复后可继续发送' : active.strangerRemaining !== null ? `对方回复前还可发送 ${active.strangerRemaining} 条` : '仅支持文字消息'} onSend={send} sending={sending} />
          </> : <EmptyChat />}
        </main>
      </div>
      {contactOpen && <ContactDialog onClose={() => setContactOpen(false)} onSelect={createDirect} staff={staff} />}
      {groupOpen && <GroupDialog onClose={() => setGroupOpen(false)} onCreate={createGroup} staff={staff} />}
      {adminOpen && <AdminDrawer active={active} onClose={() => setAdminOpen(false)} onRefresh={() => void load(true)} />}
    </div>
  )
}

function ConversationRow({ active, conversation, onClick }: { active: boolean; conversation: ChatConversation; onClick: () => void }) {
  return <button className={`flex w-full items-center gap-3 rounded-md px-3 py-3 text-left transition ${active ? 'bg-brand-600/10' : 'hover:bg-black/[0.045] dark:hover:bg-white/[0.05]'}`} onClick={onClick} type="button"><Avatar name={conversation.title} url={conversation.avatarUrl} type={conversation.type} /><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className={`min-w-0 flex-1 truncate text-sm ${active ? 'font-semibold text-brand-700 dark:text-brand-300' : 'font-medium'}`}>{conversation.title}</span>{conversation.unread > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-semibold text-white">{conversation.unread > 99 ? '99+' : conversation.unread}</span>}</div><p className={`mt-0.5 truncate text-xs ${conversation.unread ? 'font-medium text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500'}`}>{conversation.lastMessage?.content ?? '暂无消息'}</p></div></button>
}
function Avatar({ name, url, type }: { name: string; url: string | null; type: ChatConversation['type'] }) { return url ? <img alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" src={url} /> : <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${type === 'GLOBAL' ? 'bg-amber-500 text-white' : type === 'GROUP' ? 'bg-slate-700 text-white dark:bg-slate-500' : 'bg-brand-600 text-white'}`}>{type === 'GLOBAL' ? '全' : type === 'GROUP' ? '群' : name.slice(0, 1)}</span> }
function IconButton({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) { return <button aria-label={label} className="rounded-md p-2 text-slate-500 transition hover:bg-brand-600/10 hover:text-brand-700 dark:hover:text-brand-300" onClick={onClick} title={label} type="button">{children}</button> }
function EmptyChat() { return <div className="flex h-full min-h-52 flex-col items-center justify-center px-6 text-center"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-600/10 text-brand-700 dark:text-brand-300"><Bell className="h-5 w-5" /></div><p className="mt-3 text-sm font-medium">选择会话开始交流</p><p className="mt-1 text-xs leading-5 text-slate-400">平台聊天受安全审计，管理员可按管理规则查看记录。</p></div> }
function MessageBubble({ currentUserId, message, otherReadAt, showDate }: { currentUserId: string; message: ChatMessage; otherReadAt: string | null; showDate: boolean }) { const mine = message.senderId === currentUserId; const read = mine && otherReadAt && new Date(otherReadAt) >= new Date(message.createdAt); return <>{showDate && <div className="py-3 text-center text-[11px] text-slate-400">{formatDate(message.createdAt)}</div>}<div className={`flex gap-2.5 ${mine ? 'justify-end' : ''}`}><>{!mine && <Avatar name={message.sender.name} url={message.sender.avatarUrl} type="DIRECT" />}</><div className={`max-w-[78%] ${mine ? 'items-end' : ''}`}><div className={`mb-1 flex gap-2 text-[11px] text-slate-400 ${mine ? 'justify-end' : ''}`}><span>{message.sender.name}</span><span>{formatTime(message.createdAt)}</span>{read && <span className="text-brand-700 dark:text-brand-300">已读</span>}</div><div className={`rounded-lg px-3.5 py-2.5 text-sm leading-6 ${mine ? 'rounded-tr-sm bg-brand-600 text-white shadow-sm' : 'rounded-tl-sm bg-black/[0.045] text-slate-700 dark:bg-white/[0.075] dark:text-slate-200'}`}>{message.content}</div></div></div></> }
function Composer({ disabled, hint, onSend, sending }: { disabled: boolean; hint: string; onSend: (content: string) => Promise<void>; sending: boolean }) { const [value, setValue] = useState(''); async function submit() { const content = value.trim(); if (!content || disabled) return; setValue(''); await onSend(content) } return <div className="shrink-0 border-t border-black/10 bg-[var(--app-panel-bg)] px-4 py-3 dark:border-white/10"><div className="flex items-end gap-2"><textarea className="min-h-10 max-h-28 flex-1 resize-none rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm leading-5 outline-none transition placeholder:text-slate-400 focus:border-brand-600/50 focus:ring-2 focus:ring-brand-600/10 disabled:cursor-not-allowed disabled:bg-black/[0.025] dark:border-white/10 dark:disabled:bg-white/[0.03]" disabled={disabled || sending} maxLength={2000} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void submit() } }} placeholder={disabled ? hint : '输入消息，Enter 发送'} value={value} /><button aria-label="发送" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-600 text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-white/15" disabled={disabled || sending || !value.trim()} onClick={() => void submit()} type="button"><Send className="h-4 w-4" /></button></div><p className="mt-1.5 text-[11px] text-slate-400">{hint}</p></div> }

function ContactDialog({ onClose, onSelect, staff }: { onClose: () => void; onSelect: (contact: ChatContact) => void; staff: ChatContact[] }) { const [code, setCode] = useState(''); const [result, setResult] = useState<ChatContact | null>(null); const [error, setError] = useState(''); async function search() { try { setError(''); setResult(await searchChatContact(code.trim())) } catch (reason) { setResult(null); setError(messageOf(reason)) } } return <Modal title="发起聊天" onClose={onClose}><p className="mb-3 text-xs text-slate-500">管理员与审核员可直接联系；其他用户需输入完整统一认证码。</p><div className="mb-4 flex gap-2"><input className="min-w-0 flex-1 rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-600/50 dark:border-white/10" onChange={(event) => setCode(event.target.value)} placeholder="统一认证码" value={code} /><button className="rounded-md border border-brand-600/25 px-3 text-sm text-brand-700 hover:bg-brand-600/10 dark:text-brand-300" onClick={() => void search()} type="button">查找</button></div>{error && <p className="mb-3 text-xs text-red-500">{error}</p>}{result && <ContactRow contact={result} onClick={() => onSelect(result)} />}<p className="mb-2 text-xs font-medium text-slate-500">管理员与审核员</p><div className="max-h-64 space-y-1 overflow-y-auto">{staff.map((contact) => <ContactRow contact={contact} key={contact.id} onClick={() => onSelect(contact)} />)}</div></Modal> }
function GroupDialog({ onClose, onCreate, staff }: { onClose: () => void; onCreate: (title: string, contacts: ChatContact[]) => void; staff: ChatContact[] }) { const [title, setTitle] = useState(''); const [selected, setSelected] = useState<ChatContact[]>([]); return <Modal title="新建群聊" onClose={onClose}><input className="mb-4 w-full rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-600/50 dark:border-white/10" maxLength={40} onChange={(event) => setTitle(event.target.value)} placeholder="群名称" value={title} /><p className="mb-2 text-xs text-slate-500">先选择成员。可在创建后继续添加，普通群最多 200 人。</p><div className="max-h-64 space-y-1 overflow-y-auto">{staff.map((contact) => { const chosen = selected.some((item) => item.id === contact.id); return <button className={`flex w-full items-center gap-3 rounded-md px-2 py-2 text-left ${chosen ? 'bg-brand-600/10 text-brand-700 dark:text-brand-300' : 'hover:bg-black/5 dark:hover:bg-white/5'}`} key={contact.id} onClick={() => setSelected((items) => chosen ? items.filter((item) => item.id !== contact.id) : [...items, contact])} type="button"><Avatar name={contact.name} url={contact.avatarUrl} type="DIRECT" /><span className="text-sm">{contact.name}</span></button> })}</div><button className="mt-4 w-full rounded-md bg-brand-600 px-3 py-2.5 text-sm font-medium text-white disabled:bg-slate-300" disabled={title.trim().length < 2} onClick={() => onCreate(title.trim(), selected)} type="button">创建群聊</button></Modal> }
function ContactRow({ contact, onClick }: { contact: ChatContact; onClick: () => void }) { return <button className="flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-left transition hover:bg-brand-600/10" onClick={onClick} type="button"><Avatar name={contact.name} url={contact.avatarUrl} type="DIRECT" /><div className="min-w-0"><p className="truncate text-sm font-medium">{contact.name}</p><p className="text-xs text-slate-400">{roleLabel(contact.role)}{contact.college ? ` · ${contact.college}` : ''}</p></div></button> }
function AdminDrawer({ active, onClose, onRefresh }: { active: ChatConversation | null; onClose: () => void; onRefresh: () => void }) { const [storage, setStorage] = useState<{ chatBytes: number; databaseBytes: number; quotaBytes: number; usagePercent: number; warning: boolean } | null>(null); const [words, setWords] = useState<Array<{ id: string; term: string; active: boolean }>>([]); const [term, setTerm] = useState(''); const [cutoff, setCutoff] = useState(''); const [error, setError] = useState(''); const reload = useCallback(() => { void Promise.all([getChatStorage(), getSensitiveWords()]).then(([nextStorage, nextWords]) => { setStorage(nextStorage); setWords(nextWords) }).catch((reason) => setError(messageOf(reason))) }, []); useEffect(reload, [reload]); async function clean() { try { const preview = await previewChatCleanup(new Date(`${cutoff}T00:00:00`).toISOString()); if (!window.confirm(`将删除 ${preview.count} 条历史消息，无法撤销。`)) return; const result = await executeChatCleanup(preview.before, preview.confirmationToken); setError(`已删除 ${result.deleted} 条记录`); onRefresh(); reload() } catch (reason) { setError(messageOf(reason)) } } return <div className="absolute inset-0 z-30 flex justify-end bg-black/20 backdrop-blur-sm"><aside className="flex h-full w-full max-w-md flex-col border-l border-black/10 bg-[var(--app-panel-bg)] shadow-2xl dark:border-white/10"><div className="flex h-14 items-center border-b border-black/10 px-4 dark:border-white/10"><ShieldAlert className="mr-2 h-4 w-4 text-brand-700 dark:text-brand-300" /><span className="text-sm font-semibold">聊天管理</span><button className="ml-auto rounded-md p-2 hover:bg-black/5 dark:hover:bg-white/10" onClick={onClose} type="button"><X className="h-4 w-4" /></button></div><div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4">{error && <AlertMessage message={error} onClose={() => setError('')} variant={error.startsWith('已删除') ? 'success' : 'error'} />}<section><p className="text-xs font-medium text-slate-500">当前会话</p><p className="mt-1 text-sm font-medium">{active?.title ?? '未选择会话'}</p>{active?.status === 'OPEN' && active.type !== 'GLOBAL' && <button className="mt-2 inline-flex items-center gap-2 rounded-md border border-red-500/25 px-3 py-2 text-xs text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10" onClick={() => { const reason = window.prompt('关闭原因'); if (reason) void closeChatConversation(active.id, reason).then(onRefresh).catch((reason) => setError(messageOf(reason))) }} type="button"><LockKeyhole className="h-3.5 w-3.5" />关闭会话</button>}</section><section><div className="flex items-center justify-between"><p className="text-xs font-medium text-slate-500">敏感词</p><span className="text-xs text-slate-400">{words.length} 条</span></div><div className="mt-2 flex gap-2"><input className="min-w-0 flex-1 rounded-md border border-black/10 bg-transparent px-2.5 py-2 text-xs outline-none dark:border-white/10" onChange={(event) => setTerm(event.target.value)} placeholder="新增敏感词" value={term} /><button className="rounded-md bg-brand-600 px-3 text-xs text-white" onClick={() => { if (term.trim()) void addSensitiveWord(term.trim()).then(() => { setTerm(''); reload() }).catch((reason) => setError(messageOf(reason))) }} type="button">添加</button></div><div className="mt-2 flex flex-wrap gap-1.5">{words.map((word) => <span className="inline-flex items-center gap-1 rounded-full bg-black/5 px-2 py-1 text-xs dark:bg-white/10" key={word.id}>{word.term}<button aria-label="删除敏感词" className="text-slate-400 hover:text-red-500" onClick={() => void removeSensitiveWord(word.id).then(reload).catch((reason) => setError(messageOf(reason)))} type="button"><X className="h-3 w-3" /></button></span>)}</div></section><section><p className="text-xs font-medium text-slate-500">数据库容量</p>{storage ? <><div className="mt-2 h-2 overflow-hidden rounded-full bg-black/5 dark:bg-white/10"><div className={`h-full ${storage.warning ? 'bg-amber-500' : 'bg-brand-600'}`} style={{ width: `${Math.min(100, storage.usagePercent)}%` }} /></div><p className="mt-2 text-xs text-slate-500">总库 {formatBytes(storage.databaseBytes)} / {formatBytes(storage.quotaBytes)} · 聊天 {formatBytes(storage.chatBytes)} · {storage.usagePercent}%</p></> : <p className="mt-2 text-xs text-slate-400">读取中…</p>}</section><section><p className="text-xs font-medium text-slate-500">记录清理</p><input className="mt-2 w-full rounded-md border border-black/10 bg-transparent px-2.5 py-2 text-xs dark:border-white/10" onChange={(event) => setCutoff(event.target.value)} type="date" value={cutoff} /><div className="mt-2 flex gap-2"><button className="inline-flex items-center gap-1 rounded-md border border-black/10 px-3 py-2 text-xs disabled:opacity-40 dark:border-white/10" disabled={!cutoff} onClick={() => void downloadChatExport(new Date(`${cutoff}T00:00:00`).toISOString()).catch((reason) => setError(messageOf(reason)))} type="button"><Download className="h-3.5 w-3.5" />导出</button><button className="inline-flex items-center gap-1 rounded-md border border-red-500/25 px-3 py-2 text-xs text-red-600 disabled:opacity-40 dark:text-red-300" disabled={!cutoff} onClick={() => void clean()} type="button"><Archive className="h-3.5 w-3.5" />清理</button></div></section></div></aside></div> }
function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) { return <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-lg border border-black/10 bg-[var(--app-panel-bg)] shadow-2xl dark:border-white/10"><div className="flex items-center border-b border-black/10 px-4 py-3 dark:border-white/10"><span className="text-sm font-semibold">{title}</span><button className="ml-auto rounded-md p-1.5 hover:bg-black/5 dark:hover:bg-white/10" onClick={onClose} type="button"><X className="h-4 w-4" /></button></div><div className="p-4">{children}</div></div></div> }
function sameDay(a: string, b: string) { return new Date(a).toDateString() === new Date(b).toDateString() }
function formatDate(value: string) { return new Date(value).toLocaleDateString('zh-CN', { day: 'numeric', month: 'long', year: 'numeric' }) }
function formatDateTime(value: string) { return new Date(value).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit', month: 'numeric', day: 'numeric' }) }
function formatTime(value: string) { return new Date(value).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }) }
function roleLabel(role: ChatContact['role']) { return role === 'ADMIN' ? '管理员' : role === 'AUDITOR' ? '审核员' : '用户' }
function formatBytes(bytes: number) { if (bytes < 1024 * 1024) return `${Math.max(0, Math.round(bytes / 1024))} KB`; return `${(bytes / 1024 / 1024).toFixed(bytes > 1024 * 1024 * 1024 ? 0 : 1)} ${bytes > 1024 * 1024 * 1024 ? 'GB' : 'MB'}` }
function messageOf(error: unknown) { return error instanceof ApiError || error instanceof Error ? error.message : '操作失败，请稍后重试' }
