import { ArrowUp, Bot, Paperclip, Sparkles, User } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'

export function UserAIAssistant() {
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([])
  const [input, setInput] = useState('')
  const hasStarted = messages.length > 0

  const sendMessage = () => {
    const content = input.trim()
    if (!content) return

    setMessages((current) => [
      ...current,
      { role: 'user', content },
      {
        role: 'assistant',
        content: '这是前端演示回复。后续接入后端智能体后，我会基于漏洞报告、学习资源和平台规则给出更具体的分析。',
      },
    ])
    setInput('')
  }

  const inputBox = (
    <motion.div
      className="mx-auto w-full rounded-lg border border-black/10 bg-[#f7f9f7]/90 p-2 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-[#0f1511]/90"
      layoutId="ai-assistant-input"
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
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
              sendMessage()
            }
          }}
          placeholder="询问漏洞报告、复现步骤、修复建议或学习路径"
          rows={1}
          value={input}
        />
        <button
          aria-label="发送"
          className="rounded-lg bg-brand-600 p-2 text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-white/15"
          disabled={!input.trim()}
          onClick={sendMessage}
          type="button"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      </div>
    </motion.div>
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
            className="flex-1 space-y-5 overflow-y-auto pb-32"
            initial={{ opacity: 0, y: 18 }}
            key="ai-chat"
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
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                >
                  {!isUser && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white">
                      <Bot className="h-4 w-4" />
                    </div>
                  )}
                  <div
                    className={`max-w-[760px] rounded-lg px-4 py-3 text-sm leading-7 ${
                      isUser
                        ? 'bg-brand-600 text-white'
                        : 'border border-black/10 bg-white/70 text-slate-700 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200'
                    }`}
                  >
                    {message.content}
                  </div>
                  {isUser && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-black/10 bg-white/70 text-slate-600 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                </motion.div>
              )
            })}
          </motion.div>

          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[980px] px-5 pb-6 md:px-8"
            initial={{ opacity: 0, y: 28 }}
            key="ai-docked-input"
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
