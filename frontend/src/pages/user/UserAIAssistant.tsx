import { ArrowDown, ArrowUp, Bot, Check, Copy, ExternalLink, Gift, GraduationCap, Paperclip, Shield, Sparkles, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { getAccountProfile } from '../../services/account'
import { getSavedSession } from '../../services/auth'
import { getAiAppearance, getAiQuota, sendAiChat, type AiCard, type AiPendingAction, type AiQuota } from '../../services/ai'

type ChatMessage = {
  content: string
  role: 'assistant' | 'user'
  cards?: AiCard[]
  actions?: AiPendingAction[]
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
  const [showScrollDown, setShowScrollDown] = useState(false)
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
    const el = scrollAnchorRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowScrollDown(!entry.isIntersecting)
      },
      { rootMargin: '0px 0px 160px 0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasStarted, messages])

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
      setMessages((current) => [
        ...current,
        {
          actions: result.actions,
          cards: result.cards,
          content: result.content || '',
          role: 'assistant',
        },
      ])
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
                  <div className={isUser ? 'max-w-[760px]' : 'w-full max-w-[1040px]'}>
                    {isUser ? (
                      message.content && (
                        <div className="whitespace-pre-wrap rounded-lg bg-brand-600 px-4 py-3 text-sm leading-7 text-white shadow-sm">
                          {message.content}
                        </div>
                      )
                    ) : (
                      <AssistantMessageBubble
                        actions={message.actions}
                        cards={message.cards}
                        content={message.content}
                      />
                    )}
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

          {showScrollDown && (
            <button
              aria-label="滚动到底部"
              className="fixed bottom-36 left-1/2 z-30 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full bg-white/70 text-slate-500 shadow-lg backdrop-blur-md transition hover:bg-white hover:text-slate-900 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/20 dark:hover:text-white"
              onClick={() => {
                scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
              }}
              type="button"
            >
              <ArrowDown className="h-5 w-5" />
            </button>
          )}

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

// ════════════════════════════════════════════════════════════
// AI 回复面板 / 富文本渲染
// ════════════════════════════════════════════════════════════

function AssistantMessageBubble({
  actions,
  cards,
  content,
}: {
  actions?: AiPendingAction[]
  cards?: AiCard[]
  content: string
}) {
  const hasCards = Boolean(cards?.length)
  const [redeemedProducts, setRedeemedProducts] = useState<Record<string, { note?: string; pickupCode?: string; pointsCost: number }>>({})
  const spentInThisMessage = Object.values(redeemedProducts).reduce((sum, item) => sum + item.pointsCost, 0)

  const handleRedeemed = (productId: string, result: { note?: string; pickupCode?: string; pointsCost: number }) => {
    setRedeemedProducts((current) => ({ ...current, [productId]: result }))
  }

  return (
    <div className="overflow-hidden rounded-lg border border-black/10 bg-white/85 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-[#131a15]/90">
      {content && (
        <div className="px-4 py-3">
          <RichAssistantContent content={content} />
        </div>
      )}

      {hasCards && (
        <div className="px-4 pb-4">
          <div className="rounded-lg border border-black/10 bg-white/60 p-3 shadow-sm dark:border-white/10 dark:bg-white/[0.035]">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">Interactive Cards</p>
              <p className="text-[11px] text-slate-400">可直接操作</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {cards?.map((card, ci) => (
                <AiCardRenderer
                  action={findCardAction(card, actions)}
                  card={card}
                  key={`${card.type}-${card.id}-${ci}`}
                  onRedeemed={handleRedeemed}
                  redeemedProduct={card.type === 'MALL_PRODUCT' ? redeemedProducts[card.id] : undefined}
                  spentInMessage={spentInThisMessage}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function RichAssistantContent({ content }: { content: string }) {
  const parts = splitMarkdownCodeBlocks(content)

  return (
    <div className="space-y-3 text-sm leading-7 text-slate-700 dark:text-slate-200">
      {parts.map((part, index) =>
        part.type === 'code' ? (
          <CodeBlock code={part.content} key={`code-${index}`} language={part.language} />
        ) : (
          <FormattedTextBlock key={`text-${index}`} text={part.content} />
        ),
      )}
    </div>
  )
}

function FormattedTextBlock({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <div className="space-y-1.5">
      {lines.map((rawLine, index) => {
        const line = rawLine.trim()
        if (!line) return <div className="h-1" key={index} />

        if (/^#{1,3}\s+/.test(line)) {
          const title = line.replace(/^#{1,3}\s+/, '')
          return (
            <p className="pt-1 text-sm font-semibold text-slate-900 dark:text-white" key={index}>
              {renderInlineCode(title)}
            </p>
          )
        }

        if (/^[-*]\s+/.test(line)) {
          return (
            <div className="flex gap-2 pl-1" key={index}>
              <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
              <p className="min-w-0 flex-1">{renderInlineCode(line.replace(/^[-*]\s+/, ''))}</p>
            </div>
          )
        }

        if (/^\d+[.)、]\s*/.test(line)) {
          const marker = line.match(/^\d+[.)、]/)?.[0] ?? '1.'
          return (
            <div className="flex gap-2 pl-1" key={index}>
              <span className="mt-1.5 inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand-50 px-1 text-[11px] font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                {marker.replace(/[.)、]/, '')}
              </span>
              <p className="min-w-0 flex-1">{renderInlineCode(line.replace(/^\d+[.)、]\s*/, ''))}</p>
            </div>
          )
        }

        return <p key={index}>{renderInlineCode(line)}</p>
      })}
    </div>
  )
}

function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-700 bg-neutral-950 shadow-sm">
      <div className="flex items-center justify-between border-b border-neutral-700 bg-neutral-900 px-3 py-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-500">{language || 'code'}</span>
        <button
          className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-700 px-2 py-1 text-[11px] font-medium text-neutral-400 transition hover:bg-neutral-800 hover:text-neutral-200"
          onClick={handleCopy}
          type="button"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? '已复制' : '复制'}
        </button>
      </div>
      <pre className="max-h-[420px] overflow-auto bg-neutral-950 p-4 text-xs leading-6 text-neutral-300">
        <code>{renderHighlightedCode(code)}</code>
      </pre>
    </div>
  )
}

function renderHighlightedCode(code: string) {
  const tokenRegex = /(\/\/.*|#.*|"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|`(?:\\.|[^`])*`|\b(?:const|let|var|function|return|if|else|for|while|class|import|from|export|async|await|try|catch|throw|new|type|interface|extends|public|private|protected|def|lambda|true|false|null|undefined|None|True|False)\b|\b\d+(?:\.\d+)?\b)/g
  const nodes: ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  let key = 0

  while ((match = tokenRegex.exec(code)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(<span key={`plain-${key++}`}>{code.slice(lastIndex, match.index)}</span>)
    }

    const token = match[0]
    let className = 'text-neutral-300'
    if (token.startsWith('//') || token.startsWith('#')) className = 'text-neutral-600'
    else if (token.startsWith('"') || token.startsWith("'") || token.startsWith('`')) className = 'text-neutral-400'
    else if (/^\d/.test(token)) className = 'text-neutral-200'
    else className = 'text-neutral-100'

    nodes.push(<span className={className} key={`token-${key++}`}>{token}</span>)
    lastIndex = tokenRegex.lastIndex
  }

  if (lastIndex < code.length) nodes.push(<span key={`plain-${key++}`}>{code.slice(lastIndex)}</span>)
  return nodes
}

function splitMarkdownCodeBlocks(content: string) {
  const parts: Array<{ content: string; language?: string; type: 'code' | 'text' }> = []
  const regex = /```([^\n`]*)\n?([\s\S]*?)```/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ content: content.slice(lastIndex, match.index), type: 'text' })
    }
    parts.push({ content: match[2].replace(/\n$/, ''), language: match[1]?.trim() || undefined, type: 'code' })
    lastIndex = regex.lastIndex
  }

  if (lastIndex < content.length) {
    parts.push({ content: content.slice(lastIndex), type: 'text' })
  }

  return parts.filter((part) => part.content.trim().length > 0)
}

function renderInlineCode(text: string) {
  const segments = text.split(/(`[^`]+`)/g)
  return segments.map((segment, index) => {
    if (segment.startsWith('`') && segment.endsWith('`')) {
      return (
        <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.92em] text-brand-700 dark:bg-white/10 dark:text-green-300" key={index}>
          {segment.slice(1, -1)}
        </code>
      )
    }
    return <span key={index}>{segment}</span>
  })
}

function findCardAction(card: AiCard, actions?: AiPendingAction[]) {
  return actions?.find((a) =>
    (card.type === 'MALL_PRODUCT' && a.type === 'MALL_REDEEM' && a.payload?.productId === card.id) ||
    (card.type === 'LEARNING_RESOURCE' && a.type === 'OPEN_LEARNING_RESOURCE' && a.payload?.resourceId === card.id) ||
    (card.type === 'VULNERABILITY' && a.type === 'VIEW_VULNERABILITY' && a.payload?.vulnerabilityId === card.id),
  )
}

// ════════════════════════════════════════════════════════════
// 卡片渲染
// ════════════════════════════════════════════════════════════

type RedeemedProductState = { note?: string; pickupCode?: string; pointsCost: number }

function AiCardRenderer({
  action,
  card,
  onRedeemed,
  redeemedProduct,
  spentInMessage = 0,
}: {
  action?: AiPendingAction
  card: AiCard
  onRedeemed?: (productId: string, result: RedeemedProductState) => void
  redeemedProduct?: RedeemedProductState
  spentInMessage?: number
}) {
  switch (card.type) {
    case 'LEARNING_RESOURCE':
      return <LearningResourceCard action={action} card={card} />
    case 'MALL_PRODUCT':
      return (
        <MallProductCard
          action={action}
          card={card}
          onRedeemed={onRedeemed}
          redeemedProduct={redeemedProduct}
          spentInMessage={spentInMessage}
        />
      )
    case 'VULNERABILITY':
      return <VulnerabilityCard action={action} card={card} />
    default:
      return null
  }
}

function LearningResourceCard({ card }: { card: AiCard & { type: 'LEARNING_RESOURCE' }; action?: AiPendingAction }) {
  return (
    <div className="rounded-lg border border-black/10 bg-white/80 p-4 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
          <GraduationCap className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{card.title}</p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {card.category} · {card.kind === 'RANGE' ? '靶场实操' : '学习资料'}
          </p>
          {card.description && (
            <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{card.description}</p>
          )}
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <a
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brand-700"
          href={`/learning/${card.id}`}
          rel="noreferrer"
          target="_blank"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          {card.actionLabel || '进入靶场'}
        </a>
      </div>
    </div>
  )
}

function MallProductCard({
  card,
  onRedeemed,
  redeemedProduct,
  spentInMessage = 0,
}: {
  action?: AiPendingAction
  card: AiCard & { type: 'MALL_PRODUCT' }
  onRedeemed?: (productId: string, result: RedeemedProductState) => void
  redeemedProduct?: RedeemedProductState
  spentInMessage?: number
}) {
  const [redeemState, setRedeemState] = useState<'idle' | 'confirm' | 'loading' | 'success' | 'error'>(redeemedProduct ? 'success' : 'idle')
  const [redeemResult, setRedeemResult] = useState<{ pickupCode?: string; note?: string; error?: string }>(redeemedProduct ?? {})
  const alreadyRedeemed = Boolean(redeemedProduct) || redeemState === 'success'
  const displayedBalance = Math.max(0, card.userBalance - spentInMessage)
  const displayedStock = Math.max(0, card.stock - (alreadyRedeemed ? 1 : 0))
  const canRedeemNow = card.canRedeem && !alreadyRedeemed && displayedBalance >= card.pointsCost && displayedStock > 0

  const handleRedeem = async () => {
    setRedeemState('loading')
    try {
      const { redeemProduct } = await import('../../services/ai')
      const result = await redeemProduct(card.id)
      const nextResult = { note: result.note, pickupCode: result.pickupCode, pointsCost: result.pointsCost }
      setRedeemResult(nextResult)
      onRedeemed?.(card.id, nextResult)
      setRedeemState('success')
    } catch (err) {
      setRedeemResult({ error: err instanceof Error ? err.message : '兑换失败，请稍后重试' })
      setRedeemState('error')
    }
  }

  return (
    <div className={`flex h-full min-h-[390px] flex-col overflow-hidden rounded-lg border shadow-sm transition ${
      alreadyRedeemed
        ? 'border-green-300/50 bg-green-50/80 dark:border-green-700/40 dark:bg-green-950/20'
        : canRedeemNow
        ? 'border-brand-300/50 bg-brand-50/70 dark:border-brand-700/30 dark:bg-brand-950/20'
        : redeemState === 'error'
        ? 'border-red-300/50 bg-red-50/80 dark:border-red-700/40 dark:bg-red-950/20'
        : 'border-black/10 bg-white/90 dark:border-white/10 dark:bg-white/[0.04]'
    }`}>
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100 dark:bg-white/[0.04]">
        {card.imageUrl ? (
          <img
            alt={card.name}
            className="h-full w-full object-cover"
            src={card.imageUrl}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-300">
            <Gift className="h-10 w-10" />
          </div>
        )}
        <span className="absolute right-3 top-3 rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm">
          {card.pointsCost.toLocaleString('zh-CN')} 分
        </span>
        <span className={`absolute left-3 top-3 rounded-lg px-2.5 py-1 text-xs font-medium shadow-sm ${
          alreadyRedeemed
            ? 'bg-green-600 text-white'
            : canRedeemNow
            ? 'bg-white/90 text-brand-700 dark:bg-[#131a15]/90 dark:text-brand-300'
            : 'bg-white/90 text-slate-500 dark:bg-[#131a15]/90 dark:text-slate-300'
        }`}>
          {alreadyRedeemed ? '已兑换' : canRedeemNow ? '可兑换' : displayedStock <= 0 ? '已售罄' : '积分不足'}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col p-4">
        <div className="min-h-[74px]">
          <p className="line-clamp-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{card.name}</p>
          {card.description ? (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{card.description}</p>
          ) : (
            <p className="mt-1 text-xs leading-relaxed text-slate-400">暂无商品描述</p>
          )}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-lg bg-white/80 px-2.5 py-2 text-slate-600 ring-1 ring-black/5 dark:bg-white/[0.04] dark:text-slate-300 dark:ring-white/10">
            <span className="block whitespace-nowrap text-[10px] text-slate-400">库存</span>
            <strong className="block truncate">{displayedStock} 件</strong>
          </div>
          <div className="rounded-lg bg-white/80 px-2.5 py-2 text-slate-600 ring-1 ring-black/5 dark:bg-white/[0.04] dark:text-slate-300 dark:ring-white/10">
            <span className="block whitespace-nowrap text-[10px] text-slate-400">积分</span>
            <strong className="block truncate">{displayedBalance.toLocaleString('zh-CN')}</strong>
          </div>
          <div className="rounded-lg bg-white/80 px-2.5 py-2 text-slate-600 ring-1 ring-black/5 dark:bg-white/[0.04] dark:text-slate-300 dark:ring-white/10">
            <span className="block whitespace-nowrap text-[10px] text-slate-400">限购</span>
            <strong className="block truncate">{card.perUserLimit ? `${card.perUserLimit} 件` : '不限'}</strong>
          </div>
        </div>

        <div className="mt-auto pt-3">
        {redeemState === 'idle' && canRedeemNow && (
          <button
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-brand-700"
            onClick={() => setRedeemState('confirm')}
            type="button"
          >
            <Gift className="h-3.5 w-3.5" />
            立即兑换
          </button>
        )}

        {redeemState === 'confirm' && (
          <div className="rounded-lg border border-brand-200 bg-white p-3 text-xs shadow-sm dark:border-brand-800/40 dark:bg-[#131a15]">
            <p className="font-medium text-slate-800 dark:text-slate-100">确认兑换「{card.name}」？</p>
            <p className="mt-1 text-slate-500 dark:text-slate-400">将扣除 {card.pointsCost.toLocaleString('zh-CN')} 积分，兑换后不可自动撤销。</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="rounded-lg bg-brand-600 px-3 py-1.5 font-medium text-white transition hover:bg-brand-700" onClick={handleRedeem} type="button">
                确认兑换
              </button>
              <button className="rounded-lg border border-black/10 px-3 py-1.5 font-medium text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.06]" onClick={() => setRedeemState('idle')} type="button">
                取消
              </button>
            </div>
          </div>
        )}

        {redeemState === 'loading' && (
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
            正在兑换...
          </span>
        )}

        {alreadyRedeemed && (
          <div className="rounded-lg bg-green-100 px-3 py-2 text-xs text-green-800 dark:bg-green-900/30 dark:text-green-200">
            <p className="font-medium">✅ 兑换成功！卡片状态已更新</p>
            {(redeemResult.pickupCode || redeemedProduct?.pickupCode) && (
              <p className="mt-0.5">领取码：<span className="font-mono font-bold">{redeemResult.pickupCode || redeemedProduct?.pickupCode}</span></p>
            )}
            {(redeemResult.note || redeemedProduct?.note) && <p className="mt-0.5">{redeemResult.note || redeemedProduct?.note}</p>}
          </div>
        )}

        {redeemState === 'error' && (
          <div className="rounded-lg bg-red-100 px-3 py-2 text-xs text-red-800 dark:bg-red-900/30 dark:text-red-200">
            <p>❌ {redeemResult.error || '兑换失败'}</p>
            <button
              className="mt-1 underline transition hover:opacity-70"
              onClick={() => setRedeemState('idle')}
              type="button"
            >
              重试
            </button>
          </div>
        )}

        {!canRedeemNow && redeemState === 'idle' && !alreadyRedeemed && (
          <p className="text-xs text-slate-400">
            {displayedStock <= 0 ? '已售罄' : displayedBalance < card.pointsCost ? '积分不足' : '暂不可兑换'}
          </p>
        )}
        </div>
      </div>
    </div>
  )
}

function VulnerabilityCard({ card, action }: { card: AiCard & { type: 'VULNERABILITY' }; action?: AiPendingAction }) {
  return (
    <div className={`rounded-lg border p-4 shadow-sm transition ${
      card.needsSupplement
        ? 'border-amber-300/50 bg-amber-50/80 dark:border-amber-700/40 dark:bg-amber-950/20'
        : 'border-black/10 bg-white/90 dark:border-white/10 dark:bg-white/[0.04]'
    }`}>
      <div className="flex items-start gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${
          card.needsSupplement
            ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:ring-amber-800/40'
            : 'bg-blue-100 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:ring-blue-800/40'
        }`}>
          <Shield className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-500 dark:bg-white/10 dark:text-slate-300">{card.reportNo}</span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
              card.needsSupplement
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
            }`}>
              {card.needsSupplement ? '⚠ 待补充' : card.status}
            </span>
            <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] text-slate-500 ring-1 ring-black/5 dark:bg-white/[0.04] dark:text-slate-400 dark:ring-white/10">
              {card.severity}
            </span>
          </div>
          <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{card.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {card.needsSupplement ? '该报告需要补充材料，建议优先完善复现步骤、影响范围和附件证据。' : '可以进入详情页查看审核进度、报告内容和证书状态。'}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
            card.needsSupplement
              ? 'bg-amber-600 text-white hover:bg-amber-700'
              : 'border border-black/10 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.08]'
          }`}
          href={`/vulnerabilities/${card.id}`}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          {action?.label || (card.needsSupplement ? '去补充材料' : '查看详情')}
        </a>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// 头像组件
// ════════════════════════════════════════════════════════════

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
  if (avatarUrl) {
    return (
      <img
        alt={name}
        className="h-11 w-11 shrink-0 rounded-full object-cover shadow-sm ring-1 ring-black/5"
        src={avatarUrl}
      />
    )
  }

  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-600 shadow-sm ring-1 ring-black/5 dark:bg-slate-700 dark:text-slate-300">
      {name[0]?.toUpperCase() ?? '?'}
    </div>
  )
}

function TypingIndicator() {
  return (
    <span className="inline-flex items-center gap-1">
      {[0.25, 0.35, 0.45].map((delay) => (
        <motion.span
          animate={{ opacity: [0.2, 1, 0.2] }}
          className="inline-block h-1.5 w-1.5 rounded-full bg-current"
          key={delay}
          transition={{ duration: 1.2, ease: 'easeInOut', repeat: Infinity, delay }}
        />
      ))}
      <span className="ml-1 text-xs">思考中...</span>
    </span>
  )
}

// ════════════════════════════════════════════════════════════
// 额度预警
// ════════════════════════════════════════════════════════════

function QuotaWarning({
  dismissed,
  quota,
  onDismiss,
}: {
  dismissed: '20' | '5' | null
  quota: AiQuota | null
  onDismiss: (level: '20' | '5' | null) => void
}) {
  if (!quota) return null

  const remainingPercent = quota.activeLimit > 0 ? Math.round((quota.remaining / quota.activeLimit) * 100) : 100

  if (remainingPercent <= 5 && dismissed !== '5') {
    return (
      <div className="mb-2 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800/40 dark:bg-red-950/20 dark:text-red-300">
        <span>⚠️ AI 额度仅剩 {remainingPercent}%，回复可能中断</span>
        <button onClick={() => onDismiss('5')} type="button"><X className="h-3.5 w-3.5" /></button>
      </div>
    )
  }

  if (remainingPercent <= 20 && dismissed !== '20') {
    return (
      <div className="mb-2 flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800/40 dark:bg-amber-950/20 dark:text-amber-300">
        <span>AI 额度剩余 {remainingPercent}%</span>
        <button onClick={() => onDismiss('20')} type="button"><X className="h-3.5 w-3.5" /></button>
      </div>
    )
  }

  return null
}

// ════════════════════════════════════════════════════════════
// localStorage
// ════════════════════════════════════════════════════════════

function getConversationStorageKey() {
  const session = getSavedSession()
  const id = session?.user?.unifiedCode ?? session?.user?.id ?? 'anonymous'
  return `cqupt-src-ai-conversation:${id}`
}

function loadStoredMessages(key: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.slice(-MAX_STORED_MESSAGES)
  } catch {
    return []
  }
}

function saveStoredMessages(key: string, messages: ChatMessage[]) {
  try {
    const trimmed = messages.slice(-MAX_STORED_MESSAGES)
    localStorage.setItem(key, JSON.stringify(trimmed))
  } catch {
    // localStorage full — ignore
  }
}
