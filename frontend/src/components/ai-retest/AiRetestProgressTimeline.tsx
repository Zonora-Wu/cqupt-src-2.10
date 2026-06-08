import { Check, Circle, Loader2, ShieldAlert } from 'lucide-react'
import type { AiRetestJobDetail } from '../../services/aiRetests'
import { describeAiRetestStatus } from './aiRetestPresentation'

const phases = [
  ['QUEUED', '任务入队'],
  ['PLANNING', '方案生成'],
  ['POLICY_CHECK', '策略审查'],
  ['RUNNING', '受控执行'],
  ['REPORTING', '报告生成'],
  ['SUCCEEDED', '人工复核'],
] as const

export function AiRetestProgressTimeline({ job }: { job: AiRetestJobDetail }) {
  const presentation = describeAiRetestStatus(job.status)
  const currentIndex = phaseIndex(job)

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{presentation.label}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{presentation.description}</p>
        </div>
        <span className={`rounded-full border px-3 py-1 font-mono text-xs ${toneClass(presentation.tone)}`}>{job.status}</span>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2 md:grid-cols-6">
        {phases.map(([status, label], index) => {
          const done = index < currentIndex || job.status === 'SUCCEEDED'
          const current = index === currentIndex && job.status !== 'SUCCEEDED'
          return (
            <div className="relative" key={status}>
              <div className={`flex h-9 w-9 items-center justify-center rounded-full border ${
                done ? 'border-emerald-500 bg-emerald-500 text-white' :
                  current ? 'border-cyan-500 bg-cyan-500/10 text-cyan-600' :
                    'border-black/10 text-slate-400 dark:border-white/10'
              }`}>
                {done ? <Check className="h-4 w-4" /> : current ? <Loader2 className="h-4 w-4 animate-spin" /> : <Circle className="h-3 w-3" />}
              </div>
              <p className="mt-2 text-xs font-medium">{label}</p>
            </div>
          )
        })}
      </div>
      {(job.failureMessage || ['FAILED', 'BLOCKED', 'EXPIRED'].includes(job.status)) && (
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">{job.failureCode || presentation.label}</p>
            <p className="mt-1 leading-6">{job.failureMessage || presentation.description}</p>
          </div>
        </div>
      )}
    </div>
  )
}

function phaseIndex(job: AiRetestJobDetail) {
  if (job.status === 'SUCCEEDED') return 5
  if (job.status === 'REPORTING') return 4
  if (['RUNNING', 'DIRECT_RUNNING', 'DIRECT_ACTION_REVIEW'].includes(job.status)) return 3
  if (['POLICY_CHECK', 'PLAN_REVIEW', 'DIRECT_PLAN_REVIEW', 'ADVISORY_ONLY'].includes(job.status)) return 2
  if (job.status === 'PLANNING') return 1
  return 0
}

function toneClass(tone: ReturnType<typeof describeAiRetestStatus>['tone']) {
  if (tone === 'danger') return 'border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300'
  if (tone === 'warning') return 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300'
  if (tone === 'success') return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
  if (tone === 'info') return 'border-cyan-500/25 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300'
  return 'border-black/10 bg-black/[0.03] text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300'
}
