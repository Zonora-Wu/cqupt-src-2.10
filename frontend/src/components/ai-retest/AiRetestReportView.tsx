import { AlertTriangle, CheckCircle2, ClipboardCheck, ShieldCheck } from 'lucide-react'
import type { AiRetestJobDetail } from '../../services/aiRetests'

export function AiRetestReportView({
  adopting,
  job,
  onAdopt,
}: {
  adopting: boolean
  job: AiRetestJobDetail
  onAdopt: () => Promise<void>
}) {
  const report = job.report?.reportJson
  if (!job.report || !report) return null

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-5">
          <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
            <ShieldCheck className="h-5 w-5" />
            <p className="text-sm font-semibold">复测结论</p>
          </div>
          <p className="mt-4 text-2xl font-semibold">{reproducibilityLabel(report.conclusion.reproducibility)}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <Tag label={`置信度 ${report.conclusion.confidence}`} />
            <Tag label={`风险建议 ${report.conclusion.riskLevelSuggestion}`} />
            <Tag label="必须人工确认" />
          </div>
        </div>
        <div className="rounded-2xl border border-black/10 p-5 dark:border-white/10">
          <p className="text-sm font-semibold">报告可信边界</p>
          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">{report.evidenceSummary}</p>
        </div>
      </div>

      <ReportSection title="影响评估">{report.impactAssessment}</ReportSection>

      <div>
        <h4 className="text-sm font-semibold">执行步骤</h4>
        <div className="mt-3 space-y-2">
          {report.steps.length === 0 && <p className="text-sm text-slate-500">未执行自动复测步骤。</p>}
          {report.steps.map((step) => (
            <div className="grid gap-3 rounded-xl border border-black/10 p-4 md:grid-cols-[auto_minmax(0,1fr)_auto] dark:border-white/10" key={`${step.sequence}-${step.sourceId}`}>
              <span className="font-mono text-xs text-slate-400">#{step.sequence}</span>
              <div>
                <p className="text-sm font-semibold">{step.title}</p>
                {step.target && <p className="mt-1 break-all font-mono text-xs text-slate-500">{step.target}</p>}
              </div>
              <span className={`h-fit rounded-full border px-2.5 py-1 text-xs ${executionClass(step.executionState)}`}>{executionLabel(step.executionState)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <AdviceCard label="临时措施" text={report.remediationAdvice.shortTerm} />
        <AdviceCard label="根因修复" text={report.remediationAdvice.rootCauseFix} />
        <AdviceCard label="回归验证" text={report.remediationAdvice.regressionTest} />
      </div>

      {report.limitations.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300"><AlertTriangle className="h-4 w-4" /><p className="text-sm font-semibold">局限性</p></div>
          <ul className="mt-2 space-y-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{report.limitations.map((item) => <li key={item}>· {item}</li>)}</ul>
        </div>
      )}

      {report.manualRetestAdvice.manualRetestOnly && (
        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/[0.06] p-5">
          <p className="text-sm font-semibold">安全人工复测建议</p>
          <GuidanceList label="授权清单" values={report.manualRetestAdvice.authorizationChecklist} />
          <GuidanceList label="证据核对点" values={report.manualRetestAdvice.evidenceToReview} />
          <GuidanceList label="安全复测方式" values={report.manualRetestAdvice.safeManualApproach} />
        </div>
      )}

      <div className="flex flex-col justify-between gap-4 rounded-xl border border-black/10 p-5 md:flex-row md:items-center dark:border-white/10">
        <div>
          <div className="flex items-center gap-2"><ClipboardCheck className="h-4 w-4 text-emerald-700 dark:text-emerald-300" /><p className="text-sm font-semibold">审核意见草稿</p></div>
          <p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-400">{report.reviewCommentDraft}</p>
        </div>
        <button className="shrink-0 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50" disabled={adopting} onClick={() => void onAdopt()} type="button">
          {adopting ? '引用中…' : job.report.adoptedCommentId ? '更新审核意见草稿' : '引用到审核意见'}
        </button>
      </div>
    </div>
  )
}

function ReportSection({ children, title }: { children: string; title: string }) {
  return <div><h4 className="text-sm font-semibold">{title}</h4><p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-400">{children}</p></div>
}

function AdviceCard({ label, text }: { label: string; text: string }) {
  return <div className="rounded-xl border border-black/10 p-4 dark:border-white/10"><CheckCircle2 className="h-4 w-4 text-emerald-600" /><p className="mt-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-2 text-sm leading-6">{text}</p></div>
}

function GuidanceList({ label, values }: { label: string; values: string[] }) {
  return <div className="mt-4"><p className="text-xs font-semibold text-slate-500">{label}</p><ul className="mt-2 space-y-1 text-sm">{values.map((value) => <li key={value}>· {value}</li>)}</ul></div>
}

function Tag({ label }: { label: string }) {
  return <span className="rounded-full border border-emerald-500/20 bg-white/50 px-2.5 py-1 dark:bg-black/10">{label}</span>
}

function reproducibilityLabel(value: string) {
  const labels: Record<string, string> = {
    REPRODUCED: '确认观察到漏洞特征',
    NOT_REPRODUCED: '未观察到漏洞特征',
    PARTIALLY_REPRODUCED: '部分观察到漏洞特征',
    INSUFFICIENT_EVIDENCE: '证据不足',
    BLOCKED_BY_POLICY: '策略阻断',
    NOT_EXECUTED_PLATFORM_BLOCKED: '平台未执行自动复测',
  }
  return labels[value] || value
}

function executionLabel(value: string) {
  const labels: Record<string, string> = { EXECUTED: '已执行', REJECTED: '已拒绝', BLOCKED: '已阻断', NOT_EXECUTED: '未执行', EVIDENCE_INSUFFICIENT: '证据不足' }
  return labels[value] || value
}

function executionClass(value: string) {
  if (value === 'EXECUTED') return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
  if (value === 'REJECTED' || value === 'BLOCKED') return 'border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300'
  return 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300'
}
