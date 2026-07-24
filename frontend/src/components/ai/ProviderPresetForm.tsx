import { useMemo } from 'react'
import type { AiProviderPreset } from '../../services/ai'

export type ProviderFormValue = {
  apiKey: string
  baseUrl: string
  model: string
  name: string
  notes: string
  providerId: string
  websiteUrl: string
}

type ProviderPresetFormProps = {
  onChange: (value: ProviderFormValue) => void
  providers: AiProviderPreset[]
  providersLoading?: boolean
  value: ProviderFormValue
}

export function ProviderPresetForm({ onChange, providers, providersLoading = false, value }: ProviderPresetFormProps) {
  const orderedProviders = useMemo(() => [...providers].sort((left, right) => (
    regionOrder(left.region) - regionOrder(right.region)
  )), [providers])
  const json = JSON.stringify({
    provider: value.name,
    notes: value.notes,
    website: value.websiteUrl,
    apiKey: value.apiKey ? '${API_KEY}' : '',
    baseUrl: value.baseUrl,
    model: value.model,
  }, null, 2)

  const selectProvider = (provider: AiProviderPreset) => {
    onChange({
      ...value,
      apiKey: '',
      baseUrl: provider.baseUrl,
      model: provider.defaultModel,
      name: provider.id === 'custom' ? '' : provider.name,
      notes: '',
      providerId: provider.id,
      websiteUrl: '',
    })
  }

  return (
    <div className="space-y-5">
      <section>
        <p className="text-sm font-semibold">选择供应商</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {orderedProviders.map((provider) => (
            <button
              aria-pressed={value.providerId === provider.id}
              className={`min-h-11 rounded-lg border px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${value.providerId === provider.id ? 'border-brand-600 bg-brand-600/5 text-brand-800 dark:bg-brand-400/10 dark:text-brand-200' : 'border-black/10 bg-white hover:border-brand-600/40 hover:bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.07]'}`}
              key={provider.id}
              onClick={() => selectProvider(provider)}
              type="button"
            >
              <span className="block text-sm font-semibold">{provider.name}</span>
            </button>
          ))}
        </div>
        {providersLoading && <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">正在加载供应商...</p>}
        {!providersLoading && providers.length === 0 && <p className="mt-3 rounded-lg border border-dashed border-black/10 px-4 py-5 text-center text-sm text-slate-500 dark:border-white/10">供应商目录加载失败，请关闭弹窗后重试。</p>}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="供应商名称" placeholder="必填，如 DeepSeek" value={value.name} onChange={(name) => onChange({ ...value, name })} />
        <Field label="备注" placeholder="选填，用于区分同一供应商的不同配置" value={value.notes} onChange={(notes) => onChange({ ...value, notes })} />
        <Field autoComplete="off" label="官网链接" placeholder="选填，如 https://platform.deepseek.com" type="url" value={value.websiteUrl} onChange={(websiteUrl) => onChange({ ...value, websiteUrl })} />
        <Field autoComplete="new-password" label="API Key" placeholder="必填，请输入供应商提供的 API Key" type="password" value={value.apiKey} onChange={(apiKey) => onChange({ ...value, apiKey })} />
        <Field label="API 请求地址" placeholder="必填，必须使用 HTTPS 地址" type="url" value={value.baseUrl} onChange={(baseUrl) => onChange({ ...value, baseUrl })} />
        <Field label="默认模型" placeholder="必填，如 deepseek-v4-flash" value={value.model} onChange={(model) => onChange({ ...value, model })} />
      </div>

      <section>
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">JSON 配置</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">API Key 已使用变量占位</p>
        </div>
        <pre className="max-h-56 overflow-auto rounded-lg border border-black/10 bg-slate-950 p-4 text-xs leading-6 text-slate-100 dark:border-white/10">{json}</pre>
      </section>
    </div>
  )
}

const inputClass = 'mt-1.5 w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-brand-600 dark:border-white/15 dark:bg-white/[0.07]'

function Field({ autoComplete, label, onChange, placeholder, type = 'text', value }: { autoComplete?: string; label: string; onChange: (value: string) => void; placeholder: string; type?: string; value: string }) {
  return <label className="text-xs font-medium text-slate-700 dark:text-slate-200">{label}<input autoComplete={autoComplete} className={inputClass} data-1p-ignore={type === 'password' ? 'true' : undefined} data-lpignore={type === 'password' ? 'true' : undefined} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} type={type} value={value} /></label>
}

function regionOrder(region: AiProviderPreset['region']) {
  return region === 'CUSTOM' ? 0 : region === 'CN' ? 1 : 2
}
