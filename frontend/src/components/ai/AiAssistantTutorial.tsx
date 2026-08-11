import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'

type TutorialStep = {
  description: string
  selectors?: string[]
  title: string
}

const steps: TutorialStep[] = [
  {
    description: '邮宝可以辅助整理漏洞报告、复现步骤、修复建议和安全学习路径。AI 内容仍需人工核实，并遵守授权测试边界。',
    title: '欢迎使用邮宝',
  },
  {
    description: '这里可以查看旧会话和新建对话。空间不足时历史栏会自动折叠，手机端从顶部入口打开。',
    selectors: ['[data-ai-tutorial="history-desktop"]', '[data-ai-tutorial="history-mobile"]'],
    title: '管理历史对话',
  },
  {
    description: '在模型配置弹窗中选择平台模型，或配置自己的模型供应商和 API Key。教程不会打开弹窗，也不会修改现有配置。',
    selectors: ['[data-ai-tutorial="model"]'],
    title: '选择 AI 模型',
  },
  {
    description: '在 Skill 管理弹窗中选择和固定常用 Skill。一次对话最多启用 3 个，固定后的 Skill 可点击启用，也可拖动排序。',
    selectors: ['[data-ai-tutorial="skills"]'],
    title: '使用 Skill',
  },
  {
    description: '上传 PDF 漏洞报告后，平台先解析文本，再交给 AI 给出修改建议或生成提交草稿。原始附件不会被教程读取或上传。',
    selectors: ['[data-ai-tutorial="attachment"]'],
    title: '分析 PDF 报告',
  },
  {
    description: '在输入框描述问题，按 Enter 或点击发送。教程不会代替你填写内容，也不会产生模型调用和 Token 消耗。',
    selectors: ['[data-ai-tutorial="composer"]'],
    title: '开始对话',
  },
  {
    description: '教程已经完成。以后可以点击页面右上角的“使用教程”重新查看。',
    title: '准备完成',
  },
]

type AiAssistantTutorialProps = {
  onClose: (completed: boolean) => void
}

export function AiAssistantTutorial({ onClose }: AiAssistantTutorialProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const cardRef = useRef<HTMLDivElement | null>(null)
  const titleId = useId()
  const reduceMotion = useReducedMotion()
  const step = steps[stepIndex]

  useLayoutEffect(() => {
    const update = () => setTargetRect(findVisibleTarget(step.selectors)?.getBoundingClientRect() ?? null)
    update()
    const frame = window.requestAnimationFrame(update)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    const target = findVisibleTarget(step.selectors)
    if (target) observer?.observe(target)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
      observer?.disconnect()
    }
  }, [step.selectors])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    cardRef.current?.focus()
    return () => { document.body.style.overflow = previousOverflow }
  }, [])

  useEffect(() => { cardRef.current?.focus() }, [stepIndex])

  const trapFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return
    const focusable = Array.from(cardRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])') ?? [])
    if (focusable.length === 0) { event.preventDefault(); return }
    const first = focusable[0]
    const lastFocusable = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); lastFocusable.focus() }
    else if (!event.shiftKey && document.activeElement === lastFocusable) { event.preventDefault(); first.focus() }
  }

  const last = stepIndex === steps.length - 1
  const cardPosition = getCardPosition(targetRect)

  return createPortal(
    <div className="fixed inset-0 z-[180]" role="presentation">
      <div className="absolute inset-0" />
      <AnimatePresence initial={false} mode="wait">
        {targetRect ? (
          <motion.div
            animate={{ opacity: 1, transform: 'scale(1)' }}
            className="pointer-events-none fixed rounded-[10px] border-2 border-brand-400 bg-transparent shadow-[0_0_0_9999px_rgba(2,8,5,0.58)] dark:border-brand-300"
            data-ai-tutorial-spotlight="true"
            exit={{ opacity: 0, transform: reduceMotion ? 'scale(1)' : 'scale(0.985)' }}
            initial={{ opacity: 0, transform: reduceMotion ? 'scale(1)' : 'scale(0.985)' }}
            key={`${stepIndex}-${Math.round(targetRect.left)}-${Math.round(targetRect.top)}`}
            style={{ height: targetRect.height + 12, left: targetRect.left - 6, top: targetRect.top - 6, width: targetRect.width + 12 }}
            transition={{ duration: reduceMotion ? 0.1 : 0.18, ease: [0.23, 1, 0.32, 1] }}
          />
        ) : (
          <motion.div animate={{ opacity: 1 }} className="absolute inset-0 bg-[rgba(2,8,5,0.58)]" initial={{ opacity: 0 }} key={`backdrop-${stepIndex}`} transition={{ duration: 0.18 }} />
        )}
      </AnimatePresence>

      <AnimatePresence initial={false} mode="wait">
        <motion.div
          aria-labelledby={titleId}
          aria-modal="true"
          animate={{ opacity: 1, transform: 'translateY(0) scale(1)' }}
          className="fixed bottom-4 left-4 right-4 rounded-lg border border-black/10 bg-[var(--app-menu-bg)] p-5 text-slate-900 shadow-2xl outline-none dark:border-white/10 dark:text-white sm:bottom-auto sm:left-auto sm:right-auto sm:w-[380px]"
          data-ai-tutorial-step={stepIndex + 1}
          exit={{ opacity: 0, transform: reduceMotion ? 'translateY(0) scale(1)' : 'translateY(-4px) scale(0.985)' }}
          initial={{ opacity: 0, transform: reduceMotion ? 'translateY(0) scale(1)' : 'translateY(6px) scale(0.985)' }}
          key={stepIndex}
          onKeyDown={trapFocus}
          ref={cardRef}
          role="dialog"
          style={cardPosition}
          tabIndex={-1}
          transition={{ duration: reduceMotion ? 0.1 : 0.22, ease: [0.23, 1, 0.32, 1] }}
        >
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs font-semibold text-brand-700 dark:text-brand-200">{stepIndex + 1} / {steps.length}</span>
            <span className="text-xs text-slate-400">AI 助手教程</span>
          </div>
          <h2 className="mt-3 text-lg font-semibold" id={titleId}>{step.title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{step.description}</p>
          <div className="mt-5 flex items-center justify-between gap-3">
            <button className="rounded-lg px-2 py-2 text-sm text-slate-500 transition-[color,background-color,transform] duration-150 hover:bg-black/5 hover:text-slate-900 active:scale-[0.97] dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white" onClick={() => onClose(false)} type="button">跳过教程</button>
            <div className="flex gap-2">
              {stepIndex > 0 ? <button className="rounded-lg border border-black/10 px-4 py-2 text-sm font-medium transition-[background-color,transform] duration-150 hover:bg-black/5 active:scale-[0.97] dark:border-white/10 dark:hover:bg-white/10" onClick={() => setStepIndex((value) => value - 1)} type="button">上一步</button> : null}
              <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-brand-700 active:scale-[0.97]" onClick={() => last ? onClose(true) : setStepIndex((value) => value + 1)} type="button">{last ? '开始使用' : '下一步'}</button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>,
    document.body,
  )
}

function findVisibleTarget(selectors: string[] | undefined) {
  if (!selectors) return null
  for (const selector of selectors) {
    const targets = Array.from(document.querySelectorAll<HTMLElement>(selector))
    const visible = targets.find((target) => {
      const rect = target.getBoundingClientRect()
      const style = window.getComputedStyle(target)
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
    })
    if (visible) return visible
  }
  return null
}

function getCardPosition(rect: DOMRect | null): CSSProperties | undefined {
  if (typeof window === 'undefined') return undefined
  if (window.innerWidth < 640) {
    return rect && rect.bottom > window.innerHeight * 0.58 ? { bottom: 'auto', top: 16 } : undefined
  }
  if (!rect) return { left: Math.max(16, (window.innerWidth - 380) / 2), top: Math.max(16, (window.innerHeight - 250) / 2) }
  const width = 380
  const estimatedHeight = 250
  const left = Math.min(Math.max(16, rect.left), window.innerWidth - width - 16)
  const below = rect.bottom + 16
  const top = below + estimatedHeight <= window.innerHeight ? below : Math.max(16, rect.top - estimatedHeight - 16)
  return { left, top }
}
