import { ArrowUp, Bot, Paperclip, Sparkles, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { getAccountProfile } from '../../services/account'
import { getSavedSession } from '../../services/auth'
import { getAiAppearance, getAiQuota, sendAiChat, type AiQuota } from '../../services/ai'

type ChatMessage = {
  content: string
  role: 'assistant' | 'user'
}

type UserAIAssistantProps = {
  initialPrompt?: string | null
  onInitialPromptConsumed?: () => void
}

const MAX_STORED_MESSAGES = 80

export function UserAIAssistant({ initialPrompt, onInitialPromptConsumed }: UserAIAssistantProps = {}) {
  const storageKeyRef = useRef(getConversationStorageKey())
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadStoredMessages(storageKeyRef.current))
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null)
  const [userName, setUserName] = useState('我')
  const [aiAvatarUrl, setAiAvatarUrl] = useState<string | null>(null)
  const [aiQuota, setAiQuota] = useState<AiQuota | null>(null)
  const [dismissedQuotaWarning, setDismissedQuotaWarning] = useState<'20' | '5' | null>(null)
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null)
  const dockedInputRef = useRef<HTMLDivElement | null>(null)
  const consumedInitialPromptRef = useRef<string | null>(null)
  const [bottomInset, setBottomInset] = useState(156)
  const hasStarted = messages.length > 0

  useEffect(() => {
    let active = true

    Promise.allSettled([getAccountProfile(), getAiAppearance(), getAiQuota()]).then(([profileResult, appearanceResult, quotaResult]) => {
      if (!active) return

      if (profileResult.status === 'fulfilled') {
        setUserAvatarUrl(profileResult.value.account.avatarUrl ?? null)
        setUserName(profileResult.value.account.name || '我')
      }

      if (appearanceResult.status === 'fulfilled') {
        setAiAvatarUrl(appearanceResult.value.avatarUrl ?? null)
      }

      if (quotaResult.status === 'fulfilled') {
        setAiQuota(quotaResult.value)
      }
    })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, sending])

  useEffect(() => {
    saveStoredMessages(storageKeyRef.current, messages)
  }, [messages])

  useEffect(() => {
    const content = initialPrompt?.trim()
    if (!content || consumedInitialPromptRef.current === content) return

    consumedInitialPromptRef.current = content
    setInput('')
    onInitialPromptConsumed?.()
    void sendMessage(content)
  }, [initialPrompt])

  useEffect(() => {
    if (!hasStarted || !dockedInputRef.current) return

    const updateBottomInset = () => {
      const height = dockedInputRef.current?.getBoundingClientRect().height ?? 132
      setBottomInset(Math.ceil(height + 28))
    }

    updateBottomInset()
    const observer = new ResizeObserver(updateBottomInset)
    observer.observe(dockedInputRef.current)

    return () => observer.disconnect()
  }, [hasStarted])

  const sendMessage = async (overrideContent?: string) => {
    const content = (overrideContent ?? input).trim()
    if (!content || sending) return

    setMessages((current) => [...current, { role: 'user', content }])
    setInput('')
    setSending(true)

    try {
      const result = await sendAiChat(content)
      if (result.quota) setAiQuota(result.quota)
      setMessages((current) => [...current, { role: 'assistant', content: result.content || formatAiResponse(result.response) }])
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: error instanceof Error ? error.message : 'AI 助手暂时不可用，请稍后再试。',
        },
      ])
    } finally {
      setSending(false)
    }
  }

  const inputBox = (
    <div className="mx-auto w-full">
      <QuotaWarning
        dismissed={dismissedQuotaWarning}
        quota={aiQuota}
        onDismiss={setDismissedQuotaWarning}
      />
      <motion.div
        className="w-full rounded-lg border border-black/10 bg-[#f7f9f7]/90 p-2 shadow-xl shadow-black/5 backdrop-blur-xl dark:border-white/10 dark:bg-[#0f1511]/90 dark:shadow-black/25"
        layoutId="ai-assistant-input"
        transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex items-center gap-2">
          <button
            aria-label="上传附件"
            className="rounded-lg p-2 text-slate-500 transition hover:bg-black/5 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
            type="button"
          >
            <Paperclip className="h-5 w-5" />
          </button>
          <textarea
            className="h-12 max-h-40 min-h-12 flex-1 resize-none bg-transparent px-2 py-3 text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-white/30"
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void sendMessage()
              }
            }}
            placeholder="询问漏洞报告、复现步骤、修复建议或学习路径"
            rows={1}
            value={input}
          />
          <button
            aria-label="发送"
            className="rounded-lg bg-brand-600 p-2 text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-white/15"
            disabled={!input.trim() || sending || aiQuota?.enabled === false || aiQuota?.remaining === 0}
            onClick={() => void sendMessage()}
            type="button"
          >
            <ArrowUp className="h-5 w-5" />
          </button>
        </div>
      </motion.div>
    </div>
  )

  return (
    <section
      className={`relative z-10 mx-auto flex min-h-screen max-w-[980px] flex-col px-5 pb-6 md:px-8 ${
        hasStarted ? 'pt-24' : 'pt-16'
      }`}
    >
      <AnimatePresence mode="wait">
        {!hasStarted && (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-1 flex-col items-center justify-center pb-10 text-center"
            exit={{ opacity: 0, y: -18, transition: { duration: 0.28, ease: 'easeOut' } }}
            initial={{ opacity: 0, y: 18 }}
            key="ai-empty"
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-brand-700 dark:text-green-300">
              <Sparkles className="h-3.5 w-3.5" />
              AI Assistant
            </p>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">CQUPT-SRC AI 助手</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500 dark:text-slate-400">
              面向漏洞报告、复现材料、修复建议和学习路径的智能辅助入口。
            </p>
            <div className="mt-8 w-full max-w-[760px]">{inputBox}</div>
            <p className="mt-3 text-xs text-slate-400">AI 回复仅作辅助，漏洞提交与安全测试仍需人工核实并遵守授权边界。</p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {hasStarted && (
          <>
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 space-y-5 overflow-y-auto"
            initial={{ opacity: 0, y: 18 }}
            key="ai-chat"
            style={{ paddingBottom: bottomInset }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            {messages.map((message, index) => {
              const isUser = message.role === 'user'
              return (
                <motion.div
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                  initial={{ opacity: 0, y: 12 }}
                  key={`${message.role}-${index}`}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                >
                  {!isUser && <AssistantAvatar avatarUrl={aiAvatarUrl} />}
                  <div
                    className={`max-w-[760px] whitespace-pre-wrap rounded-lg px-4 py-3 text-sm leading-7 shadow-sm ${
                      isUser
                        ? 'bg-brand-600 text-white'
                        : 'border border-black/10 bg-white/70 text-slate-700 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200'
                    }`}
                  >
                    {message.content}
                  </div>
                  {isUser && <UserChatAvatar avatarUrl={userAvatarUrl} name={userName} />}
                </motion.div>
              )
            })}
            {sending && (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-3 justify-start"
                initial={{ opacity: 0, y: 12 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
              >
                <AssistantAvatar avatarUrl={aiAvatarUrl} thinking />
                <div className="rounded-lg border border-black/10 bg-white/70 px-4 py-3 text-sm leading-7 text-slate-500 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
                  <TypingIndicator />
                </div>
              </motion.div>
            )}
            <div ref={scrollAnchorRef} style={{ scrollMarginBottom: bottomInset }} />
          </motion.div>

          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[980px] px-5 pb-6 md:px-8"
            initial={{ opacity: 0, y: 28 }}
            key="ai-docked-input"
            ref={dockedInputRef}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            {inputBox}
            <p className="mt-2 text-center text-xs text-slate-400">AI 回复仅作辅助，漏洞提交与安全测试仍需人工核实并遵守授权边界。</p>
          </motion.div>
          </>
        )}
      </AnimatePresence>
    </section>
  )
}

function AssistantAvatar({ avatarUrl, thinking = false }: { avatarUrl: string | null; thinking?: boolean }) {
  return (
    <motion.div
      animate={thinking ? { scale: [1, 1.04, 1] } : { scale: 1 }}
      className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-600 text-white shadow-sm ring-1 ring-brand-600/20"
      transition={thinking ? { duration: 1.2, ease: 'easeInOut', repeat: Infinity } : undefined}
    >
      {avatarUrl ? (
        <img alt="AI 助手头像" className="h-full w-full object-cover" src={avatarUrl} />
      ) : (
        <Bot className="h-5 w-5" />
      )}
    </motion.div>
  )
}

function UserChatAvatar({ avatarUrl, name }: { avatarUrl: string | null; name: string }) {
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-black/10 bg-white/80 text-base font-semibold text-slate-600 shadow-sm dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300">
      {avatarUrl ? (
        <img alt={`${name}的头像`} className="h-full w-full object-cover" src={avatarUrl} />
      ) : (
        <span>{name.trim().slice(0, 1).toUpperCase() || '我'}</span>
      )}
    </div>
  )
}

function TypingIndicator() {
  return (
    <span className="inline-flex items-center gap-1.5 align-middle" aria-label="正在思考">
      {[0, 1, 2].map((index) => (
        <motion.span
          animate={{ opacity: [0.35, 1, 0.35], y: [0, -3, 0] }}
          className="h-1.5 w-1.5 rounded-full bg-slate-400 dark:bg-slate-300"
          key={index}
          transition={{ delay: index * 0.14, duration: 0.8, ease: 'easeInOut', repeat: Infinity }}
        />
      ))}
    </span>
  )
}

function QuotaWarning({
  dismissed,
  onDismiss,
  quota,
}: {
  dismissed: '20' | '5' | null
  onDismiss: (level: '20' | '5') => void
  quota: AiQuota | null
}) {
  if (!quota || quota.monthlyLimit <= 0) return null

  const remainingPercent = (quota.remaining / quota.monthlyLimit) * 100
  const level: '20' | '5' | null = remainingPercent <= 5 ? '5' : remainingPercent <= 20 ? '20' : null
  if (!level || dismissed === level) return null
  if (level === '20' && dismissed === '5') return null

  const danger = level === '5'
  return (
    <div className={`mb-3 flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm shadow-sm ${
      danger
        ? 'border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300'
        : 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300'
    }`}>
      <div>
        <p className="font-medium">{danger ? 'AI token 额度即将用尽' : 'AI token 额度低于 20%'}</p>
        <p className="mt-1 text-xs opacity-80">
          本月剩余 {formatNumber(quota.remaining)} / {formatNumber(quota.monthlyLimit)} tokens，额度不足时将无法继续对话。
        </p>
      </div>
      <button
        aria-label="关闭额度提醒"
        className="rounded-md p-1 opacity-70 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
        onClick={() => onDismiss(level)}
        type="button"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

function getConversationStorageKey() {
  const session = getSavedSession()
  const userKey = session?.user.id ?? session?.user.unifiedCode ?? 'anonymous'
  return `cqupt-src-ai-conversation:${userKey}`
}

function loadStoredMessages(storageKey: string): ChatMessage[] {
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return []

    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter((item): item is ChatMessage => {
        if (!item || typeof item !== 'object') return false
        const message = item as Partial<ChatMessage>
        return (message.role === 'assistant' || message.role === 'user') && typeof message.content === 'string'
      })
      .slice(-MAX_STORED_MESSAGES)
  } catch {
    return []
  }
}

function saveStoredMessages(storageKey: string, messages: ChatMessage[]) {
  try {
    if (messages.length === 0) {
      window.localStorage.removeItem(storageKey)
      return
    }

    window.localStorage.setItem(storageKey, JSON.stringify(messages.slice(-MAX_STORED_MESSAGES)))
  } catch {
    // localStorage may be unavailable or full; chat still works for the current page session.
  }
}

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString('zh-CN')
}

function formatAiResponse(response: unknown) {
  if (typeof response === 'string') return response

  if (response && typeof response === 'object') {
    const object = response as Record<string, unknown>
    const text = object.content ?? object.message ?? object.answer ?? object.response ?? object.text
    if (typeof text === 'string') return text
  }

  return JSON.stringify(response, null, 2) ?? 'AI 助手已返回空响应。'
}
