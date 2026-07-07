import { Loader2, ShieldCheck, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { FloatingNotice } from '../ui/FloatingNotice'
import { getSecurityExamPaper, submitSecurityExamAnswers, type SecurityExamPaper, type SecurityExamQuestion } from '../../services/securityExam'

type Props = {
  open: boolean
  onClose?: () => void
  onPassed?: () => void
  force?: boolean
  embedded?: boolean
}

const typeLabels: Record<SecurityExamQuestion['type'], string> = {
  MULTIPLE_CHOICE: '多选题',
  SINGLE_CHOICE: '单选题',
  TRUE_FALSE: '判断题',
}

export function SecurityExamDialog({ embedded = false, force = false, onClose, onPassed, open }: Props) {
  const [paper, setPaper] = useState<SecurityExamPaper | null>(null)
  const [answers, setAnswers] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'error' | 'success' | 'warning' } | null>(null)

  useEffect(() => {
    if (!open) return
    let active = true
    setLoading(true)
    setMessage(null)
    getSecurityExamPaper()
      .then((data) => { if (active) { setPaper(data); setAnswers({}) } })
      .catch((error) => { if (active) setMessage({ text: error instanceof Error ? error.message : '题卷加载失败', type: 'error' }) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [open])

  const answeredCount = useMemo(() => paper?.questions.filter((question) => (answers[question.id] ?? []).length > 0).length ?? 0, [answers, paper])

  if (!open || (!embedded && typeof document === 'undefined')) return null

  const toggleAnswer = (question: SecurityExamQuestion, key: string) => {
    setAnswers((current) => {
      const selected = current[question.id] ?? []
      const next = question.type === 'MULTIPLE_CHOICE'
        ? selected.includes(key) ? selected.filter((item) => item !== key) : [...selected, key]
        : [key]
      return { ...current, [question.id]: next.sort() }
    })
  }

  const submit = async () => {
    if (!paper) return
    if (answeredCount < paper.questions.length) {
      setMessage({ text: `还有 ${paper.questions.length - answeredCount} 道题未作答，请完成后提交。`, type: 'warning' })
      return
    }
    setSubmitting(true)
    setMessage(null)
    try {
      const result = await submitSecurityExamAnswers(paper.questions.map((question) => ({ questionId: question.id, selectedKeys: answers[question.id] ?? [] })))
      if (result.passed) {
        setMessage({ text: `答题通过：${result.score} 分（${result.correctCount}/${result.questionCount}），现在可以继续提交漏洞。`, type: 'success' })
        window.setTimeout(() => { onPassed?.(); onClose?.() }, 900)
      } else {
        setMessage({ text: `本次 ${result.score} 分，未达到 ${result.threshold} 分。请重新学习后再答题。`, type: 'warning' })
      }
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : '提交失败，请稍后重试', type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const content = (
    <div className={`flex w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-black/10 bg-[var(--app-menu-bg)] shadow-2xl dark:border-white/10 ${embedded ? 'max-h-none' : 'max-h-[92vh]'}`}>
        <div className="flex items-start justify-between gap-4 border-b border-black/10 p-5 dark:border-white/10">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-brand-700 dark:text-brand-300" />
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">网络安全知识答题</h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              系统随机抽取 10 道单选、5 道判断、5 道多选，共 100 分，达到 {paper?.threshold ?? 80} 分后才允许提交漏洞。
            </p>
          </div>
          {!force && (
            <button className="rounded-lg p-2 text-slate-500 transition hover:bg-black/5 dark:hover:bg-white/10" onClick={onClose} type="button">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {message && (
          <FloatingNotice
            message={message.text}
            onClose={() => setMessage(null)}
            variant={message.type}
          />
        )}

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-sm text-slate-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" />正在生成随机题卷...</div>
          ) : paper ? (
            <div className="space-y-4">
              {paper.questions.map((question, index) => {
                const selected = answers[question.id] ?? []
                return (
                  <div className="rounded-lg border border-black/10 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-[#18211b]/60" key={question.id}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-950 dark:text-white">{index + 1}. {question.stem}</p>
                      <span className="rounded-full bg-brand-600/10 px-2.5 py-1 text-xs font-medium text-brand-700 dark:text-brand-300">{typeLabels[question.type]}</span>
                    </div>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      {question.options.map((option) => (
                        <button
                          className={`rounded-lg border px-3 py-2 text-left text-sm transition ${selected.includes(option.key) ? 'border-brand-600 bg-brand-600/10 text-brand-800 dark:border-brand-300/50 dark:text-brand-200' : 'border-black/10 bg-white hover:bg-black/5 dark:border-white/10 dark:bg-[#1d251f]/80 dark:text-slate-200 dark:hover:bg-white/10'}`}
                          key={option.key}
                          onClick={() => toggleAnswer(question, option.key)}
                          type="button"
                        >
                          <span className="font-semibold">{option.key}.</span> {option.text}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 border-t border-black/10 p-5 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500 dark:text-slate-400">已完成 {answeredCount}/{paper?.questions.length ?? 20} 题</p>
          <button className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60" disabled={loading || submitting || !paper} onClick={() => void submit()} type="button">
            {submitting ? '提交中...' : '提交答题'}
          </button>
        </div>
    </div>
  )

  if (embedded) return content

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/35 px-4 py-6 backdrop-blur-sm">
      {content}
    </div>,
    document.body,
  )
}
