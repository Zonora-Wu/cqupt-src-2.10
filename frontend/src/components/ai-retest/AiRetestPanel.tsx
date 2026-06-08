import { Bot, History, KeyRound, Loader2, RefreshCcw, ShieldAlert, Square } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  adoptAiRetestReviewComment,
  approveAiRetestDirectAction,
  approveAiRetestDirectPlan,
  approveAiRetestPlan,
  cancelAiRetestJob,
  createAiRetestJob,
  getAiRetestJob,
  listAiRetestJobs,
  rejectAiRetestDirectAction,
  type AiRetestJobDetail,
  type AiRetestJobSummary,
} from '../../services/aiRetests'
import { AiRetestApprovalPanel } from './AiRetestApprovalPanel'
import { AiRetestCredentialDialog } from './AiRetestCredentialDialog'
import { AiRetestEvidenceCard } from './AiRetestEvidenceCard'
import { AiRetestProgressTimeline } from './AiRetestProgressTimeline'
import { AiRetestReportView } from './AiRetestReportView'
import { AiRetestStartDialog } from './AiRetestStartDialog'
import { getAiRetestChannel, shouldPollAiRetest } from './aiRetestPresentation'

export function AiRetestPanel({
  defaultTarget,
  onAdoptReviewComment,
  vulnerabilityId,
}: {
  defaultTarget: string
  onAdoptReviewComment: (content: string) => void
  vulnerabilityId: string
}) {
  const [jobs, setJobs] = useState<AiRetestJobSummary[]>([])
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [job, setJob] = useState<AiRetestJobDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [startOpen, setStartOpen] = useState(false)
  const [credentialOpen, setCredentialOpen] = useState(false)

  const refreshList = useCallback(async () => {
    const result = await listAiRetestJobs(vulnerabilityId)
    setJobs(result.items)
    setSelectedJobId((current) => current || result.items[0]?.jobId || null)
    if (result.items.length === 0) setJob(null)
  }, [vulnerabilityId])

  const refreshJob = useCallback(async (jobId: string) => {
    const detail = await getAiRetestJob(jobId)
    setJob(detail)
    return detail
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshList()
        .catch((cause) => setError(cause instanceof Error ? cause.message : 'AI 复测任务加载失败'))
        .finally(() => setLoading(false))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [refreshList])

  useEffect(() => {
    if (!selectedJobId) return
    const timer = window.setTimeout(() => {
      void refreshJob(selectedJobId)
        .catch((cause) => setError(cause instanceof Error ? cause.message : '任务详情加载失败'))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [refreshJob, selectedJobId])

  useEffect(() => {
    if (!job || !shouldPollAiRetest(job.status)) return
    const timer = window.setInterval(() => {
      void refreshJob(job.jobId).then((detail) => {
        if (!shouldPollAiRetest(detail.status)) void refreshList()
      }).catch(() => {})
    }, 3000)
    return () => window.clearInterval(timer)
  }, [job, refreshJob, refreshList])

  const runAction = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true)
    setError('')
    try {
      await action()
      setNotice(success)
      if (selectedJobId) await refreshJob(selectedJobId)
      await refreshList()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '操作失败')
    } finally {
      setBusy(false)
    }
  }

  const approvedTargets = useMemo(() => {
    const value = job?.directSession?.approvedTargetScope
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
  }, [job])

  return (
    <div className="overflow-hidden rounded-2xl border border-emerald-500/20 bg-[linear-gradient(145deg,rgba(16,185,129,.07),transparent_42%)] shadow-[0_18px_60px_rgba(5,46,22,.08)] dark:bg-[linear-gradient(145deg,rgba(16,185,129,.09),rgba(15,23,42,.08)_48%)]">
      <div className="flex flex-col justify-between gap-4 border-b border-black/10 p-6 md:flex-row md:items-center dark:border-white/10">
        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2.5"><Bot className="h-5 w-5 text-emerald-700 dark:text-emerald-300" /></div>
          <div><p className="font-mono text-[11px] uppercase tracking-[.24em] text-emerald-700 dark:text-emerald-300">AI Retest Control Room</p><h2 className="mt-1 text-xl font-semibold">AI 漏洞复测</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">平台控制目标、审批、凭据、证据和最终人工确认。</p></div>
        </div>
        <button className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white" onClick={() => setStartOpen(true)} type="button">启动新复测</button>
      </div>

      <div className="p-6">
        {error && <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
        {notice && <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300">{notice}</div>}

        {loading ? <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />加载 AI 复测任务…</div> : (
          <>
            {jobs.length > 0 && (
              <div className="mb-5 flex flex-wrap items-center gap-2">
                <History className="h-4 w-4 text-slate-400" />
                {jobs.slice(0, 6).map((item) => (
                  <button className={`rounded-full border px-3 py-1.5 text-xs ${selectedJobId === item.jobId ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-black/10 dark:border-white/10'}`} key={item.jobId} onClick={() => { setJob(null); setSelectedJobId(item.jobId) }} type="button">
                    {getAiRetestChannel(item.mode)} · {item.status}
                  </button>
                ))}
              </div>
            )}

            {!job ? (
              <div className="rounded-xl border border-dashed border-black/15 p-10 text-center dark:border-white/15"><Bot className="mx-auto h-8 w-8 text-slate-400" /><p className="mt-3 text-sm font-semibold">尚未启动 AI 复测</p><p className="mt-1 text-xs text-slate-500">启动前必须确认目标授权和执行模式。</p></div>
            ) : (
              <div className="space-y-6">
                <div className="rounded-xl border border-black/10 bg-white/45 p-5 dark:border-white/10 dark:bg-black/10">
                  <AiRetestProgressTimeline job={job} />
                  <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-black/10 pt-4 dark:border-white/10">
                    <span className="rounded-full bg-black/[0.04] px-3 py-1 text-xs dark:bg-white/[0.06]">{getAiRetestChannel(job.mode)}</span>
                    {job.policyDecision && <span className="text-xs text-slate-500">策略：{job.policyDecision}</span>}
                    <span className="font-mono text-[11px] text-slate-400">trace {job.traceId.slice(0, 16)}…</span>
                    <button className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-black/10 px-3 py-2 text-xs dark:border-white/10" onClick={() => void refreshJob(job.jobId)} type="button"><RefreshCcw className="h-3.5 w-3.5" />刷新</button>
                    {shouldPollAiRetest(job.status) && !['CANCELLING', 'REPORTING'].includes(job.status) && (
                      <button className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/25 px-3 py-2 text-xs text-red-700 dark:text-red-300" disabled={busy} onClick={() => void runAction(() => cancelAiRetestJob(job.jobId), '取消请求已提交。')} type="button"><Square className="h-3.5 w-3.5" />取消任务</button>
                    )}
                  </div>
                </div>

                <AiRetestApprovalPanel
                  job={job}
                  onApproveAction={(actionId, commandHash, note) => runAction(() => approveAiRetestDirectAction(job.jobId, actionId, { acknowledgedRisk: true, approvalNote: note, commandHash }), '高风险动作已批准。')}
                  onApproveDirectPlan={(input) => runAction(() => approveAiRetestDirectPlan(job.jobId, { ...input, acknowledgedRisks: true }), 'Hermes Direct 方案已批准。')}
                  onApprovePlan={(stepIds, note) => runAction(() => approveAiRetestPlan(job.jobId, { acknowledgedRisk: true, approvalNote: note, approvedStepIds: stepIds }), 'Runner 方案已批准。')}
                  onRejectAction={(actionId, note) => runAction(() => rejectAiRetestDirectAction(job.jobId, actionId, note), '高风险动作已拒绝。')}
                  submitting={busy}
                />

                {job.mode === 'HERMES_DIRECT' && job.directSession?.confirmedAt && shouldPollAiRetest(job.status) && (
                  <button className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-4 py-2.5 text-sm font-medium text-cyan-800 dark:text-cyan-200" onClick={() => setCredentialOpen(true)} type="button"><KeyRound className="h-4 w-4" />添加临时凭据 / OTP</button>
                )}

                {job.artifacts.length > 0 && <div><h3 className="text-sm font-semibold">脱敏证据</h3><div className="mt-3 grid gap-3 lg:grid-cols-2">{job.artifacts.map((artifact) => <AiRetestEvidenceCard artifact={artifact} jobId={job.jobId} key={artifact.id} />)}</div></div>}

                <AiRetestReportView
                  adopting={busy}
                  job={job}
                  onAdopt={async () => {
                    await runAction(async () => {
                      const result = await adoptAiRetestReviewComment(job.jobId)
                      onAdoptReviewComment(result.content)
                    }, 'AI 报告已引用到审核意见草稿，漏洞状态未改变。')
                  }}
                />
              </div>
            )}
          </>
        )}
      </div>

      {startOpen && <AiRetestStartDialog defaultTarget={defaultTarget} onClose={() => setStartOpen(false)} onSubmit={async (input) => {
        setBusy(true)
        setError('')
        try {
          const created = await createAiRetestJob(vulnerabilityId, input, createIdempotencyKey())
          setStartOpen(false)
          setSelectedJobId(created.jobId)
          await refreshList()
          await refreshJob(created.jobId)
          setNotice(created.deduplicated ? '已返回相同请求对应的复测任务。' : 'AI 复测任务已创建。')
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : '任务创建失败')
        } finally {
          setBusy(false)
        }
      }} submitting={busy} />}

      {credentialOpen && job && <AiRetestCredentialDialog jobId={job.jobId} onClose={() => setCredentialOpen(false)} onCreated={setNotice} targets={approvedTargets} />}
    </div>
  )
}

function createIdempotencyKey() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `ai-retest-${crypto.randomUUID()}`
  return `ai-retest-${Date.now()}-${Math.random().toString(36).slice(2)}`
}
