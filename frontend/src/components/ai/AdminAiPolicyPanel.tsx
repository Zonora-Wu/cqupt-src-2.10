import { useEffect, useState } from 'react'
import { platformNotice } from '../../services/platformNotice'
import { getAiModelPolicy, updateAiModelPolicy, type AiUserModelPolicy } from '../../services/systemSettings'

const options: Array<{ description: string; label: string; value: AiUserModelPolicy }> = [
  { value: 'USER_PLATFORM_ONLY', label: '仅平台模型', description: '普通用户统一使用平台模型与平台额度。' },
  { value: 'USER_BYOK_ONLY', label: '仅用户模型', description: '普通用户必须配置自己的模型，平台不提供失败回退。' },
  { value: 'USER_HYBRID', label: '用户可选', description: '普通用户可在新会话中选择平台模型或自有模型。' },
]

export function AdminAiPolicyPanel() {
  const [value, setValue] = useState<AiUserModelPolicy>('USER_PLATFORM_ONLY')
  const [saved, setSaved] = useState<AiUserModelPolicy>('USER_PLATFORM_ONLY')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void getAiModelPolicy().then((result) => { setValue(result.userMode); setSaved(result.userMode) })
      .catch((error) => platformNotice.error(error instanceof Error ? error.message : '策略加载失败', { title: 'AI 策略加载失败' }))
  }, [])

  const save = async () => {
    if (value === saved) return
    if (!window.confirm('切换后只影响新 AI 请求和新会话，已有运行继续使用原模型。确认切换？')) return
    setBusy(true)
    try {
      const result = await updateAiModelPolicy(value)
      setSaved(result.userMode)
      platformNotice.success('用户 AI 模式已更新', { title: 'AI 策略已保存' })
    } catch (error) {
      platformNotice.error(error instanceof Error ? error.message : '策略保存失败', { title: 'AI 策略保存失败' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="px-6 py-5">
      <div className="grid gap-2 md:grid-cols-3">
        {options.map((option) => <button
          aria-pressed={value === option.value}
          className={`rounded-lg border px-4 py-3 text-left transition ${value === option.value ? 'border-brand-600 bg-brand-50 dark:border-brand-300/50 dark:bg-brand-300/5' : 'border-black/10 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5'}`}
          key={option.value}
          onClick={() => setValue(option.value)}
          type="button"
        >
          <span className="block text-sm font-semibold">{option.label}</span>
          <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">{option.description}</span>
        </button>)}
      </div>
      <div className="mt-4 flex items-center justify-between gap-4">
        <span aria-hidden="true" />
        <button className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" disabled={busy || value === saved} onClick={() => void save()} type="button">
          {busy ? '保存中...' : '保存模式'}
        </button>
      </div>
    </div>
  )
}
