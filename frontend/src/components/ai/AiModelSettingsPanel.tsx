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
  setPlatformAiUserModel,
  testAiUserCredential,
  updateAiUserCredential,
  type AiProviderPreset,
  type AiUserCredential,
  type AiUserModel,
} from '../../services/ai'
import { ProviderPresetForm, type ProviderFormValue } from './ProviderPresetForm'

export function AiModelSettingsPanel({ onChanged, onNotice }: { onChanged?: () => void; onNotice: (message: string) => void }) {
  const [providers, setProviders] = useState<AiProviderPreset[]>([])
  const [credentials, setCredentials] = useState<AiUserCredential[]>([])
  const [models, setModels] = useState<AiUserModel[]>([])
  const [form, setForm] = useState<ProviderFormValue & { credentialId: string; displayName: string }>({
    apiKey: '', baseUrl: '', credentialId: '', displayName: '', model: '', name: '', notes: '', providerId: 'custom', websiteUrl: '',
  })
  const [busy, setBusy] = useState(false)
  const [addingCredential, setAddingCredential] = useState(true)
  const [platformSelected, setPlatformSelected] = useState(false)
  const [providersLoading, setProvidersLoading] = useState(true)

  const reload = async () => {
    setProvidersLoading(true)
    let nextProviders: AiProviderPreset[] = []
    try {
      nextProviders = await listAiProviders()
      setProviders(nextProviders)
    } finally {
      setProvidersLoading(false)
    }
    const [nextCredentials, nextModels] = await Promise.all([listAiUserCredentials(), listAiUserModels()])
    setCredentials(nextCredentials)
    setModels(nextModels)
    setPlatformSelected(!nextModels.some((model) => model.isDefault))
    setForm((current) => ({
      ...current,
      credentialId: nextCredentials.some((item) => item.id === current.credentialId)
        ? current.credentialId
        : nextCredentials[0]?.id || '',
      providerId: current.providerId || nextProviders[0]?.id || 'custom',
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
      onChanged?.()
      onNotice(message)
      return true
    } catch (error) {
      onNotice(error instanceof Error ? error.message : '操作失败')
      return false
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-[540px] lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="border-b border-black/10 bg-[var(--app-panel-muted-bg)] p-4 dark:border-white/10 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">服务凭据</p>
          <button className="rounded-md border border-brand-600/25 px-2.5 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-600/10 dark:text-brand-300" onClick={() => {
            setAddingCredential(true)
            setPlatformSelected(false)
          }} type="button">添加供应商</button>
        </div>
        <div className="mt-3 space-y-2">
          <button
            className={`w-full rounded-lg border px-3 py-3 text-left transition ${!addingCredential && platformSelected ? 'border-brand-600 bg-[var(--app-surface)] shadow-sm' : 'border-transparent hover:bg-black/5 dark:hover:bg-white/5'}`}
            onClick={() => {
              setAddingCredential(false)
              setPlatformSelected(true)
            }}
            type="button"
          >
            <span className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">平台模型</span>
              {!models.some((model) => model.isDefault) && <span className="text-xs font-medium text-brand-700 dark:text-brand-300">当前</span>}
            </span>
            <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">由平台管理员统一配置</span>
          </button>
          {credentials.map((credential) => (
            <button
              className={`w-full rounded-lg border px-3 py-3 text-left transition ${!addingCredential && form.credentialId === credential.id ? 'border-brand-600 bg-[var(--app-surface)] shadow-sm' : 'border-transparent hover:bg-black/5 dark:hover:bg-white/5'}`}
              key={credential.id}
              onClick={() => {
                setAddingCredential(false)
                setPlatformSelected(false)
                setForm({ ...form, credentialId: credential.id })
              }}
              type="button"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold">{credential.name}</span>
                <span className={`h-2 w-2 shrink-0 rounded-full ${credential.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
              </span>
              <span className="mt-1 block truncate text-xs text-slate-500 dark:text-slate-400">{credential.provider.name} · ****{credential.lastFour}</span>
            </button>
          ))}
          {credentials.length === 0 && <p className="rounded-lg border border-dashed border-black/10 px-3 py-5 text-center text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">尚未添加凭据</p>}
        </div>
      </aside>

      <div className="p-5 sm:p-6">
        {addingCredential ? (
          <div className="mx-auto max-w-2xl space-y-5">
            <div>
              <h3 className="text-base font-semibold">添加服务凭据</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">同一服务商可以保存多组密钥。</p>
            </div>
            <ProviderPresetForm
              onChange={(value) => setForm({ ...form, ...value })}
              providers={providers}
              providersLoading={providersLoading}
              value={form}
            />
            <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">保存即表示你同意将 AI 请求发送到所选第三方。请勿选择不可信中转处理敏感报告。</p>
            <div className="flex justify-end gap-3">
              {credentials.length > 0 && <button className={secondaryButton} onClick={() => setAddingCredential(false)} type="button">取消</button>}
              <button className={primaryButton} disabled={busy} onClick={async () => {
                const saved = await run(async () => {
                  const credential = await createAiUserCredential({
                    apiKey: form.apiKey,
                    baseUrl: form.baseUrl,
                    consentAccepted: true,
                    name: form.name,
                    providerId: form.providerId,
                  })
                  await createAiUserModel({
                    credentialId: credential.id,
                    displayName: form.model,
                    isDefault: models.length === 0,
                    model: form.model,
                  })
                }, '供应商配置已保存')
                if (saved) setAddingCredential(false)
              }} type="button">确定并保存</button>
            </div>
          </div>
        ) : platformSelected ? (
          <div className="mx-auto flex min-h-[360px] max-w-xl flex-col justify-center">
            <h3 className="text-lg font-semibold">平台模型</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">平台负责模型配置、可用性与调用额度。选中后，用户 AI 功能统一使用平台模型。</p>
            <div className="mt-6">
              {!models.some((model) => model.isDefault) ? (
                <span className="inline-flex rounded-lg border border-brand-600/25 bg-brand-600/5 px-4 py-2.5 text-sm font-semibold text-brand-700 dark:text-brand-300">当前正在使用</span>
              ) : (
                <button className={primaryButton} disabled={busy} onClick={() => run(() => setPlatformAiUserModel(), '已切换为平台模型')} type="button">使用平台模型</button>
              )}
            </div>
          </div>
        ) : credentials.length > 0 ? (
          <CredentialEditor
            busy={busy}
            credential={credentials.find((item) => item.id === form.credentialId) ?? credentials[0]}
            displayName={form.displayName}
            modelName={form.model}
            models={models}
            onDisplayNameChange={(value) => setForm({ ...form, displayName: value })}
            onModelNameChange={(value) => setForm({ ...form, model: value })}
            run={run}
          />
        ) : (
          <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">尚未添加自有模型</div>
        )}
      </div>
    </div>
  )
}

function CredentialEditor({
  busy,
  credential,
  displayName,
  modelName,
  models,
  onDisplayNameChange,
  onModelNameChange,
  run,
}: {
  busy: boolean
  credential: AiUserCredential
  displayName: string
  modelName: string
  models: AiUserModel[]
  onDisplayNameChange: (value: string) => void
  onModelNameChange: (value: string) => void
  run: (action: () => Promise<unknown>, message: string) => Promise<boolean>
}) {
  const credentialModels = models.filter((model) => model.credentialId === credential.id)
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-semibold">{credential.name}</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{credential.provider.name} · ****{credential.lastFour}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className={secondaryButton} disabled={busy} onClick={() => run(() => testAiUserCredential(credential.id), '连接测试通过')} type="button">测试连接</button>
          <button className={secondaryButton} disabled={busy} onClick={() => run(() => updateAiUserCredential(credential.id, credential.status !== 'ACTIVE'), '凭据状态已更新')} type="button">{credential.status === 'ACTIVE' ? '停用' : '启用'}</button>
          <button className={dangerButton} disabled={busy} onClick={() => run(() => deleteAiUserCredential(credential.id), '凭据已删除')} type="button">删除</button>
        </div>
      </div>
      <div className="border-t border-black/10 pt-5 dark:border-white/10">
        <p className="text-sm font-semibold">添加模型</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
          <Field label="模型名称" value={modelName} onChange={onModelNameChange} />
          <Field label="显示名称" value={displayName} onChange={onDisplayNameChange} />
          <button className={primaryButton} disabled={busy} onClick={() => run(() => createAiUserModel({
            credentialId: credential.id, displayName, model: modelName,
          }), '模型已添加')} type="button">添加模型</button>
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-semibold">可用模型</p>
        {credentialModels.map((model) => (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-black/10 px-3 py-3 dark:border-white/10" key={model.id}>
            <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{model.displayName}</p><p className="truncate text-xs text-slate-500 dark:text-slate-400">{model.model}</p></div>
            {model.isDefault ? <span className="text-xs font-medium text-brand-700 dark:text-brand-300">默认</span> : <button className={secondaryButton} disabled={busy} onClick={() => run(() => setDefaultAiUserModel(model.id), '默认模型已更新')} type="button">设为默认</button>}
            <button className={dangerButton} disabled={busy} onClick={() => run(() => deleteAiUserModel(model.id), '模型已删除')} type="button">删除</button>
          </div>
        ))}
        {credentialModels.length === 0 && <p className="rounded-lg border border-dashed border-black/10 px-4 py-8 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">该凭据尚未添加模型</p>}
      </div>
    </div>
  )
}

const inputClass = 'w-full rounded-lg border border-black/10 bg-[var(--app-surface)] px-3 py-2.5 text-sm text-slate-950 outline-none placeholder:text-slate-400 focus:border-brand-600 focus:ring-1 focus:ring-brand-600/25 dark:border-white/15 dark:text-white dark:placeholder:text-slate-500'
const primaryButton = 'rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50'
const secondaryButton = 'rounded-lg border border-black/10 px-3 py-2 text-xs font-medium transition hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10'
const dangerButton = 'rounded-lg px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-500/10 dark:text-red-400'

function Field({ label, onChange, type = 'text', value }: { label: string; onChange: (value: string) => void; type?: string; value: string }) {
  return <label className="block space-y-1.5 text-sm"><span className="font-medium">{label}</span><input autoComplete={type === 'password' ? 'new-password' : 'off'} className={inputClass} maxLength={type === 'password' ? 512 : 2000} onChange={(event) => onChange(event.target.value)} type={type} value={value} /></label>
}
