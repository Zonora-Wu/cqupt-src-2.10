import { AlertTriangle, Bot, ShieldCheck, X } from 'lucide-react'
import { useState } from 'react'
import type { AiRetestMode } from '../../services/aiRetests'

type StartInput = {
  mode: AiRetestMode
  note?: string
  confirmedTargets: string[]
  confirmationText: string
  credentialRequest: { needsAccount: boolean; needsCaptcha: boolean; notes?: string }
}

export function AiRetestStartDialog({
  defaultTarget,
  onClose,
  onSubmit,
  submitting,
}: {
  defaultTarget: string
  onClose: () => void
  onSubmit: (input: StartInput) => Promise<void>
  submitting: boolean
}) {
  const [mode, setMode] = useState<AiRetestMode>('CONTROLLED_RUN')
  const [targets, setTargets] = useState(defaultTarget)
  const [note, setNote] = useState('')
  const [needsAccount, setNeedsAccount] = useState(false)
  const [needsCaptcha, setNeedsCaptcha] = useState(false)
  const [credentialNotes, setCredentialNotes] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)

  const confirmedTargets = targets.split('\n').map((item) => item.trim()).filter(Boolean)
  const valid = confirmedTargets.length > 0 && acknowledged

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div
        aria-labelledby="ai-retest-start-dialog-title"
        aria-modal="true"
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-emerald-300/20 bg-[#f7faf7] shadow-2xl dark:bg-[#101713]"
        role="dialog"
      >
        <div className="flex items-start justify-between border-b border-black/10 p-6 dark:border-white/10">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-emerald-700 dark:text-emerald-300">Authorized Retest</p>
            <h2 className="mt-2 text-2xl font-semibold" id="ai-retest-start-dialog-title">启动 AI 漏洞复测</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">目标、模式和风险确认将形成不可变任务快照。</p>
          </div>
          <button aria-label="关闭" className="rounded-lg p-2 hover:bg-black/5 dark:hover:bg-white/10" onClick={onClose} type="button">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 p-6">
          <div className="grid gap-3 md:grid-cols-3">
            {([
              ['CONTROLLED_RUN', '受限 Runner', '低风险内置模板，严格请求预算。'],
              ['HERMES_DIRECT', 'Hermes Direct', '复杂验证，方案与高风险动作逐级审批。'],
              ['PLAN_ONLY', '人工计划', '仅生成建议，不发送自动验证请求。'],
            ] as const).map(([value, label, description]) => (
              <button
                className={`rounded-xl border p-4 text-left transition ${
                  mode === value
                    ? 'border-emerald-500 bg-emerald-500/10 shadow-[0_0_0_1px_rgba(16,185,129,.18)]'
                    : 'border-black/10 hover:bg-black/[0.03] dark:border-white/10 dark:hover:bg-white/[0.04]'
                }`}
                key={value}
                onClick={() => setMode(value)}
                type="button"
              >
                <Bot className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
                <p className="mt-3 text-sm font-semibold">{label}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</p>
              </button>
            ))}
          </div>

          <label className="block">
            <span className="text-sm font-medium">确认目标范围</span>
            <textarea
              className="mt-2 min-h-24 w-full rounded-xl border border-black/10 bg-white/70 px-4 py-3 font-mono text-sm outline-none transition focus:border-emerald-500 dark:border-white/10 dark:bg-white/[0.04]"
              onChange={(event) => setTargets(event.target.value)}
              placeholder="每行一个 URL 或主机"
              value={targets}
            />
            <span className="mt-1 block text-xs text-slate-500">仅允许填写本次已获授权的目标，最多 20 个。</span>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <CheckOption checked={needsAccount} label="需要临时测试账号" onChange={setNeedsAccount} />
            <CheckOption checked={needsCaptcha} label="需要验证码或二次认证协助" onChange={setNeedsCaptcha} />
          </div>

          {(needsAccount || needsCaptcha) && (
            <label className="block">
              <span className="text-sm font-medium">凭据协助说明</span>
              <textarea
                className="mt-2 min-h-20 w-full rounded-xl border border-black/10 bg-white/70 px-4 py-3 text-sm outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-white/[0.04]"
                onChange={(event) => setCredentialNotes(event.target.value)}
                value={credentialNotes}
              />
            </label>
          )}

          <label className="block">
            <span className="text-sm font-medium">任务备注</span>
            <textarea
              className="mt-2 min-h-20 w-full rounded-xl border border-black/10 bg-white/70 px-4 py-3 text-sm outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-white/[0.04]"
              onChange={(event) => setNote(event.target.value)}
              placeholder="说明复测窗口、限制条件或重点观察项"
              value={note}
            />
          </label>

          <label className="flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 p-4">
            <input className="mt-1 h-4 w-4 accent-emerald-600" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} type="checkbox" />
            <span className="text-sm leading-6">
              <span className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4 text-amber-600" />授权与人工确认</span>
              <span className="mt-1 block text-slate-600 dark:text-slate-300">我已阅读漏洞详情，确认上述目标属于本次授权范围，并理解 AI 结果仅作为审核辅助。</span>
            </span>
          </label>
        </div>

        <div className="flex justify-end gap-3 border-t border-black/10 p-6 dark:border-white/10">
          <button className="rounded-lg border border-black/10 px-5 py-2.5 text-sm font-medium dark:border-white/10" onClick={onClose} type="button">取消</button>
          <button
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!valid || submitting}
            onClick={() => void onSubmit({
              confirmedTargets,
              confirmationText: '确认目标已获得授权，理解 AI 复测仅作为审核辅助',
              credentialRequest: {
                needsAccount,
                needsCaptcha,
                ...(credentialNotes.trim() ? { notes: credentialNotes.trim() } : {}),
              },
              mode,
              ...(note.trim() ? { note: note.trim() } : {}),
            })}
            type="button"
          >
            <ShieldCheck className="h-4 w-4" />
            {submitting ? '正在创建…' : '确认并启动'}
          </button>
        </div>
      </div>
    </div>
  )
}

function CheckOption({ checked, label, onChange }: { checked: boolean; label: string; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 rounded-xl border border-black/10 p-3 text-sm dark:border-white/10">
      <input className="h-4 w-4 accent-emerald-600" checked={checked} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
      {label}
    </label>
  )
}
