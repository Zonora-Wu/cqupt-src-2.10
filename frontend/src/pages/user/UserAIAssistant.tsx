import { ArrowDown, ArrowUp, Bot, Check, Copy, ExternalLink, Gift, GraduationCap, GripVertical, History, MessageSquarePlus, PanelLeftClose, PanelLeftOpen, Paperclip, RotateCcw, Shield, ThumbsDown, ThumbsUp, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { getAccountProfile } from '../../services/account'
import { getSavedSession } from '../../services/auth'
import { markdownTemplate, vulnerabilityTypes } from '../../constants/vulnerabilityForm'
import { createAiProblemSession, getActiveAiProblemSession, getAiAppearance, getAiProblemSession, getAiQuota, heartbeatAiProblemSession, leaveAiProblemSession, listAiProblemSessions, requestAiProblemSessionResolutionPrompt, resolveAiProblemSession, resumeAiProblemSessionResolutionPrompt, sendAiChat, snoozeAiProblemSessionResolutionPrompt, submitAiTurnFeedback, uploadAiAttachmentText, uploadAiReportDraft, type AiCard, type AiChatResponse, type AiPendingAction, type AiProblemSession, type AiQuota, type AiTurnFeedbackRating, type AiVulnerabilityDraft } from '../../services/ai'
import { getAccessStatus, type AccessStatus } from '../../services/access'
import { clickLearningResource } from '../../services/learning'
import { createVulnerability, uploadVulnerabilityAttachment, type CreateVulnerabilityPayload } from '../../services/vulnerabilities'
import { SelectInput } from '../../components/ui/SelectInput'

type ChatMessage = {
  assistantTurnId?: string
  attachment?: ChatAttachment
  content: string
  feedback?: AiTurnFeedbackRating | null
  knowledgeHitIds?: string[]
  knowledgeSources?: AiChatResponse['knowledgeSources']
  role: 'assistant' | 'user'
  cards?: AiCard[]
  actions?: AiPendingAction[]
  reportDrafts?: AiVulnerabilityDraft[]
  sessionId?: string
  usedKnowledge?: boolean
}

type UserAIAssistantProps = {
  initialPrompt?: string | null
  onInitialPromptConsumed?: () => void
}

type PendingAttachment = {
  file: File
  id: string
}

type ChatAttachment = {
  name: string
  size: number
}

const MAX_STORED_MESSAGES = 80
const CONTINUABLE_SESSION_STATUSES = new Set(['ACTIVE', 'AWAITING_RESOLUTION'])
const HISTORY_PANEL_DEFAULT_WIDTH = 264
const HISTORY_PANEL_MAX_WIDTH = 420
const HISTORY_PANEL_MIN_WIDTH = 220
const HISTORY_PANEL_WIDTH_STORAGE_KEY = 'cqupt-src-ai-history-panel-width'
const HISTORY_PANEL_MIN_CHAT_WIDTH = 860
const HISTORY_PANEL_GAP = 32
const DESKTOP_HISTORY_BREAKPOINT = 1024

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
  const inputTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const reportFileInputRef = useRef<HTMLInputElement | null>(null)
  const reportAttachmentFilesRef = useRef<Record<string, File>>({})
  const consumedInitialPromptRef = useRef<string | null>(null)
  const problemSessionIdRef = useRef<string | null>(null)
  const hasProblemContentRef = useRef(messages.length > 0)
  const [bottomInset, setBottomInset] = useState(156)
  const [showScrollDown, setShowScrollDown] = useState(false)
  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachment | null>(null)
  const [uploadingAttachment, setUploadingAttachment] = useState(false)
  const [problemSession, setProblemSession] = useState<AiProblemSession | null>(null)
  const [historySessions, setHistorySessions] = useState<AiProblemSession[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyCollapsed, setHistoryCollapsed] = useState(false)
  const [historyAutoCollapsed, setHistoryAutoCollapsed] = useState(false)
  const [historyPanelWidth, setHistoryPanelWidth] = useState(loadHistoryPanelWidth)
  const [viewportWidth, setViewportWidth] = useState(() => typeof window === 'undefined' ? 0 : window.innerWidth)
  const [readOnlyHistory, setReadOnlyHistory] = useState(false)
  const [resolutionPrompt, setResolutionPrompt] = useState<AiProblemSession | null>(null)
  const [resolutionAction, setResolutionAction] = useState<'RESOLVE' | 'SNOOZE' | 'CONTINUE' | null>(null)
  const [resolutionError, setResolutionError] = useState('')
  const hasStarted = messages.length > 0

  useEffect(() => {
    saveHistoryPanelWidth(historyPanelWidth)
  }, [historyPanelWidth])

  useEffect(() => {
    const updateViewportWidth = () => setViewportWidth(window.innerWidth)
    updateViewportWidth()
    window.addEventListener('resize', updateViewportWidth)
    return () => window.removeEventListener('resize', updateViewportWidth)
  }, [])

  const shouldAutoCollapseHistory = viewportWidth >= DESKTOP_HISTORY_BREAKPOINT
    && viewportWidth < historyPanelWidth + HISTORY_PANEL_MIN_CHAT_WIDTH + HISTORY_PANEL_GAP
  const historyIsCollapsed = historyCollapsed || shouldAutoCollapseHistory
  const historyContentInset = !historyIsCollapsed
    ? getHistoryContentInset(viewportWidth, historyPanelWidth)
    : 0

  useEffect(() => {
    if (shouldAutoCollapseHistory) {
      setHistoryCollapsed(true)
      setHistoryAutoCollapsed(true)
      return
    }

    if (historyAutoCollapsed) {
      setHistoryCollapsed(false)
      setHistoryAutoCollapsed(false)
    }
  }, [historyAutoCollapsed, shouldAutoCollapseHistory])

  const handleHistoryCollapsedChange = (collapsed: boolean) => {
    setHistoryAutoCollapsed(false)
    setHistoryCollapsed(collapsed)
  }

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
    let active = true

    getActiveAiProblemSession('student')
      .then(async (session) => {
        if (!active) return
        const current = session ?? await createAiProblemSession('student')
        const detailed = await getAiProblemSession(current.id).catch(() => current)
        if (!active) return
        // 用户已在初始化期间创建新会话时，不能把旧会话及其消息回填回来。
        if (problemSessionIdRef.current && problemSessionIdRef.current !== detailed.id) return
        problemSessionIdRef.current = detailed.id
        setProblemSession(detailed)
        setResolutionPrompt(detailed.shouldAskResolution ? detailed : null)
        if (detailed.turns?.length) {
          setMessages((currentMessages) => currentMessages.length > 0 ? currentMessages : messagesFromProblemSession(detailed))
        }
      })
      .catch(() => undefined)

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    void refreshHistorySessions()
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      const id = problemSessionIdRef.current
      if (!id || document.visibilityState !== 'visible') return
      void heartbeatAiProblemSession(id)
        .then((session) => {
          setProblemSession(session)
          setResolutionPrompt(session.shouldAskResolution ? session : null)
        })
        .catch(() => undefined)
    }, 30_000)

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void getActiveAiProblemSession('student')
          .then((session) => {
            if (!session) return
            problemSessionIdRef.current = session.id
            setProblemSession(session)
            setResolutionPrompt(session.shouldAskResolution ? session : null)
          })
          .catch(() => undefined)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, sending])

  useEffect(() => {
    if (!readOnlyHistory) saveStoredMessages(storageKeyRef.current, messages)
    hasProblemContentRef.current = messages.length > 0
  }, [messages, readOnlyHistory])

  useEffect(() => {
    const textarea = inputTextareaRef.current
    if (!textarea) return

    const resizeTextarea = () => {
      const maxHeight = Math.max(160, Math.floor(window.innerHeight * 0.5))
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`
      textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden'
    }

    resizeTextarea()
    window.addEventListener('resize', resizeTextarea)
    return () => window.removeEventListener('resize', resizeTextarea)
  }, [input])

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

  const ensureProblemSession = async (initialQuestion?: string) => {
    if (resolutionPrompt) setResolutionPrompt(null)
    if (readOnlyHistory) {
      const session = await createAiProblemSession('student', initialQuestion)
      problemSessionIdRef.current = session.id
      setProblemSession(session)
      setReadOnlyHistory(false)
      setMessages([])
      await refreshHistorySessions()
      return session.id
    }
    const existingId = problemSessionIdRef.current
    if (existingId) return existingId

    const session = await createAiProblemSession('student', initialQuestion)
    problemSessionIdRef.current = session.id
    setProblemSession(session)
    setReadOnlyHistory(false)
    await refreshHistorySessions()
    return session.id
  }

  const startFreshProblemSession = async () => {
    const currentId = problemSessionIdRef.current
    if (currentId && hasProblemContentRef.current) {
      const prompt = await requestAiProblemSessionResolutionPrompt(currentId, 'NEW_CONVERSATION').catch(() => null)
      if (prompt) {
        setResolutionError('')
        setResolutionPrompt(prompt)
        return null
      }
      await leaveAiProblemSession(currentId).catch(() => undefined)
    }
    const session = await createAiProblemSession('student')
    problemSessionIdRef.current = session.id
    setProblemSession(session)
    setReadOnlyHistory(false)
    setResolutionPrompt(null)
    setMessages([])
    localStorage.removeItem(storageKeyRef.current)
    await refreshHistorySessions()
    return session.id
  }

  const refreshHistorySessions = async () => {
    setHistoryLoading(true)
    try {
      const sessions = await listAiProblemSessions(30)
      setHistorySessions(sessions)
    } catch {
      setHistorySessions([])
    } finally {
      setHistoryLoading(false)
    }
  }

  const openHistorySession = async (id: string) => {
    if (sending || uploadingAttachment) return
    const currentId = problemSessionIdRef.current
    if (currentId && currentId !== id && hasProblemContentRef.current && !readOnlyHistory) {
      await leaveAiProblemSession(currentId).catch(() => undefined)
    }
    const session = await getAiProblemSession(id)
    const canContinue = CONTINUABLE_SESSION_STATUSES.has(session.status)
    problemSessionIdRef.current = canContinue ? session.id : null
    setProblemSession(session)
    setReadOnlyHistory(!canContinue)
    setResolutionPrompt(null)
    setMessages(messagesFromProblemSession(session))
  }

  const continueProblemSession = async () => {
    const id = resolutionPrompt?.id ?? problemSessionIdRef.current
    if (!id) return
    setResolutionAction('CONTINUE')
    setResolutionError('')
    try {
      const session = await resumeAiProblemSessionResolutionPrompt(id)
      problemSessionIdRef.current = session.id
      setProblemSession(session)
      setResolutionPrompt(null)
    } catch {
      setResolutionError('无法继续该会话，请稍后重试。')
    } finally {
      setResolutionAction(null)
    }
  }

  const snoozeProblemSession = async () => {
    const id = resolutionPrompt?.id ?? problemSessionIdRef.current
    if (!id) return
    setResolutionAction('SNOOZE')
    setResolutionError('')
    try {
      const session = await snoozeAiProblemSessionResolutionPrompt(id)
      problemSessionIdRef.current = session.id
      setProblemSession(session)
      setResolutionPrompt(null)
    } catch {
      setResolutionError('暂时无法设置提醒，请稍后重试。')
    } finally {
      setResolutionAction(null)
    }
  }

  const resolveProblemSession = async () => {
    const id = resolutionPrompt?.id ?? problemSessionIdRef.current
    if (!id) return
    setResolutionAction('RESOLVE')
    setResolutionError('')
    try {
      await resolveAiProblemSession(id)
      problemSessionIdRef.current = null
      setReadOnlyHistory(false)
      setResolutionPrompt(null)
      await refreshHistorySessions()
      await startFreshProblemSession()
    } catch (error) {
      setResolutionError(error instanceof Error ? `未进入沉淀：${error.message}` : '未进入沉淀：总结失败，会话已保留。')
    } finally {
      setResolutionAction(null)
    }
  }

  const sendMessage = async (overrideContent?: string) => {
    const content = (overrideContent ?? input).trim()
    const attachment = pendingAttachment
    if ((!content && !attachment) || sending || uploadingAttachment) return

    const effectiveContent = content || '请阅读附件内容，并给出整理、修改或下一步建议。'
    const shouldExtractReportDrafts = Boolean(attachment && isReportDraftIntent(effectiveContent))
    const userAttachment = attachment ? { name: attachment.file.name, size: attachment.file.size } : undefined

    setMessages((current) => [...current, { attachment: userAttachment, role: 'user', content: effectiveContent }])
    setInput('')
    setPendingAttachment(null)

    if (shouldExtractReportDrafts && attachment) {
      setUploadingAttachment(true)
      try {
        const result = await uploadAiReportDraft(attachment.file)
        result.drafts.forEach((draft) => {
          reportAttachmentFilesRef.current[draft.id] = attachment.file
        })
        setMessages((current) => [
          ...current,
          {
            role: 'assistant',
            content: `${result.message}\n\n我已按你的提交/生成报告意图，把附件内容拆成可编辑的漏洞提交卡片。报告中没有的信息会保持为空；请补齐标题、影响资产、漏洞类型、等级、复现步骤、影响评估和修复建议后，再逐项确认提交。`,
            reportDrafts: result.drafts,
          },
        ])
      } catch (error) {
        setMessages((current) => [
          ...current,
          { role: 'assistant', content: error instanceof Error ? error.message : '附件解析失败，请确认 PDF 可复制文本后再试。' },
        ])
      } finally {
        setUploadingAttachment(false)
        if (reportFileInputRef.current) reportFileInputRef.current.value = ''
      }
      return
    }

    setSending(true)
    setUploadingAttachment(Boolean(attachment))

    try {
      const activeSessionId = await ensureProblemSession(effectiveContent)
      const attachmentContext = attachment ? await uploadAiAttachmentText(attachment.file) : null
      const result = await sendAiChat(
        effectiveContent,
        'student',
        attachmentContext
          ? {
              attachments: [
                {
                  fileName: attachmentContext.fileName,
                  kind: attachmentContext.kind,
                  mimeType: attachmentContext.mimeType,
                  size: attachmentContext.size,
                  sourceTextLength: attachmentContext.sourceTextLength,
                  textExcerpt: attachmentContext.textExcerpt,
                },
              ],
              attachmentUsePolicy: '附件是用户本轮提问的上下文。不要默认把附件当作要提交的漏洞报告；只有用户明确要求生成/提交漏洞报告时才引导提交，否则按用户输入提供修改、总结、检查或建议。',
            }
          : undefined,
        activeSessionId,
      )
      if (result.sessionId) {
        problemSessionIdRef.current = result.sessionId
        setProblemSession((current) => current ? { ...current, id: result.sessionId ?? current.id, status: 'ACTIVE', shouldAskResolution: false } : current)
      }
      if (result.quota) setAiQuota(result.quota)
      setMessages((current) => [
        ...current,
        {
          actions: result.actions,
          assistantTurnId: result.assistantTurnId,
          cards: result.cards,
          content: result.content || '',
          knowledgeHitIds: result.knowledgeHitIds,
          knowledgeSources: result.knowledgeSources,
          role: 'assistant',
          sessionId: result.sessionId ?? activeSessionId,
          usedKnowledge: result.usedKnowledge,
        },
      ])
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: error instanceof Error ? error.message : '邮宝暂时不可用，请稍后再试。',
        },
      ])
    } finally {
      setSending(false)
      setUploadingAttachment(false)
      if (reportFileInputRef.current) reportFileInputRef.current.value = ''
      void refreshHistorySessions()
    }
  }

  const regenerateAssistantMessage = async (messageIndex: number) => {
    if (sending || uploadingAttachment) return

    const previousUserMessage = [...messages.slice(0, messageIndex)].reverse().find((message) => message.role === 'user')
    const prompt = previousUserMessage?.content.trim()
    if (!prompt) return

    setSending(true)
    try {
      const activeSessionId = await ensureProblemSession(prompt)
      const result = await sendAiChat(prompt, 'student', undefined, activeSessionId)
      if (result.sessionId) problemSessionIdRef.current = result.sessionId
      if (result.quota) setAiQuota(result.quota)
      setMessages((current) =>
        current.map((message, index) =>
          index === messageIndex
            ? {
                actions: result.actions,
                assistantTurnId: result.assistantTurnId,
                cards: result.cards,
                content: result.content || '',
                knowledgeHitIds: result.knowledgeHitIds,
                knowledgeSources: result.knowledgeSources,
                role: 'assistant',
                sessionId: result.sessionId ?? activeSessionId,
                usedKnowledge: result.usedKnowledge,
              }
            : message,
        ),
      )
    } catch (error) {
      setMessages((current) =>
        current.map((message, index) =>
          index === messageIndex
            ? {
                role: 'assistant',
                content: error instanceof Error ? error.message : '邮宝暂时不可用，请稍后再试。',
              }
            : message,
        ),
      )
    } finally {
      setSending(false)
      void refreshHistorySessions()
    }
  }

  const handleAttachmentSelected = (file: File | undefined) => {
    if (!file || uploadingAttachment || sending) return
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setMessages((current) => [
        ...current,
        { role: 'assistant', content: '当前仅支持上传 PDF 附件。你可以先转换为可复制文本的 PDF 后再发送给邮宝。' },
      ])
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      setMessages((current) => [
        ...current,
        { role: 'assistant', content: '附件文件不能超过 20MB，请压缩后再上传。' },
      ])
      return
    }

    setPendingAttachment({ file, id: `${file.name}-${file.size}-${file.lastModified}` })
    window.setTimeout(() => inputTextareaRef.current?.focus(), 0)
  }

  const inputBox = (
    <div className="mx-auto w-full">
      <QuotaWarning
        dismissed={dismissedQuotaWarning}
        quota={aiQuota}
        onDismiss={setDismissedQuotaWarning}
      />
      <motion.div
        className="w-full rounded-lg border border-black/10 bg-[var(--app-bg)]/90 p-2 shadow-xl shadow-black/5 backdrop-blur-xl dark:border-white/10 /90 dark:shadow-black/25"
        layoutId="ai-assistant-input"
        transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      >
        <AnimatePresence initial={false}>
          {pendingAttachment && (
            <PendingAttachmentPreview
              attachment={pendingAttachment}
              disabled={sending || uploadingAttachment}
              onRemove={() => {
                setPendingAttachment(null)
                if (reportFileInputRef.current) reportFileInputRef.current.value = ''
              }}
            />
          )}
        </AnimatePresence>
        <div className="flex items-end gap-2">
          <input
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(event) => handleAttachmentSelected(event.target.files?.[0])}
            ref={reportFileInputRef}
            type="file"
          />
          <button
            aria-label="选择 PDF 附件"
            className="rounded-lg p-2 text-slate-500 transition hover:bg-black/5 hover:text-slate-900 disabled:cursor-wait disabled:opacity-50 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
            disabled={uploadingAttachment || sending}
            onClick={() => reportFileInputRef.current?.click()}
            type="button"
          >
            <Paperclip className={`h-5 w-5 ${uploadingAttachment ? 'animate-pulse' : ''}`} />
          </button>
          <textarea
            className="ai-chat-input-scroll min-h-12 flex-1 resize-none bg-transparent px-2 py-3 text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-white/30"
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void sendMessage()
              }
            }}
            placeholder={pendingAttachment ? '说明你希望邮宝如何处理这个附件，例如：帮我修改建议 / 总结重点 / 生成提交草稿' : '询问漏洞报告、复现步骤、修复建议或学习路径'}
            ref={inputTextareaRef}
            rows={1}
            value={input}
          />
          <button
            aria-label="发送"
            className="rounded-lg bg-brand-600 p-2 text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-white/15"
            disabled={readOnlyHistory || (!input.trim() && !pendingAttachment) || sending || uploadingAttachment || aiQuota?.enabled === false || aiQuota?.remaining === 0}
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
    <>
    <AiHistoryPanel
      activeId={problemSession?.id ?? null}
      autoCollapsed={historyAutoCollapsed || shouldAutoCollapseHistory}
      collapsed={historyIsCollapsed}
      loading={historyLoading}
      sessions={historySessions}
      width={historyPanelWidth}
      onCollapsedChange={handleHistoryCollapsedChange}
      onNew={() => void startFreshProblemSession()}
      onOpen={(id) => void openHistorySession(id)}
      onWidthChange={setHistoryPanelWidth}
    />
    <section
      className={`relative z-10 mx-auto flex min-h-screen max-w-[1360px] flex-col px-5 pb-6 transition-[padding-left] duration-300 ease-out md:px-8 ${
        hasStarted ? 'pt-24' : 'pt-16'
      }`}
      style={historyContentInset ? { paddingLeft: `${historyContentInset + 32}px` } : undefined}
    >
      <MobileHistoryBar
        activeId={problemSession?.id ?? null}
        loading={historyLoading}
        sessions={historySessions}
        onNew={() => void startFreshProblemSession()}
        onOpen={(id) => void openHistorySession(id)}
        showAtDesktop={shouldAutoCollapseHistory}
      />
      {resolutionPrompt ? (
        <ProblemSessionResolutionCard
          busy={resolutionAction}
          error={resolutionError}
          onContinue={() => void continueProblemSession()}
          onSnooze={() => void snoozeProblemSession()}
          onResolve={() => void resolveProblemSession()}
        />
      ) : null}
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
            <h1 className="mt-0 text-3xl font-semibold tracking-tight md:text-4xl">邮宝</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500 dark:text-slate-400">
              CQUPT-SRC 平台 AI 助手，面向漏洞报告、复现材料、修复建议和学习路径提供智能辅助。
            </p>
            <div className="mt-8 w-full max-w-[760px]">{inputBox}</div>
            <p className="mt-3 text-xs text-slate-400">邮宝回复仅作辅助，漏洞提交与安全测试仍需人工核实并遵守授权边界。</p>
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
                      <>
                        <UserMessageBubble attachment={message.attachment} content={message.content} />
                        <MessageCopyButton align="right" content={message.content} />
                      </>
                    ) : (
                      <>
                        <AssistantMessageBubble
                          actions={message.actions}
                          cards={message.cards}
                          content={message.content}
                          getReportAttachmentFile={(draftId) => reportAttachmentFilesRef.current[draftId]}
                          knowledgeSources={message.knowledgeSources}
                          reportDrafts={message.reportDrafts}
                          usedKnowledge={message.usedKnowledge}
                        />
                        <AssistantMessageActions
                          assistantTurnId={message.assistantTurnId}
                          content={message.content}
                          disabled={sending || uploadingAttachment}
                          feedback={message.feedback}
                          onRegenerate={() => void regenerateAssistantMessage(index)}
                          onFeedbackChange={(rating) => {
                            setMessages((current) =>
                              current.map((item, itemIndex) => itemIndex === index ? { ...item, feedback: rating === 'CLEARED' ? null : rating } : item),
                            )
                          }}
                          sessionId={message.sessionId ?? problemSession?.id ?? undefined}
                        />
                      </>
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
                <div className="rounded-lg border border-black/10 bg-[var(--app-panel-bg)] px-4 py-3 text-sm leading-7 text-slate-500 shadow-sm backdrop-blur-xl dark:border-white/10  dark:text-slate-300">
                  <TypingIndicator />
                </div>
              </motion.div>
            )}
            <div ref={scrollAnchorRef} style={{ scrollMarginBottom: bottomInset }} />
          </motion.div>

          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[1360px] px-5 pb-6 transition-[padding-left] duration-300 ease-out md:px-8"
            initial={{ opacity: 0, y: 28 }}
            key="ai-docked-input"
            ref={dockedInputRef}
            style={historyContentInset ? { paddingLeft: `${historyContentInset + 32}px` } : undefined}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <AnimatePresence>
              {showScrollDown && (
                <motion.div
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-3 flex justify-center"
                  exit={{ opacity: 0, y: 8, transition: { duration: 0.18 } }}
                  initial={{ opacity: 0, y: 8 }}
                  key="scroll-to-bottom"
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                >
                  <button
                    aria-label="滚动到底部"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--app-panel-bg)] text-slate-500 shadow-lg backdrop-blur-md transition hover:bg-white hover:text-slate-900 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/20 dark:hover:text-white"
                    onClick={() => {
                      scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
                    }}
                    type="button"
                  >
                    <ArrowDown className="h-5 w-5" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
            {inputBox}
            <p className="mt-2 text-center text-xs text-slate-400">{readOnlyHistory ? '当前为历史会话只读查看。点击新对话继续提问。' : '邮宝回复仅作辅助，漏洞提交与安全测试仍需人工核实并遵守授权边界。'}</p>
          </motion.div>
          </>
        )}
      </AnimatePresence>
    </section>
    </>
  )
}

function PendingAttachmentPreview({
  attachment,
  disabled,
  onRemove,
}: {
  attachment: PendingAttachment
  disabled?: boolean
  onRemove: () => void
}) {
  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="mb-2 flex justify-start"
      exit={{ opacity: 0, y: 6, transition: { duration: 0.16 } }}
      initial={{ opacity: 0, y: 6 }}
      key={attachment.id}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <AttachmentCard
        disabled={disabled}
        name={attachment.file.name}
        onRemove={onRemove}
        size={attachment.file.size}
        variant="input"
      />
    </motion.div>
  )
}

function AiHistoryPanel({
  activeId,
  autoCollapsed,
  collapsed,
  loading,
  sessions,
  width,
  onCollapsedChange,
  onNew,
  onOpen,
  onWidthChange,
}: {
  activeId: string | null
  autoCollapsed: boolean
  collapsed: boolean
  loading: boolean
  sessions: AiProblemSession[]
  width: number
  onCollapsedChange: (collapsed: boolean) => void
  onNew: () => void
  onOpen: (id: string) => void
  onWidthChange: (width: number) => void
}) {
  const startResizing = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = width

    const handlePointerMove = (moveEvent: PointerEvent) => {
      onWidthChange(clampHistoryPanelWidth(startWidth + moveEvent.clientX - startX))
    }
    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
  }

  return (
    <>
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.aside
            animate={{ opacity: 1, x: 0 }}
            className="fixed bottom-4 left-4 top-20 z-30 hidden flex-col rounded-lg border border-black/10 bg-[var(--app-menu-bg)] px-3 pb-3 pt-3 shadow-xl backdrop-blur-xl dark:border-white/10 lg:flex"
            exit={{ opacity: 0, x: -(width + 32), transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] } }}
            initial={{ opacity: 0, x: -(width + 20) }}
            style={{ width }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
          <History className="h-4 w-4 text-brand-700 dark:text-brand-300" />
          历史对话
        </div>
        <div className="flex items-center gap-1">
          <button
            aria-label="新对话"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-black/10 text-slate-600 transition hover:bg-white hover:text-slate-950 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
            onClick={onNew}
            title="新对话"
            type="button"
          >
            <MessageSquarePlus className="h-4 w-4" />
          </button>
          <button
            aria-label="折叠历史对话"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-black/10 text-slate-600 transition hover:bg-white hover:text-slate-950 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
            onClick={() => onCollapsedChange(true)}
            title="折叠历史对话"
            type="button"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="ai-chat-input-scroll mt-4 min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
        {loading ? <p className="px-2 py-3 text-xs text-slate-500 dark:text-slate-400">正在加载...</p> : null}
        {!loading && sessions.length === 0 ? <p className="px-2 py-3 text-xs text-slate-500 dark:text-slate-400">暂无历史对话</p> : null}
        {sessions.map((session) => {
          const active = activeId === session.id
          return (
            <button
              className={`w-full rounded-lg px-3 py-2 text-left transition ${active ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-700 hover:bg-white dark:text-slate-300 dark:hover:bg-white/10'}`}
              key={session.id}
              onClick={() => onOpen(session.id)}
              type="button"
            >
              <span className="block truncate text-sm font-medium">{session.title || session.initialQuestion || '新问题会话'}</span>
              <span className={`mt-1 block text-xs ${active ? 'text-white/75' : 'text-slate-400'}`}>
                {formatSessionStatus(session.status)} · {formatHistoryTime(session.updatedAt)}
              </span>
            </button>
          )
        })}
      </div>
      <div
        aria-label="调整历史对话宽度"
        className="absolute inset-y-0 right-0 flex w-3 cursor-col-resize touch-none items-center justify-center text-slate-400 transition hover:bg-[var(--app-panel-muted-bg)] hover:text-slate-700 dark:hover:bg-white/[0.06] dark:hover:text-slate-200"
        onPointerDown={startResizing}
        role="separator"
        title="拖动调整宽度"
      >
        <GripVertical className="h-4 w-4" />
      </div>
          </motion.aside>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {collapsed && !autoCollapsed && (
          <motion.button
            aria-label="展开历史对话"
            animate={{ opacity: 1, scale: 1, x: 0 }}
            className="fixed left-4 top-20 z-30 hidden h-10 w-10 items-center justify-center rounded-lg border border-black/10 bg-[var(--app-menu-bg)] text-slate-600 shadow-lg backdrop-blur-xl transition hover:bg-white hover:text-slate-950 dark:border-white/10 dark:text-slate-300 dark:hover:bg-[var(--app-panel-muted-bg)] dark:hover:text-white lg:inline-flex"
            exit={{ opacity: 0, scale: 0.94, x: -8, transition: { duration: 0.18 } }}
            initial={{ opacity: 0, scale: 0.94, x: -8 }}
            onClick={() => onCollapsedChange(false)}
            title="展开历史对话"
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            type="button"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </motion.button>
        )}
      </AnimatePresence>
    </>
  )
}

function MobileHistoryBar({
  activeId,
  loading,
  sessions,
  showAtDesktop = false,
  onNew,
  onOpen,
}: {
  activeId: string | null
  loading: boolean
  sessions: AiProblemSession[]
  showAtDesktop?: boolean
  onNew: () => void
  onOpen: (id: string) => void
}) {
  return (
    <div className={`mb-4 ${showAtDesktop ? '' : 'lg:hidden'}`}>
      <div className="flex items-center gap-2">
        <button
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-black/10 bg-[var(--app-panel-bg)] px-3 text-sm font-medium text-slate-700 backdrop-blur-md dark:border-white/10 dark:bg-white/10 dark:text-slate-200"
          onClick={onNew}
          type="button"
        >
          <MessageSquarePlus className="h-4 w-4" />
          新对话
        </button>
        <div className="ai-chat-input-scroll flex min-w-0 flex-1 gap-2 overflow-x-auto">
          {loading ? <span className="shrink-0 rounded-lg bg-[var(--app-panel-muted-bg)] px-3 py-2 text-xs text-slate-500 dark:bg-white/[0.06] dark:text-slate-400">加载中</span> : null}
          {sessions.slice(0, 12).map((session) => (
            <button
              className={`max-w-48 shrink-0 truncate rounded-lg px-3 py-2 text-xs ${activeId === session.id ? 'bg-brand-600 text-white' : 'bg-[var(--app-panel-muted-bg)] text-slate-600 dark:bg-white/[0.06] dark:text-slate-300'}`}
              key={session.id}
              onClick={() => onOpen(session.id)}
              type="button"
            >
              {session.title || session.initialQuestion || '历史对话'}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function formatSessionStatus(status: AiProblemSession['status']) {
  const labels: Record<string, string> = {
    ACTIVE: '进行中',
    APPROVED_TO_KB: '已入库',
    ARCHIVED: '已归档',
    AWAITING_RESOLUTION: '待确认',
    DISCARDED: '已丢弃',
    READY_REVIEW: '待审核',
    RESOLVED: '已解决',
    SKILL_CANDIDATE: 'Skill 候选',
  }
  return labels[status] ?? status
}

function formatHistoryTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('zh-CN', { day: '2-digit', hour: '2-digit', minute: '2-digit', month: '2-digit' })
}

function ProblemSessionResolutionCard({
  busy,
  error,
  onContinue,
  onSnooze,
  onResolve,
}: {
  busy: 'RESOLVE' | 'SNOOZE' | 'CONTINUE' | null
  error: string
  onContinue: () => void
  onSnooze: () => void
  onResolve: () => void
}) {
  return (
    <motion.aside
      animate={{ opacity: 1, y: 0 }}
      className="mb-5 flex flex-col gap-4 rounded-lg border border-brand-600/20 bg-[var(--app-panel-bg)] px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between"
      initial={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-600/10 text-brand-700 dark:text-brand-300"><Bot className="h-4 w-4" /></div>
        <div>
          <h2 className="text-sm font-semibold text-slate-950 dark:text-white">这个问题解决了吗？</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">确认后才进入总结和沉淀审核；稍后再问会在 7 天内不再提醒。</p>
          {error ? <p className="mt-1 text-xs leading-5 text-red-600 dark:text-red-300">{error}</p> : null}
        </div>
      </div>
      <div className="grid shrink-0 grid-cols-3 gap-2 sm:flex">
        <button className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-brand-700 disabled:opacity-60" disabled={busy !== null} onClick={onResolve} type="button">{busy === 'RESOLVE' ? '处理中' : '已解决'}</button>
        <button className="rounded-lg border border-black/10 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-black/5 disabled:opacity-60 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10" disabled={busy !== null} onClick={onSnooze} type="button">{busy === 'SNOOZE' ? '设置中' : '稍后再问'}</button>
        <button className="rounded-lg border border-black/10 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-black/5 disabled:opacity-60 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10" disabled={busy !== null} onClick={onContinue} type="button">{busy === 'CONTINUE' ? '继续中' : '继续'}</button>
      </div>
    </motion.aside>
  )
}

function UserMessageBubble({ attachment, content }: { attachment?: ChatAttachment; content: string }) {
  return (
    <div className="space-y-2 rounded-lg bg-brand-600 px-4 py-3 text-sm leading-7 text-white shadow-sm">
      {attachment && (
        <AttachmentCard
          name={attachment.name}
          size={attachment.size}
          variant="sent"
        />
      )}
      {content && <div className="whitespace-pre-wrap">{content}</div>}
    </div>
  )
}

function MessageCopyButton({ align, content }: { align: 'left' | 'right'; content: string }) {
  const [copied, setCopied] = useState(false)
  const disabled = !content.trim()

  const handleCopy = async () => {
    if (disabled) return
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className={`mt-1.5 flex ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
      <button
        aria-label={copied ? '已复制本条消息' : '复制本条消息'}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-[var(--app-panel-muted-bg)] hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-500 dark:hover:bg-white/[0.06] dark:hover:text-slate-200"
        disabled={disabled}
        onClick={handleCopy}
        type="button"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  )
}

function AssistantMessageActions({
  assistantTurnId,
  content,
  disabled,
  feedback: initialFeedback,
  onFeedbackChange,
  onRegenerate,
  sessionId,
}: {
  assistantTurnId?: string
  content: string
  disabled?: boolean
  feedback?: AiTurnFeedbackRating | null
  onFeedbackChange?: (rating: AiTurnFeedbackRating) => void
  onRegenerate: () => void
  sessionId?: string
}) {
  const [copied, setCopied] = useState(false)
  const [feedback, setFeedback] = useState<AiTurnFeedbackRating | null>(initialFeedback ?? null)
  const [feedbackBusy, setFeedbackBusy] = useState(false)
  const copyDisabled = !content.trim()

  useEffect(() => {
    setFeedback(initialFeedback ?? null)
  }, [initialFeedback])

  const handleCopy = async () => {
    if (copyDisabled) return
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  const handleFeedback = async (next: AiTurnFeedbackRating) => {
    const target = feedback === next ? 'CLEARED' : next
    setFeedback(target === 'CLEARED' ? null : target)
    onFeedbackChange?.(target)
    if (!sessionId || !assistantTurnId) return
    setFeedbackBusy(true)
    try {
      await submitAiTurnFeedback(sessionId, assistantTurnId, { rating: target })
    } catch {
      setFeedback(feedback)
      if (feedback) onFeedbackChange?.(feedback)
    } finally {
      setFeedbackBusy(false)
    }
  }

  return (
    <div className="mt-1.5 flex justify-start">
      <div className="inline-flex items-center gap-1">
        <IconActionButton
          active={copied}
          ariaLabel={copied ? '已复制本条消息' : '复制本条消息'}
          disabled={copyDisabled}
          onClick={handleCopy}
          title={copied ? '已复制' : '复制'}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </IconActionButton>
        <IconActionButton
          active={feedback === 'UP'}
          ariaLabel="点赞"
          disabled={feedbackBusy}
          onClick={() => void handleFeedback('UP')}
          title="点赞"
        >
          <ThumbsUp className="h-3.5 w-3.5" />
        </IconActionButton>
        <IconActionButton
          active={feedback === 'DOWN'}
          ariaLabel="点踩"
          disabled={feedbackBusy}
          onClick={() => void handleFeedback('DOWN')}
          title="点踩"
        >
          <ThumbsDown className="h-3.5 w-3.5" />
        </IconActionButton>
        <IconActionButton
          active={feedback === 'REPORT'}
          ariaLabel="举报"
          disabled={feedbackBusy}
          onClick={() => void handleFeedback('REPORT')}
          title="举报"
        >
          <Shield className="h-3.5 w-3.5" />
        </IconActionButton>
        <IconActionButton
          ariaLabel="重新生成"
          disabled={disabled}
          onClick={onRegenerate}
          title="重新生成"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </IconActionButton>
      </div>
    </div>
  )
}

function IconActionButton({
  active,
  ariaLabel,
  children,
  disabled,
  onClick,
  title,
}: {
  active?: boolean
  ariaLabel: string
  children: ReactNode
  disabled?: boolean
  onClick: () => void
  title: string
}) {
  return (
    <button
      aria-label={ariaLabel}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition disabled:cursor-not-allowed disabled:opacity-50 ${
        active
          ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
          : 'text-slate-400 hover:bg-[var(--app-panel-muted-bg)] hover:text-slate-700 dark:text-slate-500 dark:hover:bg-white/[0.06] dark:hover:text-slate-200'
      }`}
      disabled={disabled}
      onClick={onClick}
      title={title}
      type="button"
    >
      {children}
    </button>
  )
}

function AttachmentCard({
  disabled,
  name,
  onRemove,
  size,
  variant,
}: {
  disabled?: boolean
  name: string
  onRemove?: () => void
  size: number
  variant: 'input' | 'sent'
}) {
  const isSent = variant === 'sent'

  return (
    <div
      className={`relative flex max-w-full items-center gap-3 rounded-lg border py-2 pl-3 pr-10 shadow-sm ${
        isSent
          ? 'border-white/20 bg-white/12 text-white'
          : 'border-brand-200/70 bg-white/80 text-slate-900 dark:border-brand-400/20 dark:bg-white/[0.06] dark:text-white'
      }`}
    >
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
          isSent
            ? 'bg-white/15 text-white'
            : 'bg-brand-50 text-brand-700 dark:bg-brand-900/35 dark:text-brand-200'
        }`}
      >
        <Paperclip className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="max-w-[280px] truncate text-sm font-medium md:max-w-[360px]">{name}</p>
        <p className={`mt-0.5 text-xs ${isSent ? 'text-white/70' : 'text-slate-500 dark:text-slate-400'}`}>
          {formatFileSize(size)}
        </p>
      </div>
      {onRemove && (
        <button
          aria-label="移除附件"
          className={`absolute right-1.5 top-1.5 rounded-full p-1 transition disabled:cursor-not-allowed disabled:opacity-50 ${
            isSent
              ? 'text-white/70 hover:bg-white/15 hover:text-white'
              : 'text-slate-400 hover:bg-black/5 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white'
          }`}
          disabled={disabled}
          onClick={onRemove}
          type="button"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

function isReportDraftIntent(content: string) {
  return /提交|创建.*(漏洞|报告|草稿)|自动填写|填报|导入|漏洞草稿|报告草稿|提交卡片|拆成.*漏洞|生成.*(漏洞|报告|提交|草稿)/.test(content)
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

// ════════════════════════════════════════════════════════════
// AI 回复面板 / 富文本渲染
// ════════════════════════════════════════════════════════════

function AssistantMessageBubble({
  actions,
  cards,
  content,
  getReportAttachmentFile,
  knowledgeSources,
  reportDrafts,
  usedKnowledge,
}: {
  actions?: AiPendingAction[]
  cards?: AiCard[]
  content: string
  getReportAttachmentFile?: (draftId: string) => File | undefined
  knowledgeSources?: AiChatResponse['knowledgeSources']
  reportDrafts?: AiVulnerabilityDraft[]
  usedKnowledge?: boolean
}) {
  const hasCards = Boolean(cards?.length)
  const hasReportDrafts = Boolean(reportDrafts?.length)
  const visibleSources = (knowledgeSources ?? []).slice(0, 3)
  const [redeemedProducts, setRedeemedProducts] = useState<Record<string, { note?: string; pickupCode?: string; pointsCost: number }>>({})
  const spentInThisMessage = Object.values(redeemedProducts).reduce((sum, item) => sum + item.pointsCost, 0)

  const handleRedeemed = (productId: string, result: { note?: string; pickupCode?: string; pointsCost: number }) => {
    setRedeemedProducts((current) => ({ ...current, [productId]: result }))
  }

  return (
    <div className="overflow-hidden rounded-lg border border-black/10 bg-[var(--app-panel-bg)] shadow-sm backdrop-blur-xl dark:border-white/10">
      {content && (
        <div className="px-4 py-3">
          <RichAssistantContent content={content} />
        </div>
      )}

      {hasReportDrafts && <ReportDraftCards drafts={reportDrafts ?? []} getAttachmentFile={getReportAttachmentFile} />}

      {hasCards && (
        <div className="px-4 pb-4">
          <div className="rounded-lg border border-black/10 bg-[var(--app-panel-muted-bg)] p-3 shadow-sm dark:border-white/10 ">
            <div className="mb-3 flex items-center justify-end">
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

      {(usedKnowledge || visibleSources.length > 0) && (
        <div className="border-t border-black/5 px-4 py-2 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-slate-600 dark:text-slate-300">参考平台知识库</span>
            {visibleSources.map((source) => (
              <span
                className="rounded-md border border-black/10 px-2 py-0.5 dark:border-white/10"
                key={source.id}
                title={`置信度 ${Math.round(source.confidence * 100)}%`}
              >
                {source.title}
              </span>
            ))}
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
    const className = getHighlightClassName(token)

    nodes.push(<span className={className} key={`token-${key++}`}>{token}</span>)
    lastIndex = tokenRegex.lastIndex
  }

  if (lastIndex < code.length) nodes.push(<span key={`plain-${key}`}>{code.slice(lastIndex)}</span>)
  return nodes
}

function getHighlightClassName(token: string) {
  if (token.startsWith('//') || token.startsWith('#')) return 'text-neutral-600'
  if (token.startsWith('"') || token.startsWith("'") || token.startsWith('`')) return 'text-neutral-400'
  if (/^\d/.test(token)) return 'text-neutral-200'
  return 'text-neutral-100'
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
        <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.92em] text-brand-700 dark:bg-white/10 dark:text-brand-300" key={index}>
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
// 报告导入后的漏洞草稿卡片
// ════════════════════════════════════════════════════════════

type DraftSubmitState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { reportNo: string; status: 'submitted' }
  | { message: string; status: 'error' }

type ConfirmDraftState = {
  draft: AiVulnerabilityDraft
  index: number
} | null

const severityOptions = [
  { label: '极高', value: 'CRITICAL' },
  { label: '高', value: 'HIGH' },
  { label: '中', value: 'MEDIUM' },
  { label: '低', value: 'LOW' },
  { label: '信息', value: 'INFO' },
]

function ReportDraftCards({ drafts, getAttachmentFile }: { drafts: AiVulnerabilityDraft[]; getAttachmentFile?: (draftId: string) => File | undefined }) {
  const [editableDrafts, setEditableDrafts] = useState<AiVulnerabilityDraft[]>(drafts)
  const [submitStates, setSubmitStates] = useState<Record<string, DraftSubmitState>>({})
  const [confirming, setConfirming] = useState<ConfirmDraftState>(null)
  const [accessStatus, setAccessStatus] = useState<AccessStatus | null>(null)

  useEffect(() => {
    let active = true
    getAccessStatus()
      .then((status) => { if (active) setAccessStatus(status) })
      .catch(() => { /* 后端提交接口仍会强制校验 */ })
    return () => { active = false }
  }, [])

  const updateDraft = (draftId: string, patch: Partial<AiVulnerabilityDraft>) => {
    setEditableDrafts((current) =>
      current.map((draft) => (draft.id === draftId ? withComputedDraftFields({ ...draft, ...patch }) : draft)),
    )
  }

  const submitDraft = async (draft: AiVulnerabilityDraft) => {
    if (accessStatus && !accessStatus.canSubmitVulnerability) {
      setSubmitStates((current) => ({
        ...current,
        [draft.id]: { message: accessStatus.missingRequirements[0] ?? '请先完成责任书签署和安全答题后再提交漏洞', status: 'error' },
      }))
      return
    }

    const missing = getDraftMissingFields(draft)
    if (missing.length > 0) {
      setSubmitStates((current) => ({
        ...current,
        [draft.id]: { message: `请先补全：${missing.join('、')}`, status: 'error' },
      }))
      return
    }

    const attachmentFile = getAttachmentFile?.(draft.id)
    if (!attachmentFile) {
      setSubmitStates((current) => ({
        ...current,
        [draft.id]: { message: '缺少原始报告附件，请重新上传 PDF 后再从新生成的卡片提交。', status: 'error' },
      }))
      return
    }

    const payload: CreateVulnerabilityPayload = {
      assetName: draft.assetName.trim(),
      assetUrl: draft.assetUrl?.trim() || undefined,
      detailMarkdown: buildDraftMarkdown(draft),
      ownerUnit: draft.ownerUnit?.trim() || undefined,
      selfSeverity: draft.selfSeverity,
      title: draft.title.trim(),
      vulnerabilityType: draft.vulnerabilityType.trim(),
    }

    try {
      setSubmitStates((current) => ({ ...current, [draft.id]: { status: 'submitting' } }))
      const result = await createVulnerability(payload)
      if (attachmentFile) {
        await uploadVulnerabilityAttachment(result.id, attachmentFile)
      }
      setSubmitStates((current) => ({ ...current, [draft.id]: { reportNo: result.reportNo, status: 'submitted' } }))
    } catch (error) {
      setSubmitStates((current) => ({
        ...current,
        [draft.id]: { message: error instanceof Error ? error.message : '提交失败，请稍后重试', status: 'error' },
      }))
    }
  }

  return (
    <div className="px-4 pb-4">
      <div className="rounded-lg border border-black/10 bg-[var(--app-panel-muted-bg)] p-3 shadow-sm dark:border-white/10 ">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">从报告识别到 {editableDrafts.length} 个漏洞草稿</p>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">空字段会提示补全，提交前需二次确认</p>
        </div>

        <div className="space-y-3">
          {editableDrafts.map((draft, index) => {
            const missing = getDraftMissingFields(draft)
            const state = submitStates[draft.id] ?? { status: 'idle' }
            const disabled = state.status === 'submitting' || state.status === 'submitted'
            const attachmentFile = getAttachmentFile?.(draft.id)
            return (
              <div className="rounded-lg border border-black/10 bg-[var(--app-panel-bg)] p-4 shadow-sm dark:border-white/10" key={draft.id}>
                <div className="mb-3 flex flex-col gap-2 border-b border-black/10 pb-3 dark:border-white/10 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-brand-700 dark:text-brand-300">漏洞 {index + 1}</p>
                    <input
                      className="mt-1 w-full rounded-lg border border-black/10 bg-[var(--app-panel-bg)] px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-brand-500 dark:border-white/10 dark:text-white"
                      onChange={(event) => updateDraft(draft.id, { title: event.target.value })}
                      placeholder="漏洞标题"
                      value={draft.title}
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {missing.length > 0 ? (
                      missing.map((field) => (
                        <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-200" key={field}>
                          缺 {field}
                        </span>
                      ))
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">字段完整</span>
                    )}
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <DraftTextInput label="影响资产" value={draft.assetName} onChange={(value) => updateDraft(draft.id, { assetName: value })} />
                  <DraftTextInput label="资产 URL" value={draft.assetUrl ?? ''} onChange={(value) => updateDraft(draft.id, { assetUrl: value })} />
                  <SelectInput
                    label="漏洞类型"
                    onChange={(value) => updateDraft(draft.id, { vulnerabilityType: value })}
                    options={[{ label: '留空，手动选择', value: '' }, ...vulnerabilityTypes]}
                    placeholder="留空，手动选择"
                    value={draft.vulnerabilityType}
                  />
                  <SelectInput
                    label="自评等级"
                    onChange={(value) => updateDraft(draft.id, { selfSeverity: value })}
                    options={[{ label: '留空，手动选择', value: '' }, ...severityOptions]}
                    placeholder="留空，手动选择"
                    value={draft.selfSeverity}
                  />
                  <DraftTextInput label="责任单位/定级单元（可选）" value={draft.ownerUnit ?? ''} onChange={(value) => updateDraft(draft.id, { ownerUnit: value })} />
                  <DraftTextInput label="测试边界（可选）" value={draft.testBoundary ?? ''} onChange={(value) => updateDraft(draft.id, { testBoundary: value })} />
                </div>

                <div className="mt-3 grid gap-3">
                  <DraftTextArea label="复现步骤" value={draft.reproductionSteps} onChange={(value) => updateDraft(draft.id, { reproductionSteps: value })} />
                  <DraftTextArea label="影响评估" value={draft.impactAssessment} onChange={(value) => updateDraft(draft.id, { impactAssessment: value })} />
                  <DraftTextArea label="修复建议" value={draft.repairSuggestion} onChange={(value) => updateDraft(draft.id, { repairSuggestion: value })} />
                </div>

                <div className="mt-3 flex flex-col gap-2 border-t border-black/10 pt-3 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {state.status === 'submitted'
                      ? `已提交：${state.reportNo}，原始报告附件已随漏洞记录归档。`
                      : state.status === 'error'
                        ? state.message
                        : attachmentFile
                          ? `将随漏洞一同上传附件：${attachmentFile.name}`
                          : '请确认报告信息、测试授权边界与复现内容准确无误。刷新页面后需重新上传附件才能随漏洞归档。'}
                  </p>
                  <button
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-white/15"
                    disabled={disabled}
                    onClick={() => setConfirming({ draft, index })}
                    type="button"
                  >
                    <Shield className="h-4 w-4" />
                    {state.status === 'submitting' ? '提交中...' : state.status === 'submitted' ? '已提交' : '确认提交'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {confirming && (
            <motion.div
              animate={{ opacity: 1 }}
              className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/35 px-4 backdrop-blur-sm"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              key="report-draft-confirm-modal"
              onClick={() => setConfirming(null)}
            >
              <motion.div
                animate={{ scale: 1, y: 0 }}
                className="w-full max-w-lg rounded-lg border border-black/10 bg-[var(--app-menu-bg)] p-5 shadow-2xl dark:border-white/10"
                exit={{ scale: 0.98, y: 8 }}
                initial={{ scale: 0.98, y: 8 }}
                onClick={(event) => event.stopPropagation()}
              >
                <p className="text-sm font-semibold text-slate-900 dark:text-white">二次确认提交漏洞 {confirming.index + 1}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  提交后将进入平台漏洞审核流程。请确认该漏洞在授权范围内，复现步骤和影响描述真实准确，且未包含越权测试内容。
                </p>
                <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm ">
                  <p className="font-medium text-slate-900 dark:text-white">{confirming.draft.title || '未填写标题'}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{confirming.draft.assetName || '未填写影响资产'}</p>
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <button className="rounded-lg border border-black/10 px-4 py-2 text-sm text-slate-600 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10" onClick={() => setConfirming(null)} type="button">
                    返回检查
                  </button>
                  <button
                    className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
                    onClick={() => {
                      const draft = confirming.draft
                      setConfirming(null)
                      void submitDraft(draft)
                    }}
                    type="button"
                  >
                    确认无误并提交
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  )
}

function DraftTextInput({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
      <input
        className="mt-1 w-full rounded-lg border border-black/10 bg-[var(--app-panel-bg)] px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-500 dark:border-white/10 dark:text-white"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </label>
  )
}

function DraftTextArea({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
      <textarea
        className="mt-1 min-h-24 w-full resize-y rounded-lg border border-black/10 bg-[var(--app-panel-bg)] px-3 py-2 text-sm leading-6 text-slate-900 outline-none transition focus:border-brand-500 dark:border-white/10 dark:text-white"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </label>
  )
}

function withComputedDraftFields(draft: AiVulnerabilityDraft): AiVulnerabilityDraft {
  return {
    ...draft,
    detailMarkdown: buildDraftMarkdown(draft),
    missingFields: getDraftMissingFields(draft),
  }
}

function getDraftMissingFields(draft: AiVulnerabilityDraft) {
  const missing: string[] = []
  if (!draft.title?.trim()) missing.push('漏洞标题')
  if (!draft.assetName?.trim()) missing.push('影响资产')
  if (!draft.vulnerabilityType?.trim() || !vulnerabilityTypes.includes(draft.vulnerabilityType as (typeof vulnerabilityTypes)[number])) missing.push('漏洞类型')
  if (!draft.selfSeverity?.trim()) missing.push('自评等级')
  if (!draft.reproductionSteps?.trim() || draft.reproductionSteps.trim().length < 10) missing.push('复现步骤')
  if (!draft.impactAssessment?.trim() || draft.impactAssessment.trim().length < 10) missing.push('影响评估')
  if (!draft.repairSuggestion?.trim() || draft.repairSuggestion.trim().length < 6) missing.push('修复建议')
  return missing
}

function buildDraftMarkdown(draft: AiVulnerabilityDraft) {
  const testBoundary = draft.testBoundary?.trim()
    || '本次测试仅在学校授权范围内进行，未进行未授权扫描、爆破、数据下载、权限维持、后门植入或影响业务运行的操作。'
  const proof = draft.detailMarkdown?.trim()
    ? `已上传原始报告作为利用证明附件。AI 根据报告内容整理的关键证据：\n\n${draft.detailMarkdown.trim()}`
    : '已上传原始报告作为利用证明附件，请审核员结合附件核验证据。'

  return [
    '## 【漏洞标题】',
    draft.title?.trim() || '',
    '',
    '## 【影响资产】',
    draft.assetName?.trim() || '',
    draft.assetUrl?.trim() ? `\n资产 URL：${draft.assetUrl.trim()}` : '',
    '',
    '## 【漏洞描述】',
    draft.impactAssessment?.trim()
      ? `AI 根据报告内容判断：${draft.impactAssessment.trim()}`
      : '',
    '',
    '## 【复现步骤】',
    normalizeSteps(draft.reproductionSteps),
    '',
    '## 【利用证明】',
    proof,
    '',
    '## 【影响评估】',
    draft.impactAssessment?.trim() || '',
    '',
    '## 【修复建议】',
    draft.repairSuggestion?.trim() || '',
    '',
    '## 【测试边界说明】',
    testBoundary,
  ].join('\n').replace(/\n{3,}/g, '\n\n').trim() || markdownTemplate
}

function normalizeSteps(value: string) {
  const text = value?.trim()
  if (!text) return '1. \n2. \n3. '
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)
  if (lines.some((line) => /^\d+[.、]/.test(line))) {
    return lines.join('\n')
  }
  if (lines.length > 1) {
    return lines.map((line, index) => `${index + 1}. ${line.replace(/^[-*]\s*/, '')}`).join('\n')
  }
  return `1. ${text}`
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

function LearningResourceCard({ action, card }: { card: AiCard & { type: 'LEARNING_RESOURCE' }; action?: AiPendingAction }) {
  const [openState, setOpenState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [openError, setOpenError] = useState('')
  const resourceId = typeof action?.payload?.resourceId === 'string' ? action.payload.resourceId : card.id
  const actionLabel = card.kind === 'RANGE' ? '进入靶场' : card.actionLabel || '查看资源'

  const handleOpen = async () => {
    setOpenState('loading')
    setOpenError('')
    const popup = window.open('about:blank', '_blank')
    if (popup) {
      popup.opener = null
      popup.document.title = card.kind === 'RANGE' ? '正在进入靶场...' : '正在访问资源...'
      popup.document.body.innerHTML = '<p style="font-family: system-ui, sans-serif; padding: 24px; color: var(--app-text, #475569);">正在打开资源，请稍候...</p>'
    }

    try {
      const result = await clickLearningResource(resourceId)
      if (popup) {
        popup.location.href = result.url
      } else {
        window.open(result.url, '_blank', 'noopener,noreferrer')
      }
      setOpenState('idle')
    } catch (error) {
      popup?.close()
      setOpenError(error instanceof Error ? error.message : '资源访问失败，请稍后重试')
      setOpenState('error')
    }
  }

  return (
    <div className="flex h-full flex-col rounded-lg border border-black/10 bg-white/80 p-4 shadow-sm backdrop-blur-xl dark:border-white/10 ">
      <div className="flex flex-1 items-start gap-3">
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
      <div className="mt-auto flex gap-2 pt-3">
        <button
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-white/15"
          disabled={openState === 'loading'}
          onClick={() => void handleOpen()}
          type="button"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          {openState === 'loading' ? '打开中...' : actionLabel}
        </button>
      </div>
      {openState === 'error' && openError && (
        <p className="mt-2 text-xs leading-5 text-red-500 dark:text-red-300">{openError}</p>
      )}
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
        : 'border-black/10 bg-[var(--app-panel-bg)] dark:border-white/10'
    }`}>
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100 ">
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
            ? 'bg-[var(--app-menu-bg)] text-brand-700 dark:text-brand-300'
            : 'bg-[var(--app-menu-bg)] text-slate-500 dark:text-slate-300'
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
          <div className="rounded-lg bg-white/80 px-2.5 py-2 text-slate-600 ring-1 ring-black/5  dark:text-slate-300 dark:ring-white/10">
            <span className="block whitespace-nowrap text-[10px] text-slate-400">库存</span>
            <strong className="block truncate">{displayedStock} 件</strong>
          </div>
          <div className="rounded-lg bg-white/80 px-2.5 py-2 text-slate-600 ring-1 ring-black/5  dark:text-slate-300 dark:ring-white/10">
            <span className="block whitespace-nowrap text-[10px] text-slate-400">积分</span>
            <strong className="block truncate">{displayedBalance.toLocaleString('zh-CN')}</strong>
          </div>
          <div className="rounded-lg bg-white/80 px-2.5 py-2 text-slate-600 ring-1 ring-black/5  dark:text-slate-300 dark:ring-white/10">
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
          <div className="rounded-lg border border-brand-200 bg-[var(--app-panel-bg)] p-3 text-xs shadow-sm dark:border-brand-800/40">
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
    <div className={`flex h-full flex-col rounded-lg border p-4 shadow-sm transition ${
      card.needsSupplement
        ? 'border-amber-300/50 bg-amber-50/80 dark:border-amber-700/40 dark:bg-amber-950/20'
        : 'border-black/10 bg-[var(--app-panel-bg)] dark:border-white/10'
    }`}>
      <div className="flex flex-1 items-start gap-3">
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
            <span className="rounded-full bg-[var(--app-panel-bg)] px-2 py-0.5 text-[11px] text-slate-500 ring-1 ring-black/5  dark:text-slate-400 dark:ring-white/10">
              {card.severity}
            </span>
          </div>
          <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{card.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {card.needsSupplement ? '该报告需要补充材料，建议优先完善复现步骤、影响范围和附件证据。' : '可以进入详情页查看审核进度、报告内容和证书状态。'}
          </p>
        </div>
      </div>
      <div className="mt-auto flex flex-wrap gap-2 pt-3">
        <a
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
            card.needsSupplement
              ? 'bg-amber-600 text-white hover:bg-amber-700'
              : 'border border-black/10 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10  dark:text-slate-300 dark:hover:bg-white/[0.08]'
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
        <img alt="邮宝头像" className="h-full w-full object-cover" src={avatarUrl} />
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
        <span>AI 额度仅剩 {remainingPercent}%，回复可能中断</span>
        <button
          aria-label="关闭额度提醒"
          className="ml-3 flex h-6 w-6 shrink-0 items-center justify-center rounded-md opacity-70 transition hover:bg-red-500/10 hover:opacity-100"
          onClick={() => onDismiss('5')}
          type="button"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  if (remainingPercent <= 20 && dismissed !== '20' && dismissed !== '5') {
    return (
      <div className="mb-2 flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800/40 dark:bg-amber-950/20 dark:text-amber-300">
        <span>AI 额度剩余 {remainingPercent}%</span>
        <button
          aria-label="关闭额度提醒"
          className="ml-3 flex h-6 w-6 shrink-0 items-center justify-center rounded-md opacity-70 transition hover:bg-amber-500/10 hover:opacity-100"
          onClick={() => onDismiss('20')}
          type="button"
        >
          <X className="h-3.5 w-3.5" />
        </button>
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

function clampHistoryPanelWidth(width: number) {
  return Math.min(HISTORY_PANEL_MAX_WIDTH, Math.max(HISTORY_PANEL_MIN_WIDTH, width))
}

function getHistoryContentInset(viewportWidth: number, panelWidth: number) {
  const horizontalPadding = viewportWidth >= 768 ? 32 : 20
  const pageLeft = Math.max(0, (viewportWidth - 1360) / 2)
  const panelRight = 16 + panelWidth
  const contentLeft = pageLeft + horizontalPadding
  return Math.max(0, Math.ceil(panelRight - contentLeft + 24))
}

function loadHistoryPanelWidth() {
  try {
    const storedWidth = Number(localStorage.getItem(HISTORY_PANEL_WIDTH_STORAGE_KEY))
    return Number.isFinite(storedWidth) && storedWidth > 0 ? clampHistoryPanelWidth(storedWidth) : HISTORY_PANEL_DEFAULT_WIDTH
  } catch {
    return HISTORY_PANEL_DEFAULT_WIDTH
  }
}

function saveHistoryPanelWidth(width: number) {
  try {
    localStorage.setItem(HISTORY_PANEL_WIDTH_STORAGE_KEY, String(clampHistoryPanelWidth(width)))
  } catch {
    // localStorage unavailable - keep the current in-memory width
  }
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

function messagesFromProblemSession(session: AiProblemSession): ChatMessage[] {
  return (session.turns ?? [])
    .filter((turn) => turn.role === 'user' || turn.role === 'assistant')
    .map((turn) => ({
      assistantTurnId: turn.role === 'assistant' ? turn.id : undefined,
      content: turn.content,
      feedback: turn.metadata?.feedback?.rating === 'CLEARED' ? null : turn.metadata?.feedback?.rating,
      knowledgeHitIds: turn.metadata?.knowledgeHitIds,
      knowledgeSources: turn.metadata?.knowledgeSources,
      role: turn.role === 'user' ? 'user' : 'assistant',
      sessionId: session.id,
      usedKnowledge: turn.metadata?.usedKnowledge,
    }))
}
