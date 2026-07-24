import { useEffect, useState } from 'react'
import { listAiProviders, type AiProviderPreset } from '../../services/ai'
import { deletePlatformAiRoute, getPlatformAiConfig, savePlatformAiRoute, type PlatformAiRoute } from '../../services/systemSettings'

const purposes: Array<{ label: string; value: PlatformAiRoute['purpose'] }> = [
  { label: '用户对话', value: 'USER_INTERACTIVE' },
  { label: '管理员交互', value: 'ADMIN_INTERACTIVE' },
  { label: '审核员交互', value: 'AUDITOR_INTERACTIVE' },
  { label: '后台任务', value: 'BACKGROUND_TASK' },
  { label: '结构化分析', value: 'STRUCTURED_ANALYSIS' },
  { label: 'Skill 生成', value: 'SKILL_GENERATION' },
]

export function AdminPlatformAiPanel() {
  const [routes, setRoutes] = useState<PlatformAiRoute[]>([])
  const [providers, setProviders] = useState<AiProviderPreset[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({ apiKey: '', baseUrl: '', model: '', name: '', priority: 0, providerId: 'openai', purpose: 'USER_INTERACTIVE' as PlatformAiRoute['purpose'] })

  const reload = async () => {
    const [config, providerRows] = await Promise.all([getPlatformAiConfig(), listAiProviders()])
    setRoutes(config.routes)
    setProviders(providerRows)
  }
  useEffect(() => { const timer = window.setTimeout(() => void reload().catch(() => setMessage('平台模型配置加载失败')), 0); return () => window.clearTimeout(timer) }, [])

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true)
    try { await action(); await reload(); setMessage(success); setForm((current) => ({ ...current, apiKey: '' })) }
    catch (error) { setMessage(error instanceof Error ? error.message : '操作失败') }
    finally { setBusy(false) }
  }

  return (
    <div className="space-y-4 px-6 py-5">
      <div className="grid gap-3 md:grid-cols-3">
        <Select label="用途" value={form.purpose} onChange={(value) => setForm({ ...form, purpose: value as PlatformAiRoute['purpose'] })} options={purposes} />
        <Select label="优先级" value={String(form.priority)} onChange={(value) => setForm({ ...form, priority: Number(value) })} options={[{ label: '主模型', value: '0' }, { label: '备用一', value: '1' }, { label: '备用二', value: '2' }]} />
        <Select label="供应商" value={form.providerId} onChange={(value) => setForm({ ...form, providerId: value })} options={[...providers.map((provider) => ({ label: provider.name, value: provider.id })), { label: '第三方中转站', value: 'relay' }]} />
        <Field label="凭据名称" value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
        <Field label="模型名称" value={form.model} onChange={(value) => setForm({ ...form, model: value })} />
        <Field label="API Key" type="password" value={form.apiKey} onChange={(value) => setForm({ ...form, apiKey: value })} />
        {form.providerId === 'relay' && <div className="md:col-span-3"><Field label="中转站 Base URL（HTTPS）" value={form.baseUrl} onChange={(value) => setForm({ ...form, baseUrl: value })} /></div>}
      </div>
      <div className="flex items-center justify-between gap-4"><p className="text-sm text-slate-500">{message}</p><button className={primaryClass} disabled={busy} onClick={() => void run(() => savePlatformAiRoute({ ...form, automaticFailover: true }), '平台模型路由已保存')} type="button">保存路由</button></div>
      <div className="divide-y divide-black/10 border-t border-black/10 dark:divide-white/10 dark:border-white/10">
        {routes.map((route) => <div className="flex flex-wrap items-center gap-3 py-3 text-sm" key={route.id}><div className="min-w-0 flex-1"><p className="font-semibold">{purposes.find((item) => item.value === route.purpose)?.label} · {route.priority === 0 ? '主模型' : `备用 ${route.priority}`}</p><p className="truncate text-xs text-slate-500">{route.model} · {route.credentialName} ****{route.credentialLastFour}{route.circuitOpenUntil ? ' · 熔断冷却中' : ''}</p></div><button className="text-xs font-medium text-red-600" disabled={busy} onClick={() => void run(() => deletePlatformAiRoute(route.id), '路由已删除')} type="button">删除</button></div>)}
      </div>
    </div>
  )
}

const inputClass = 'mt-1.5 w-full rounded-lg border border-black/10 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-brand-600 dark:border-white/15'
const primaryClass = 'rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50'
function Field({ label, onChange, type = 'text', value }: { label: string; onChange: (value: string) => void; type?: string; value: string }) { return <label className="text-xs font-medium">{label}<input className={inputClass} onChange={(event) => onChange(event.target.value)} type={type} value={value} /></label> }
function Select({ label, onChange, options, value }: { label: string; onChange: (value: string) => void; options: Array<{ label: string; value: string }>; value: string }) { return <label className="text-xs font-medium">{label}<select className={inputClass} onChange={(event) => onChange(event.target.value)} value={value}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label> }
