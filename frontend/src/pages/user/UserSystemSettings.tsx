import {
  Bell,
  Check,
  Globe,
  Languages,
  Monitor,
  Moon,
  RotateCcw,
  SlidersHorizontal,
  Sun,
  SunMoon,
} from 'lucide-react'
import { type MouseEvent, type ReactNode, useEffect, useState } from 'react'
import { FloatingNotice } from '../../components/ui/FloatingNotice'
import { PageHeader } from '../../components/ui/PageHeader'
import { SurfacePanel } from '../../components/ui/SurfacePanel'
import {
  resetUserDevicePreferences,
  type ThemeMode,
  type UserDevicePreferences,
} from '../../services/userPreferences'
import { transitionColorTheme } from '../../utils/themeTransition'

type UserSystemSettingsProps = {
  effectiveTheme: 'dark' | 'light'
  onPreferencesChange: (preferences: UserDevicePreferences) => void
  preferences: UserDevicePreferences
  userKey: string
}

type SettingsCategory = 'appearance' | 'language' | 'notifications' | 'about'

const categories: { description: string; id: SettingsCategory; icon: ReactNode; label: string }[] = [
  { id: 'appearance', label: '外观', icon: <SunMoon className="h-4 w-4" />, description: '主题与显示模式' },
  { id: 'language', label: '语言', icon: <Languages className="h-4 w-4" />, description: '界面显示语言' },
  { id: 'notifications', label: '通知', icon: <Bell className="h-4 w-4" />, description: '消息提醒偏好' },
  { id: 'about', label: '关于', icon: <Globe className="h-4 w-4" />, description: '版本与平台信息' },
]

export function UserSystemSettings({
  effectiveTheme,
  onPreferencesChange,
  preferences,
  userKey,
}: UserSystemSettingsProps) {
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('appearance')
  const [message, setMessage] = useState('')

  const updatePreferences = (nextPreferences: UserDevicePreferences, nextMessage = '已在当前设备实时生效') => {
    onPreferencesChange(nextPreferences)
    setMessage(nextMessage)
  }

  useEffect(() => {
    if (!message) return undefined
    const timer = window.setTimeout(() => setMessage(''), 2400)
    return () => window.clearTimeout(timer)
  }, [message])

  const setThemeMode = (themeMode: ThemeMode, event?: MouseEvent<HTMLElement>) => {
    if (themeMode === 'light' || themeMode === 'dark') {
      transitionColorTheme(themeMode, event)
    }
    updatePreferences({ ...preferences, themeMode })
  }

  const toggleNotification = (key: keyof UserDevicePreferences['notifications']) => {
    updatePreferences({
      ...preferences,
      notifications: { ...preferences.notifications, [key]: !preferences.notifications[key] },
    })
  }

  const resetPreferences = () => {
    updatePreferences(resetUserDevicePreferences(userKey), '已恢复当前设备默认设置')
  }

  return (
    <>
      <FloatingNotice message={message} variant="success" onClose={() => setMessage('')} />
      <section className="relative z-10 mx-auto max-w-[1360px] px-5 pb-8 pt-24 md:px-8">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <PageHeader
            eyebrow="Device Settings"
            eyebrowIcon={<SlidersHorizontal className="h-3.5 w-3.5" />}
            title="系统设置"
            description="配置平台外观、语言和通知偏好。所有设置实时生效，只保存在当前浏览器和当前设备，不会同步到服务器或其他设备。"
          />
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="xl:sticky xl:top-24 xl:self-start">
            <SurfacePanel className="overflow-hidden p-0">
              <div className="border-b border-black/10 px-4 py-3 dark:border-white/10">
                <p className="text-sm font-semibold">设置</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">设备偏好与显示配置</p>
              </div>
              <div className="p-2">
                {categories.map((cat) => (
                  <button
                    className={`flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition ${
                      activeCategory === cat.id
                        ? 'bg-brand-600 text-white'
                        : 'text-slate-700 hover:bg-black/5 dark:text-slate-300 dark:hover:bg-white/10'
                    }`}
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    type="button"
                  >
                    <span className="mt-0.5">{cat.icon}</span>
                    <span>
                      <span className="block text-sm font-semibold">{cat.label}</span>
                      <span className={`mt-1 block text-xs leading-5 ${activeCategory === cat.id ? 'text-white/75' : 'text-slate-500 dark:text-slate-400'}`}>
                        {cat.description}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </SurfacePanel>
          </aside>

          <div className="space-y-6">
            {activeCategory === 'appearance' && (
              <SettingsCard
                description="调整平台在当前设备上的视觉显示模式和界面行为。"
                icon={<SunMoon className="h-5 w-5" />}
                title="外观主题"
              >
                <div className="px-6 py-5">
                  <p className="text-sm font-semibold text-slate-950 dark:text-white">显示模式</p>
                  <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                    选择平台在当前设备上的颜色主题。自动模式会跟随系统外观，当前实际显示为
                    {effectiveTheme === 'dark' ? '深色' : '浅色'}模式。
                  </p>
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <ThemeOption
                      active={preferences.themeMode === 'light'}
                      icon={<Sun className="h-5 w-5" />}
                      label="浅色"
                      onClick={(event) => setThemeMode('light', event)}
                    />
                    <ThemeOption
                      active={preferences.themeMode === 'dark'}
                      icon={<Moon className="h-5 w-5" />}
                      label="深色"
                      onClick={(event) => setThemeMode('dark', event)}
                    />
                    <ThemeOption
                      active={preferences.themeMode === 'system'}
                      description="跟随系统"
                      icon={<Monitor className="h-5 w-5" />}
                      label="自动"
                      onClick={() => setThemeMode('system')}
                    />
                  </div>
                </div>
                <SettingRow
                  control={
                    <SettingToggle
                      enabled={preferences.reduceMotion}
                      onChange={() => updatePreferences({ ...preferences, reduceMotion: !preferences.reduceMotion })}
                    />
                  }
                  description="减少页面动效和过渡，对低性能设备或偏好安静界面的用户更友好。"
                  title="减少动效"
                />
                <SettingRow
                  control={
                    <SettingToggle
                      enabled={preferences.compactMode}
                      onChange={() => updatePreferences({ ...preferences, compactMode: !preferences.compactMode })}
                    />
                  }
                  description="压缩部分页面间距，适合笔记本小屏或需要提高信息密度的场景。"
                  title="紧凑显示"
                />
              </SettingsCard>
            )}

            {activeCategory === 'language' && (
              <SettingsCard
                description="设置平台界面的显示语言。语言偏好保存在当前设备，不会同步到其他设备或账号。"
                icon={<Languages className="h-5 w-5" />}
                title="显示语言"
              >
                <div className="space-y-2 px-6 py-5">
                  <LanguageOption
                    active={preferences.language === 'zh-CN'}
                    flag="中"
                    label="简体中文"
                    onClick={() => updatePreferences({ ...preferences, language: 'zh-CN' }, '语言偏好已保存在当前设备')}
                    sublabel="Chinese (Simplified)"
                  />
                  <LanguageOption
                    active={preferences.language === 'en-US'}
                    flag="EN"
                    label="English"
                    onClick={() => updatePreferences({ ...preferences, language: 'en-US' }, '语言偏好已保存在当前设备')}
                    sublabel="United States"
                  />
                  <p className="pt-2 text-xs text-slate-400 dark:text-slate-500">
                    当前业务页面主要为中文文案。这里先保存本地语言偏好，后续接入完整国际化后会自动读取该设置。
                  </p>
                </div>
              </SettingsCard>
            )}

            {activeCategory === 'notifications' && (
              <SettingsCard
                description="配置你希望接收的站内消息类型。通知偏好仅控制当前设备的站内提醒展示，系统安全提醒建议保持开启。"
                icon={<Bell className="h-5 w-5" />}
                title="通知设置"
              >
                <SettingRow
                  control={<SettingToggle enabled={preferences.notifications.announcement} onChange={() => toggleNotification('announcement')} />}
                  description="平台发布的新公告和重要通知"
                  title="平台公告"
                />
                <SettingRow
                  control={<SettingToggle enabled={preferences.notifications.vulnAudit} onChange={() => toggleNotification('vulnAudit')} />}
                  description="漏洞报告审核状态变更提醒"
                  title="漏洞审核结果"
                />
                <SettingRow
                  control={<SettingToggle enabled={preferences.notifications.pointsChange} onChange={() => toggleNotification('pointsChange')} />}
                  description="积分增减、兑换成功等变动提醒"
                  title="积分变动"
                />
                <SettingRow
                  control={<SettingToggle enabled={preferences.notifications.systemAlert} onChange={() => toggleNotification('systemAlert')} />}
                  description="系统维护、安全预警等重要提醒"
                  title="系统安全提醒"
                />
              </SettingsCard>
            )}

            {activeCategory === 'about' && (
              <SettingsCard
                description="当前设备的偏好设置范围与平台版本信息。"
                icon={<Globe className="h-5 w-5" />}
                title="关于平台"
              >
                {(
                  [
                    ['平台名称', 'CQUPT-SRC'],
                    ['当前版本', '2.10.0-preview'],
                    ['前端框架', 'React + Vite 6'],
                    ['技术栈', 'TypeScript / Tailwind CSS 4'],
                    ['设置范围', '当前设备 / 当前浏览器 / 当前账号'],
                    ['存储方式', 'localStorage 本地存储'],
                  ] as [string, string][]
                ).map(([label, value]) => (
                  <SettingRow
                    control={<span className="text-sm text-slate-500 dark:text-slate-400">{value}</span>}
                    description=""
                    key={label}
                    title={label}
                  />
                ))}
                <div className="px-6 py-4">
                  <button
                    className="inline-flex items-center gap-2 rounded-lg border border-black/10 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
                    onClick={resetPreferences}
                    type="button"
                  >
                    <RotateCcw className="h-4 w-4" />
                    恢复默认设置
                  </button>
                  <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                    本页设置仅影响当前设备。更换浏览器、清理浏览器数据或在其他设备登录时，需要重新配置。
                  </p>
                </div>
              </SettingsCard>
            )}
          </div>
        </div>
      </section>
    </>
  )
}

function SettingsCard({
  children,
  description,
  icon,
  title,
}: {
  children: ReactNode
  description: string
  icon: ReactNode
  title: string
}) {
  return (
    <SurfacePanel className="overflow-visible p-0">
      <div className="border-b border-black/10 px-6 py-5 dark:border-white/10">
        <div className="flex items-center gap-2 text-brand-700 dark:text-green-300">
          {icon}
          <h2 className="text-xl font-semibold text-slate-950 dark:text-white">{title}</h2>
        </div>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      <div className="divide-y divide-black/10 dark:divide-white/10">{children}</div>
    </SurfacePanel>
  )
}

function SettingRow({
  control,
  description,
  title,
}: {
  control: ReactNode
  description: string
  title: string
}) {
  return (
    <div className="grid gap-4 px-6 py-4 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-center">
      <div>
        <p className="text-sm font-semibold text-slate-950 dark:text-white">{title}</p>
        {description && <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>}
      </div>
      <div className="min-w-0">{control}</div>
    </div>
  )
}

function SettingToggle({
  enabled,
  onChange,
}: {
  enabled: boolean
  onChange?: () => void
}) {
  return (
    <button
      aria-pressed={enabled}
      className="flex w-full items-center justify-end rounded-lg px-1 py-1 text-left transition hover:bg-black/5 dark:hover:bg-white/10"
      onClick={onChange}
      type="button"
    >
      <span className={`flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition ${enabled ? 'bg-brand-600' : 'bg-slate-300 dark:bg-white/20'}`}>
        <span className={`h-5 w-5 rounded-full bg-white shadow-sm transition ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
      </span>
    </button>
  )
}

function ThemeOption({
  active,
  description,
  icon,
  label,
  onClick,
}: {
  active: boolean
  description?: string
  icon: ReactNode
  label: string
  onClick: (event: MouseEvent<HTMLButtonElement>) => void
}) {
  return (
    <button
      className={`relative flex flex-col items-center gap-2 rounded-lg border px-3 py-4 text-sm font-medium transition ${
        active
          ? 'border-brand-600/60 bg-brand-50 text-brand-700 ring-1 ring-brand-600/30 dark:border-green-300/40 dark:bg-green-300/5 dark:text-green-300'
          : 'border-black/10 text-slate-600 hover:border-brand-600/25 hover:bg-black/[0.025] dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/5'
      }`}
      onClick={onClick}
      type="button"
    >
      {active && (
        <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 dark:bg-green-400">
          <Check className="h-2.5 w-2.5 text-white dark:text-slate-900" />
        </span>
      )}
      {icon}
      <span>{label}</span>
      {description && <span className="text-xs font-normal text-slate-400">{description}</span>}
    </button>
  )
}

function LanguageOption({
  active,
  flag,
  label,
  onClick,
  sublabel,
}: {
  active: boolean
  flag: string
  label: string
  onClick: () => void
  sublabel: string
}) {
  return (
    <button
      className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition ${
        active
          ? 'border-brand-600/60 bg-brand-50 ring-1 ring-brand-600/30 dark:border-green-300/40 dark:bg-green-300/5'
          : 'border-black/10 hover:border-brand-600/25 hover:bg-black/[0.025] dark:border-white/10 dark:hover:bg-white/5'
      }`}
      onClick={onClick}
      type="button"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/5 text-xs font-semibold dark:bg-white/10">
        {flag}
      </span>
      <div className="flex-1">
        <p className={`text-sm font-medium ${active ? 'text-brand-700 dark:text-green-300' : ''}`}>{label}</p>
        <p className="text-xs text-slate-400 dark:text-slate-500">{sublabel}</p>
      </div>
      {active && <Check className="h-4 w-4 text-brand-600 dark:text-green-300" />}
    </button>
  )
}
