import { useEffect, useState } from 'react'
import { listAiProviders, type AiProviderPreset } from '../../services/ai'
import { deletePlatformAiRoute, getPlatformAiConfig, savePlatformAiRoute, type PlatformAiRoute } from '../../services/systemSettings'
import { ProviderPresetForm, type ProviderFormValue } from './ProviderPresetForm'

export function AdminPlatformAiPanel() {
  const [routes, setRoutes] = useState<PlatformAiRoute[]>([])
  const [providers, setProviders] = useState<AiProviderPreset[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [providersLoading, setProvidersLoading] = useState(true)
  const [form, setForm] = useState<ProviderFormValue & { priority: number }>({
    apiKey: '', baseUrl: '', model: '', name: '', notes: '', priority: 0, providerId: 'custom', websiteUrl: '',
  })

  const reload = async () => {
    setProvidersLoading(true)
    const providerRows = await listAiProviders().finally(() => setProvidersLoading(false))
    setProviders(providerRows)
    const config = await getPlatformAiConfig()
    setRoutes(config.routes.filter((route) => route.purpose === 'GLOBAL'))
  }
  useEffect(() => { const timer = window.setTimeout(() => void reload().catch(() => setMessage('平台模型配置加载失败')), 0); return () => window.clearTimeout(timer) }, [])

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true)
    try { await action(); await reload(); setMessage(success); setForm((current) => ({ ...current, apiKey: '' })) }
    catch (error) { setMessage(error instanceof Error ? error.message : '操作失败') }
    finally { setBusy(false) }
  }

  return (
    <div className="grid min-h-[520px] lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="border-b border-black/10 bg-slate-50/70 p-5 dark:border-white/10 dark:bg-white/[0.03] lg:border-b-0 lg:border-r">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">调用顺序</p>
        <div className="mt-3 space-y-2">
          {[0, 1, 2].map((priority) => {
            const route = routes.find((item) => item.priority === priority)
            return (
              <button
                className={`w-full rounded-lg border px-3 py-3 text-left transition ${form.priority === priority ? 'border-brand-600 bg-white shadow-sm dark:bg-white/[0.08]' : 'border-transparent hover:bg-black/5 dark:hover:bg-white/5'}`}
                key={priority}
                onClick={() => setForm({ ...form, priority })}
                type="button"
              >
                <span className="block text-sm font-semibold">{priorityLabel(priority)}</span>
                <span className="mt-1 block truncate text-xs text-slate-500 dark:text-slate-400">{route ? `${route.model} · ****${route.credentialLastFour}` : '未配置'}</span>
              </button>
            )
          })}
        </div>
      </aside>
      <div className="space-y-5 p-5 sm:p-6">
        <div>
          <h3 className="text-base font-semibold">{priorityLabel(form.priority)}</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">保存后覆盖该位置现有配置。</p>
        </div>
        <ProviderPresetForm
          onChange={(value) => setForm({ ...form, ...value })}
          providers={providers}
          providersLoading={providersLoading}
          value={form}
        />
        <div className="flex flex-col-reverse gap-3 border-t border-black/10 pt-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
          <p className="min-h-5 text-sm text-slate-500 dark:text-slate-400">{message}</p>
          <button className={primaryClass} disabled={busy} onClick={() => void run(() => savePlatformAiRoute({ ...form, purpose: 'GLOBAL', automaticFailover: true }), '平台模型已保存')} type="button">确定并保存</button>
        </div>
        <div className="space-y-2">
          {routes.map((route) => (
            <div className="flex items-center gap-3 rounded-lg border border-black/10 px-3 py-3 text-sm dark:border-white/10" key={route.id}>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{priorityLabel(route.priority)}</p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">{route.model} · {route.credentialName} ****{route.credentialLastFour}{route.circuitOpenUntil ? ' · 熔断冷却中' : ''}</p>
              </div>
              <button className="rounded-md px-2.5 py-2 text-xs font-medium text-red-600 hover:bg-red-500/10 dark:text-red-400" disabled={busy} onClick={() => void run(() => deletePlatformAiRoute(route.id), '配置已删除')} type="button">删除</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const primaryClass = 'rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50'
function priorityLabel(priority: number) { return priority === 0 ? '主模型' : `备用模型 ${priority}` }
