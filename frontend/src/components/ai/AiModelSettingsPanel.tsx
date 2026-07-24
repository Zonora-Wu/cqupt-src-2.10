import { useEffect, useState } from 'react'
import {
  createAiUserCredential,
  createAiUserModel,
  deleteAiUserCredential,
  deleteAiUserModel,
  listAiProviders,
  listAiUserCredentials,
  listAiUserModels,
  setDefaultAiUserModel,
  testAiUserCredential,
  updateAiUserCredential,
  type AiProviderPreset,
  type AiUserCredential,
  type AiUserModel,
} from '../../services/ai'

export function AiModelSettingsPanel({ onNotice }: { onNotice: (message: string) => void }) {
  const [providers, setProviders] = useState<AiProviderPreset[]>([])
  const [credentials, setCredentials] = useState<AiUserCredential[]>([])
  const [models, setModels] = useState<AiUserModel[]>([])
  const [form, setForm] = useState({ apiKey: '', credentialId: '', credentialName: '', displayName: '', model: '', providerId: '' })
  const [busy, setBusy] = useState(false)

  const reload = async () => {
    const [nextProviders, nextCredentials, nextModels] = await Promise.all([
      listAiProviders(), listAiUserCredentials(), listAiUserModels(),
    ])
    setProviders(nextProviders)
    setCredentials(nextCredentials)
    setModels(nextModels)
    setForm((current) => ({
      ...current,
      credentialId: current.credentialId || nextCredentials[0]?.id || '',
      providerId: current.providerId || nextProviders[0]?.id || '',
    }))
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void reload().catch((error) => onNotice(error instanceof Error ? error.message : '模型配置加载失败'))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [onNotice])

  const run = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true)
    try {
      await action()
      await reload()
      onNotice(message)
    } catch (error) {
      onNotice(error instanceof Error ? error.message : '操作失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5 px-6 py-5">
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="凭据名称" value={form.credentialName} onChange={(value) => setForm({ ...form, credentialName: value })} />
        <label className="space-y-1.5 text-sm"><span className="font-medium">供应商</span>
          <select className={inputClass} value={form.providerId} onChange={(event) => setForm({ ...form, providerId: event.target.value })}>
            {providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name} · {provider.category}</option>)}
          </select>
        </label>
        <div className="md:col-span-2"><Field label="API Key" type="password" value={form.apiKey} onChange={(value) => setForm({ ...form, apiKey: value })} /></div>
      </div>
      <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">保存即表示你同意将 AI 请求发送到所选第三方。平台不控制供应商的数据保存、训练和日志策略，请勿选择不可信中转处理敏感报告。</p>
      <button className={primaryButton} disabled={busy} onClick={() => run(() => createAiUserCredential({
        apiKey: form.apiKey, consentAccepted: true, name: form.credentialName, providerId: form.providerId,
      }), '凭据已加密保存')} type="button">添加凭据</button>

      {credentials.length > 0 && <div className="divide-y divide-black/10 border-y border-black/10 dark:divide-white/10 dark:border-white/10">
        {credentials.map((credential) => <div className="flex flex-wrap items-center gap-3 py-3 text-sm" key={credential.id}>
          <div className="min-w-0 flex-1"><p className="font-semibold">{credential.name}</p><p className="text-xs text-slate-500">{credential.provider.name} · ****{credential.lastFour} · {credential._count.models} 个模型</p></div>
          <button className={secondaryButton} disabled={busy} onClick={() => run(() => testAiUserCredential(credential.id), '连接测试通过')} type="button">测试</button>
          <button className={secondaryButton} disabled={busy} onClick={() => run(() => updateAiUserCredential(credential.id, credential.status !== 'ACTIVE'), '凭据状态已更新')} type="button">{credential.status === 'ACTIVE' ? '停用' : '启用'}</button>
          <button className={dangerButton} disabled={busy} onClick={() => run(() => deleteAiUserCredential(credential.id), '凭据已删除')} type="button">删除</button>
        </div>)}
      </div>}

      <div className="grid gap-3 md:grid-cols-3">
        <label className="space-y-1.5 text-sm"><span className="font-medium">关联凭据</span>
          <select className={inputClass} value={form.credentialId} onChange={(event) => setForm({ ...form, credentialId: event.target.value })}>
            {credentials.map((credential) => <option key={credential.id} value={credential.id}>{credential.name}</option>)}
          </select>
        </label>
        <Field label="模型名称" value={form.model} onChange={(value) => setForm({ ...form, model: value })} />
        <Field label="显示名称" value={form.displayName} onChange={(value) => setForm({ ...form, displayName: value })} />
      </div>
      <button className={primaryButton} disabled={busy || !form.credentialId} onClick={() => run(() => createAiUserModel({
        credentialId: form.credentialId, displayName: form.displayName, model: form.model,
      }), '模型已添加')} type="button">添加模型</button>
      <div className="space-y-2">
        {models.map((model) => <div className="flex items-center gap-3 rounded-lg border border-black/10 px-3 py-3 dark:border-white/10" key={model.id}>
          <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{model.displayName}</p><p className="truncate text-xs text-slate-500">{model.model} · {model.credential.name}</p></div>
          {model.isDefault ? <span className="text-xs font-medium text-brand-700 dark:text-brand-300">默认</span> : <button className={secondaryButton} disabled={busy} onClick={() => run(() => setDefaultAiUserModel(model.id), '默认模型已更新')} type="button">设为默认</button>}
          <button className={dangerButton} disabled={busy} onClick={() => run(() => deleteAiUserModel(model.id), '模型已删除')} type="button">删除</button>
        </div>)}
      </div>
    </div>
  )
}

const inputClass = 'w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-600 dark:border-white/15 dark:bg-white/[0.07]'
const primaryButton = 'rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50'
const secondaryButton = 'rounded-lg border border-black/10 px-3 py-2 text-xs font-medium dark:border-white/15'
const dangerButton = 'rounded-lg px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400'

function Field({ label, onChange, type = 'text', value }: { label: string; onChange: (value: string) => void; type?: string; value: string }) {
  return <label className="block space-y-1.5 text-sm"><span className="font-medium">{label}</span><input className={inputClass} onChange={(event) => onChange(event.target.value)} type={type} value={value} /></label>
}
