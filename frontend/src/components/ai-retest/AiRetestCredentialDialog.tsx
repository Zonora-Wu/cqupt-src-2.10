import { KeyRound, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { createAiRetestCredential, type AiRetestCredentialType } from '../../services/aiRetests'

const credentialTypes: Array<{ label: string; value: AiRetestCredentialType }> = [
  { label: '账号密码', value: 'USERNAME_PASSWORD' },
  { label: 'Cookie', value: 'COOKIE' },
  { label: 'Bearer Token', value: 'BEARER_TOKEN' },
  { label: '自定义 Header', value: 'CUSTOM_HEADERS' },
  { label: '客户端证书引用', value: 'CLIENT_CERT_REFERENCE' },
  { label: '实时验证码 / OTP', value: 'INTERACTIVE_OTP' },
]

export function AiRetestCredentialDialog({
  jobId,
  onClose,
  onCreated,
  targets,
}: {
  jobId: string
  onClose: () => void
  onCreated: (message: string) => void
  targets: string[]
}) {
  const [type, setType] = useState<AiRetestCredentialType>('USERNAME_PASSWORD')
  const [primary, setPrimary] = useState('')
  const [secondary, setSecondary] = useState('')
  const [target, setTarget] = useState(targets[0] || '')
  const [use, setUse] = useState('authenticated_retest')
  const [expiresInMinutes, setExpiresInMinutes] = useState(30)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const labels = useMemo(() => fieldLabels(type), [type])
  const canSubmit = Boolean(primary.trim() && target && use.trim() && expiresInMinutes >= 5 && expiresInMinutes <= 1440 && (type !== 'USERNAME_PASSWORD' || secondary.trim()))
  const clearSecrets = () => {
    setPrimary('')
    setSecondary('')
  }

  const submit = async () => {
    setSubmitting(true)
    setError('')
    try {
      await createAiRetestCredential(jobId, {
        allowedUses: [use.trim()],
        credentialType: type,
        expiresInMinutes,
        payload: buildPayload(type, primary, secondary),
        targetScope: [target],
      })
      clearSecrets()
      onCreated('临时复测凭据已加密保存，前端明文已清除。')
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '凭据创建失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-cyan-300/20 bg-[#f7faf7] shadow-2xl dark:bg-[#101713]">
        <div className="flex items-start justify-between border-b border-black/10 p-6 dark:border-white/10">
          <div><p className="font-mono text-xs uppercase tracking-[.2em] text-cyan-700 dark:text-cyan-300">Ephemeral Secret</p><h2 className="mt-2 text-xl font-semibold">添加临时复测凭据</h2></div>
          <button aria-label="关闭" className="rounded-lg p-2 hover:bg-black/5 dark:hover:bg-white/10" onClick={() => { clearSecrets(); onClose() }} type="button"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4 p-6">
          <Field label="凭据类型">
            <select className={inputClass} onChange={(event) => { clearSecrets(); setType(event.target.value as AiRetestCredentialType) }} value={type}>
              {credentialTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </Field>
          <Field label="适用目标">
            <select className={inputClass} onChange={(event) => setTarget(event.target.value)} value={target}>
              {targets.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </Field>
          <Field label={labels.primary}>
            <input autoComplete="off" className={inputClass} onChange={(event) => setPrimary(event.target.value)} type={labels.secret ? 'password' : 'text'} value={primary} />
          </Field>
          {labels.secondary && (
            <Field label={labels.secondary}>
              <input autoComplete="off" className={inputClass} onChange={(event) => setSecondary(event.target.value)} type="password" value={secondary} />
            </Field>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="允许用途"><input className={inputClass} onChange={(event) => setUse(event.target.value)} value={use} /></Field>
            <Field label="有效分钟数"><input className={inputClass} max={1440} min={5} onChange={(event) => setExpiresInMinutes(Number(event.target.value))} type="number" value={expiresInMinutes} /></Field>
          </div>
          <p className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-3 text-xs leading-5 text-cyan-800 dark:text-cyan-200">明文仅保存在当前弹窗内，提交后立即清除。后端使用 AES-256-GCM 加密并绑定任务与目标范围。</p>
          {error && <p className="text-sm text-red-600 dark:text-red-300">{error}</p>}
        </div>
        <div className="flex justify-end gap-3 border-t border-black/10 p-6 dark:border-white/10">
          <button className="rounded-lg border border-black/10 px-4 py-2 text-sm dark:border-white/10" onClick={() => { clearSecrets(); onClose() }} type="button">取消</button>
          <button className="inline-flex items-center gap-2 rounded-lg bg-cyan-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={submitting || !canSubmit} onClick={() => void submit()} type="button"><KeyRound className="h-4 w-4" />{submitting ? '加密保存中…' : '加密保存'}</button>
        </div>
      </div>
    </div>
  )
}

const inputClass = 'mt-2 w-full rounded-lg border border-black/10 bg-white/70 px-3 py-2.5 text-sm outline-none focus:border-cyan-500 dark:border-white/10 dark:bg-white/[0.04]'

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return <label className="block text-sm font-medium">{label}{children}</label>
}

function fieldLabels(type: AiRetestCredentialType) {
  if (type === 'USERNAME_PASSWORD') return { primary: '用户名', secondary: '密码', secret: false }
  if (type === 'CUSTOM_HEADERS') return { primary: 'Header JSON', secondary: null, secret: true }
  if (type === 'CLIENT_CERT_REFERENCE') return { primary: '证书安全引用', secondary: null, secret: false }
  if (type === 'INTERACTIVE_OTP') return { primary: '一次性验证码', secondary: null, secret: true }
  return { primary: type === 'COOKIE' ? 'Cookie' : 'Bearer Token', secondary: null, secret: true }
}

function buildPayload(type: AiRetestCredentialType, primary: string, secondary: string) {
  if (type === 'USERNAME_PASSWORD') return { username: primary, password: secondary }
  if (type === 'COOKIE') return { cookie: primary }
  if (type === 'BEARER_TOKEN') return { token: primary }
  if (type === 'CUSTOM_HEADERS') {
    const parsed = JSON.parse(primary) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Header JSON 必须是对象，例如 {"X-Test":"value"}')
    return { headers: parsed }
  }
  if (type === 'CLIENT_CERT_REFERENCE') return { certificateReference: primary }
  return { otp: primary }
}
