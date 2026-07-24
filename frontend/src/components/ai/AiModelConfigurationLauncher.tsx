import { type ReactNode, useState } from 'react'
import { AiConfigurationDialog } from './AiConfigurationDialog'
import { AiModelSettingsPanel } from './AiModelSettingsPanel'
import { AdminPlatformAiPanel } from './AdminPlatformAiPanel'

export function AiModelConfigurationLauncher({ onNotice }: { onNotice: (message: string) => void }) {
  return (
    <AiModelConfigurationButton
      onNotice={onNotice}
      trigger={(open) => (
        <div className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-950 dark:text-white">模型与凭据</p>
            <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">管理第三方服务凭据、可用模型与默认模型。</p>
          </div>
          <button className={buttonClass} onClick={open} type="button">配置模型</button>
        </div>
      )}
    />
  )
}

export function AiModelConfigurationButton({
  onChanged,
  onNotice,
  trigger,
}: {
  onChanged?: () => void
  onNotice: (message: string) => void
  trigger: (open: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {trigger(() => setOpen(true))}
      <AiConfigurationDialog
        description="选择凭据后管理该服务下的模型。密钥保存后不再显示明文。"
        onClose={() => setOpen(false)}
        open={open}
        title="自有 AI 模型"
      >
        <AiModelSettingsPanel onChanged={onChanged} onNotice={onNotice} />
      </AiConfigurationDialog>
    </>
  )
}

export function AdminAiModelConfigurationLauncher() {
  return (
    <AdminAiModelConfigurationButton
      trigger={(open) => (
      <div className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-950 dark:text-white">全局模型路由</p>
          <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">所有平台 AI 功能共用一组主备模型。</p>
        </div>
        <button className={buttonClass} onClick={open} type="button">配置平台模型</button>
      </div>
      )}
    />
  )
}

export function AdminAiModelConfigurationButton({ trigger }: { trigger: (open: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {trigger(() => setOpen(true))}
      <AiConfigurationDialog
        description="配置一个主模型和最多两个备用模型，调用失败时按顺序切换。"
        onClose={() => setOpen(false)}
        open={open}
        title="平台 AI 模型"
      >
        <AdminPlatformAiPanel />
      </AiConfigurationDialog>
    </>
  )
}

const buttonClass = 'shrink-0 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-50 dark:focus-visible:ring-offset-slate-950'
