import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock,
  DollarSign,
  Globe,
  Loader2,
  Lock,
  Save,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  ToggleLeft,
  ToggleRight,
  Zap,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '../../components/ui/PageHeader'
import { SurfacePanel } from '../../components/ui/SurfacePanel'
import {
  type RetestPolicyConfig,
  getAiRetestPolicy,
  updateAiRetestPolicy,
} from '../../services/aiRetestAdmin'

function SettingsCard({
  children,
  description,
  icon: Icon,
  title,
}: {
  children: React.ReactNode
  description: string
  icon: React.ComponentType<{ className?: string; size?: number }>
  title: string
}) {
  return (
    <SurfacePanel className="p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-100 dark:bg-brand-900/20">
          <Icon className="text-brand-700 dark:text-brand-400" size={18} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
        </div>
      </div>
      {children}
    </SurfacePanel>
  )
}

function SettingRow({
  children,
  description,
  label,
}: {
  children: React.ReactNode
  description?: string
  label: string
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-black/[0.04] py-3 last:border-b-0 dark:border-white/[0.03]">
      <div className="min-w-0 flex-1">
        <label className="text-sm font-medium text-slate-800 dark:text-slate-200">{label}</label>
        {description && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function ActionButton({
  children,
  danger,
  disabled,
  icon: Icon,
  onClick,
}: {
  children: React.ReactNode
  danger?: boolean
  disabled?: boolean
  icon?: React.ComponentType<{ className?: string; size?: number }>
  onClick: () => void
}) {
  return (
    <button
      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-40 ${
        danger
          ? 'bg-red-600 text-white hover:bg-red-700'
          : 'bg-brand-600 text-white hover:bg-brand-700'
      }`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {Icon && <Icon size={16} />}
      {children}
    </button>
  )
}

export function AdminAiRetestPolicy() {
  const [config, setConfig] = useState<RetestPolicyConfig | null>(null)
  const [localEnabled, setLocalEnabled] = useState(true)
  const [localHermesEnabled, setLocalHermesEnabled] = useState(true)
  const [localMaxJobsPerDay, setLocalMaxJobsPerDay] = useState(3)
  const [localMaxJobsPerHour, setLocalMaxJobsPerHour] = useState(5)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getAiRetestPolicy()
      setConfig(data)
      setLocalEnabled(data.enabled)
      setLocalHermesEnabled(data.hermesDirectEnabled)
      setLocalMaxJobsPerDay(data.maxJobsPerVulnerabilityPerDay)
      setLocalMaxJobsPerHour(data.maxJobsPerAuditorPerHour)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载策略配置失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const savePartial = async (partial: Record<string, unknown>) => {
    setSaving(true)
    setSavedMessage(null)
    try {
      const updated = await updateAiRetestPolicy(partial)
      setConfig(updated)
      setSavedMessage(`策略已更新 (v${updated.version})`)
      setTimeout(() => setSavedMessage(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const toggleEnabled = () => {
    const next = !localEnabled
    setLocalEnabled(next)
    savePartial({ enabled: next })
  }

  const toggleHermesEnabled = () => {
    const next = !localHermesEnabled
    setLocalHermesEnabled(next)
    savePartial({ enabled: localEnabled, hermesDirectEnabled: next })
  }

  const saveRateLimits = () => {
    savePartial({
      enabled: localEnabled,
      hermesDirectEnabled: localHermesEnabled,
      maxJobsPerVulnerabilityPerDay: localMaxJobsPerDay,
      maxJobsPerAuditorPerHour: localMaxJobsPerHour,
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-slate-400" />
        <span className="text-sm text-slate-500">加载策略配置中…</span>
      </div>
    )
  }

  const isConfigEnabled = config?.enabled ?? true
  const isHermesEnabled = config?.hermesDirectEnabled ?? true

  return (
    <div className="mx-auto max-w-[960px]">
      <PageHeader
        description="管理 AI 漏洞复测的总开关、执行通道、请求预算和安全策略"
        eyebrow="管理员"
        eyebrowIcon={<SlidersHorizontal className="h-12 w-12" />}
        title="AI 复测策略配置"
      />

      {error && (
        <SurfacePanel className="mb-6 border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/20 dark:text-red-400">
          <AlertTriangle className="mr-2 inline-block h-4 w-4" />
          {error}
          <button className="ml-2 underline" onClick={() => setError(null)} type="button">关闭</button>
        </SurfacePanel>
      )}

      {savedMessage && (
        <SurfacePanel className="mb-6 border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400">
          <CheckCircle2 className="mr-2 inline-block h-4 w-4" />
          {savedMessage}
        </SurfacePanel>
      )}

      {saving && (
        <div className="mb-4 flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="h-3 w-3 animate-spin" /> 保存中…
        </div>
      )}

      <div className="space-y-5">
        {/* Master Switch */}
        <SettingsCard
          description="关闭后所有用户将无法发起新的 AI 复测任务。已在运行的任务不受影响。"
          icon={Zap}
          title="总开关"
        >
          <SettingRow label="AI 漏洞复测总开关">
            <button
              aria-label={isConfigEnabled ? '禁用 AI 复测' : '启用 AI 复测'}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                isConfigEnabled
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              }`}
              disabled={saving}
              onClick={toggleEnabled}
              type="button"
            >
              {isConfigEnabled
                ? <><CheckCircle2 size={16} /> 已启用</>
                : <><Ban size={16} /> 已禁用</>
              }
            </button>
          </SettingRow>
          <SettingRow
            description="禁用后 RCE/命令执行/反序列化等复杂漏洞只能走仅计划（PLAN_ONLY）或人工审核通道"
            label="Hermes Direct 通道"
          >
            <button
              aria-label={isHermesEnabled ? '禁用 Hermes Direct' : '启用 Hermes Direct'}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                isHermesEnabled
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
              }`}
              disabled={saving}
              onClick={toggleHermesEnabled}
              type="button"
            >
              {isHermesEnabled ? <><ToggleRight size={16} /> 已启用</> : <><ToggleLeft size={16} /> 已禁用</>}
            </button>
          </SettingRow>
        </SettingsCard>

        {/* Rate Limits */}
        <SettingsCard
          description="控制同一漏洞和同一审核员的复测频率，防止滥用。"
          icon={Clock}
          title="频率限制"
        >
          <SettingRow
            description="同一漏洞每日允许发起的 AI 复测次数"
            label="单漏洞每日上限"
          >
            <div className="flex items-center gap-2">
              <input
                className="w-20 rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-center text-sm dark:border-white/[0.06] dark:bg-[#0f1511] dark:text-white"
                max={50}
                min={1}
                onChange={(e) => setLocalMaxJobsPerDay(Number(e.target.value) || 3)}
                type="number"
                value={localMaxJobsPerDay}
              />
              <span className="text-xs text-slate-500">次/天</span>
            </div>
          </SettingRow>
          <SettingRow
            description="同一审核员每小时允许发起的 AI 复测次数"
            label="审核员每小时上限"
          >
            <div className="flex items-center gap-2">
              <input
                className="w-20 rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-center text-sm dark:border-white/[0.06] dark:bg-[#0f1511] dark:text-white"
                max={50}
                min={1}
                onChange={(e) => setLocalMaxJobsPerHour(Number(e.target.value) || 5)}
                type="number"
                value={localMaxJobsPerHour}
              />
              <span className="text-xs text-slate-500">次/小时</span>
            </div>
          </SettingRow>
          <div className="mt-3 flex justify-end">
            <ActionButton
              disabled={saving}
              icon={Save}
              onClick={saveRateLimits}
            >
              保存频率限制
            </ActionButton>
          </div>
        </SettingsCard>

        {/* Runner Budget (read-only display) */}
        <SettingsCard
          description="Runner 受控执行通道的请求预算（当前为系统默认值，修改需更新服务端常量）"
          icon={DollarSign}
          title="Runner 请求预算"
        >
          {config && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 lg:grid-cols-3">
              {[
                ['单任务最大请求', `${config.runnerBudget.maxRequestsPerJob} 次`],
                ['单步骤最大请求', `${config.runnerBudget.maxRequestsPerStep} 次`],
                ['响应体保存上限', `${(config.runnerBudget.maxResponseBytes / 1024).toFixed(0)} KB`],
                ['单请求超时', `${(config.runnerBudget.requestTimeoutMs / 1000).toFixed(0)} s`],
                ['任务总超时', `${(config.runnerBudget.totalTimeoutMs / 60000).toFixed(0)} min`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-black/[0.04] bg-white px-3 py-2 dark:border-white/[0.03] dark:bg-white/[0.02]">
                  <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">{value}</div>
                </div>
              ))}
            </div>
          )}
        </SettingsCard>

        {/* Vulnerability type whitelist */}
        <SettingsCard
          description="只有在此列表中的漏洞类型才能发起 AI 复测。如需增加新类型请联系管理员更新策略。"
          icon={Globe}
          title="支持漏洞类型"
        >
          {config && (
            <div className="flex flex-wrap gap-2">
              {config.allowedVulnerabilityTypes.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400"
                >
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  {t}
                </span>
              ))}
              {config.blockedVulnerabilityTypes.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-700 dark:border-red-800 dark:bg-red-950/20 dark:text-red-400"
                >
                  <Ban className="mr-1 h-3 w-3" />
                  {t}
                </span>
              ))}
            </div>
          )}
        </SettingsCard>

        {/* Hard-block list */}
        <SettingsCard
          description="以下动作即使管理员审批也会被阻断（当前版本冻结清单）。修改需经正式安全评审并版本化策略。"
          icon={ShieldAlert}
          title="超高危禁止动作"
        >
          {config && (
            <div className="space-y-2">
              {[
                { code: 'DENIAL_OF_SERVICE', label: '拒绝服务 / DoS / DDoS', icon: Zap },
                { code: 'CREDENTIAL_ATTACK', label: '爆破 / 撞库 / 凭据喷洒', icon: Lock },
                { code: 'MASS_SCANNING', label: '大规模扫描 / 无界枚举', icon: Globe },
                { code: 'PERSISTENCE', label: '持久化 / 后门 / C2', icon: AlertTriangle },
                { code: 'LATERAL_MOVEMENT', label: '横向移动 / 内网扩散', icon: Globe },
                { code: 'BULK_EXFILTRATION', label: '批量数据导出 / 拖库', icon: DollarSign },
                { code: 'DESTRUCTIVE_CHANGE', label: '破坏 / 删除数据 / 勒索', icon: Ban },
              ].map(({ code, label, icon: Icon }) => (
                <div
                  key={code}
                  className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition ${
                    config.superCriticalBlockedActionCodes.includes(code)
                      ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/15'
                      : 'border-black/[0.04] bg-white dark:border-white/[0.03] dark:bg-white/[0.02] opacity-50'
                  }`}
                >
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                    config.superCriticalBlockedActionCodes.includes(code)
                      ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                      : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800'
                  }`}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-800 dark:text-slate-200">{label}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {config.superCriticalBlockedActionCodes.includes(code) ? '始终阻断' : '未激活阻断'}
                    </div>
                  </div>
                  {config.superCriticalBlockedActionCodes.includes(code) ? (
                    <ShieldCheck className="text-red-500 dark:text-red-400" size={18} />
                  ) : (
                    <ShieldAlert className="text-zinc-300 dark:text-zinc-600" size={18} />
                  )}
                </div>
              ))}
            </div>
          )}
          <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">
            此清单基于 Phase 0 安全评审冻结。后期如需修改，必须经过产品、安全、运维三方评审，升级策略版本，补充 E2E 回归，并只对新任务生效。
          </p>
        </SettingsCard>
      </div>
    </div>
  )
}
