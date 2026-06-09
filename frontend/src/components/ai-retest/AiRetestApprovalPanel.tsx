import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { useState } from 'react'
import type { AiRetestJobDetail } from '../../services/aiRetests'

export function AiRetestApprovalPanel({
  job,
  onApproveAction,
  onApproveDirectPlan,
  onApprovePlan,
  onRejectAction,
  submitting,
}: {
  job: AiRetestJobDetail
  onApproveAction: (actionId: string, commandHash: string, note: string) => Promise<void>
  onApproveDirectPlan: (input: {
    approvedToolClasses: string[]
    confirmationText: string
    confirmedImpactScope: string[]
    confirmedTargetScope: string[]
    proposalHash: string
  }) => Promise<void>
  onApprovePlan: (stepIds: string[], note: string) => Promise<void>
  onRejectAction: (actionId: string, note: string) => Promise<void>
  submitting: boolean
}) {
  if (job.status === 'PLAN_REVIEW') return <RunnerPlanApproval job={job} onApprove={onApprovePlan} submitting={submitting} />
  if (job.status === 'DIRECT_PLAN_REVIEW' && job.directSession) return <DirectPlanApproval job={job} onApprove={onApproveDirectPlan} submitting={submitting} />
  if (job.status === 'DIRECT_ACTION_REVIEW' && job.directSession) {
    const action = [...job.directSession.actions].reverse().find((item) => item.status === 'PENDING_APPROVAL')
    if (action) return <DirectActionApproval action={action} onApprove={onApproveAction} onReject={onRejectAction} submitting={submitting} />
  }
  return null
}

function RunnerPlanApproval({ job, onApprove, submitting }: {
  job: AiRetestJobDetail
  onApprove: (ids: string[], note: string) => Promise<void>
  submitting: boolean
}) {
  const candidates = job.steps.filter((step) => ['WAITING_APPROVAL', 'ALLOWED'].includes(step.status))
  const [selected, setSelected] = useState(() => candidates.map((step) => step.id))
  const [note, setNote] = useState('')
  const [ack, setAck] = useState(false)
  return (
    <ApprovalShell title="Runner 方案人工确认">
      <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">仅批准下列中风险步骤；后端仍会再次执行目标、工具和预算策略校验。</p>
      <div className="mt-4 space-y-2">
        {candidates.map((step) => (
          <label className="flex items-start gap-3 rounded-xl border border-black/10 p-3 dark:border-white/10" key={step.id}>
            <input className="mt-1 accent-emerald-600" checked={selected.includes(step.id)} onChange={(event) => setSelected((value) => event.target.checked ? [...value, step.id] : value.filter((id) => id !== step.id))} type="checkbox" />
            <span><span className="text-sm font-semibold">{step.sequence}. {step.title}</span><span className="mt-1 block font-mono text-xs text-slate-500">{step.targetUrl}</span></span>
          </label>
        ))}
      </div>
      <ApprovalFields ack={ack} note={note} onAck={setAck} onNote={setNote} />
      <ApproveButton disabled={submitting || !ack || note.trim().length < 5 || selected.length === 0} label="批准所选步骤" onClick={() => void onApprove(selected, note.trim())} />
    </ApprovalShell>
  )
}

function DirectPlanApproval({ job, onApprove, submitting }: {
  job: AiRetestJobDetail
  onApprove: (input: { approvedToolClasses: string[]; confirmationText: string; confirmedImpactScope: string[]; confirmedTargetScope: string[]; proposalHash: string }) => Promise<void>
  submitting: boolean
}) {
  const session = job.directSession!
  const proposal = session.proposal
  const targets = stringArray(proposal.targets)
  const impacts = stringArray(proposal.impactScope)
  const tools = stringArray(proposal.toolClasses)
  const [note, setNote] = useState('')
  const [ack, setAck] = useState(false)
  return (
    <ApprovalShell title="Hermes Direct 初始方案审批">
      <div className="grid gap-3 text-sm md:grid-cols-2">
        <ScopeBlock label="目标范围" values={targets} />
        <ScopeBlock label="影响范围" values={impacts} />
        <ScopeBlock label="工具类别" values={tools} />
        <div className="rounded-xl border border-black/10 p-4 dark:border-white/10"><p className="text-xs font-semibold text-slate-500">方案 Hash</p><p className="mt-2 break-all font-mono text-xs">{session.proposalHash}</p></div>
      </div>
      <pre className="mt-4 max-h-52 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-950 p-4 text-xs leading-6 text-emerald-100">{JSON.stringify(proposal, null, 2)}</pre>
      <ApprovalFields ack={ack} note={note} onAck={setAck} onNote={setNote} />
      <ApproveButton disabled={submitting || !ack || note.trim().length < 12 || targets.length === 0 || impacts.length === 0 || tools.length === 0} label="批准 Direct 方案" onClick={() => void onApprove({ approvedToolClasses: tools, confirmationText: note.trim(), confirmedImpactScope: impacts, confirmedTargetScope: targets, proposalHash: session.proposalHash })} />
    </ApprovalShell>
  )
}

function DirectActionApproval({ action, onApprove, onReject, submitting }: {
  action: NonNullable<AiRetestJobDetail['directSession']>['actions'][number]
  onApprove: (id: string, hash: string, note: string) => Promise<void>
  onReject: (id: string, note: string) => Promise<void>
  submitting: boolean
}) {
  const [note, setNote] = useState('')
  const [ack, setAck] = useState(false)
  return (
    <ApprovalShell title="高风险动作逐次审批">
      <div className="rounded-xl border border-red-500/20 bg-red-500/[0.06] p-4">
        <div className="flex items-center gap-2 text-red-700 dark:text-red-300"><AlertTriangle className="h-4 w-4" /><p className="text-sm font-semibold">{action.actionType}</p></div>
        <p className="mt-3 font-mono text-xs">{action.commandPreview || '无命令预览'}</p>
        <p className="mt-2 text-xs text-slate-500">目标：{action.target || '未声明'} · 风险：{action.riskLevel}</p>
        <p className="mt-2 text-sm">{action.expectedImpact || action.riskSummary}</p>
        <p className="mt-3 break-all font-mono text-[11px] text-slate-500">Hash: {action.commandHash}</p>
      </div>
      <ApprovalFields ack={ack} note={note} onAck={setAck} onNote={setNote} />
      <div className="mt-4 flex flex-wrap justify-end gap-3">
        <button className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-50 dark:text-red-300" disabled={submitting || note.trim().length < 5} onClick={() => void onReject(action.id, note.trim())} type="button"><XCircle className="h-4 w-4" />拒绝动作</button>
        <ApproveButton disabled={submitting || !ack || note.trim().length < 8} label="批准相同 Hash 动作" onClick={() => void onApprove(action.id, action.commandHash, note.trim())} />
      </div>
    </ApprovalShell>
  )
}

function ApprovalShell({ children, title }: { children: React.ReactNode; title: string }) {
  return <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.055] p-5"><div className="flex items-center gap-2 text-amber-800 dark:text-amber-300"><AlertTriangle className="h-5 w-5" /><h3 className="font-semibold">{title}</h3></div><div className="mt-4">{children}</div></div>
}

function ApprovalFields({ ack, note, onAck, onNote }: { ack: boolean; note: string; onAck: (value: boolean) => void; onNote: (value: string) => void }) {
  return <div className="mt-4 space-y-3"><textarea className="min-h-20 w-full rounded-xl border border-black/10 bg-white/70 px-4 py-3 text-sm outline-none focus:border-amber-500 dark:border-white/10 dark:bg-black/10" onChange={(event) => onNote(event.target.value)} placeholder="填写审批依据、限制条件和人工确认说明" value={note} /><label className="flex items-start gap-3 text-sm"><input className="mt-1 accent-emerald-600" checked={ack} onChange={(event) => onAck(event.target.checked)} type="checkbox" /><span>我已核对目标、影响、工具或动作内容，并知晓该审批不会绕过平台超高危硬阻断策略。</span></label></div>
}

function ApproveButton({ disabled, label, onClick }: { disabled: boolean; label: string; onClick: () => void }) {
  return <button className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={disabled} onClick={onClick} type="button"><CheckCircle2 className="h-4 w-4" />{label}</button>
}

function ScopeBlock({ label, values }: { label: string; values: string[] }) {
  return <div className="rounded-xl border border-black/10 p-4 dark:border-white/10"><p className="text-xs font-semibold text-slate-500">{label}</p><ul className="mt-2 space-y-1 text-xs">{values.map((value) => <li className="break-all font-mono" key={value}>{value}</li>)}</ul></div>
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : []
}
