import {
  Bell,
  BellOff,
  Check,
  Globe,
  Languages,
  Moon,
  Settings2,
  Sun,
  SunMoon,
} from 'lucide-react'
import { useState } from 'react'
import { PageSection } from '../../components/layout/PageSection'
import { PageHeader } from '../../components/ui/PageHeader'
import { SectionTitle } from '../../components/ui/SectionTitle'
import { SurfacePanel } from '../../components/ui/SurfacePanel'

type UserSystemSettingsProps = {
  onThemeChange: (theme: 'dark' | 'light') => void
  theme: 'dark' | 'light'
}

type SettingsCategory = 'appearance' | 'language' | 'notifications' | 'about'

const categories: { description: string; id: SettingsCategory; icon: React.ReactNode; label: string }[] = [
  { id: 'appearance', label: '外观', icon: <SunMoon className="h-4 w-4" />, description: '主题与显示模式' },
  { id: 'language', label: '语言', icon: <Languages className="h-4 w-4" />, description: '界面显示语言' },
  { id: 'notifications', label: '通知', icon: <Bell className="h-4 w-4" />, description: '消息提醒偏好' },
  { id: 'about', label: '关于', icon: <Globe className="h-4 w-4" />, description: '版本与平台信息' },
]

export function UserSystemSettings({ onThemeChange, theme }: UserSystemSettingsProps) {
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('appearance')
  const [language, setLanguage] = useState<'zh-CN' | 'en-US'>('zh-CN')
  const [notifications, setNotifications] = useState({
    announcement: true,
    vulnAudit: true,
    pointsChange: false,
    systemAlert: true,
  })

  const toggle = (key: keyof typeof notifications) =>
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }))

  return (
    <PageSection size="md">
      {/* 页头 */}
      <PageHeader
        eyebrow="Settings"
        eyebrowIcon={<Settings2 className="h-3.5 w-3.5" />}
        title="系统设置"
        description="配置平台外观、语言和通知偏好。设置仅保存在本地浏览器，不同设备需要重新配置。"
      />

      {/* 左右布局 */}
      <div className="mt-8 flex gap-5">
        {/* 左侧导航 */}
        <aside className="w-48 shrink-0">
          <SurfacePanel className="overflow-hidden p-1.5">
            <nav className="flex flex-col gap-0.5">
              {categories.map((cat) => (
                <button
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition ${
                    activeCategory === cat.id
                      ? 'bg-brand-600/10 text-brand-700 dark:bg-green-300/10 dark:text-green-300'
                      : 'text-slate-600 hover:bg-black/5 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white'
                  }`}
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  type="button"
                >
                  <span className={`shrink-0 ${activeCategory === cat.id ? 'text-brand-600 dark:text-green-300' : 'text-slate-400 dark:text-slate-500'}`}>
                    {cat.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{cat.label}</span>
                    <span className="block truncate text-xs text-slate-400 dark:text-slate-500">{cat.description}</span>
                  </span>
                </button>
              ))}
            </nav>
          </SurfacePanel>
        </aside>

        {/* 右侧内容 */}
        <div className="min-w-0 flex-1">
          {activeCategory === 'appearance' && (
            <SurfacePanel className="p-6">
              <SectionTitle icon={<SunMoon className="h-5 w-5" />} subtitle="调整平台的视觉显示模式" title="外观主题" />
              <div className="mt-6 grid grid-cols-3 gap-3">
                <ThemeOption active={theme === 'light'} icon={<Sun className="h-5 w-5" />} label="浅色" onClick={() => onThemeChange('light')} />
                <ThemeOption active={theme === 'dark'} icon={<Moon className="h-5 w-5" />} label="深色" onClick={() => onThemeChange('dark')} />
                <ThemeOption active={false} description="跟随系统" icon={<SunMoon className="h-5 w-5" />} label="自动" onClick={() => {}} />
              </div>
              <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">
                自动模式将根据操作系统深色模式偏好切换，后续版本支持。
              </p>
            </SurfacePanel>
          )}

          {activeCategory === 'language' && (
            <SurfacePanel className="p-6">
              <SectionTitle icon={<Languages className="h-5 w-5" />} subtitle="设置平台界面的显示语言" title="显示语言" />
              <div className="mt-6 space-y-2">
                <LanguageOption active={language === 'zh-CN'} flag="🇨🇳" label="简体中文" sublabel="Chinese (Simplified)" onClick={() => setLanguage('zh-CN')} />
                <LanguageOption active={language === 'en-US'} flag="🇺🇸" label="English" sublabel="United States" onClick={() => setLanguage('en-US')} />
              </div>
              <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">
                多语言支持正在开发中，当前仅支持简体中文。
              </p>
            </SurfacePanel>
          )}

          {activeCategory === 'notifications' && (
            <SurfacePanel className="p-6">
              <SectionTitle icon={<Bell className="h-5 w-5" />} subtitle="配置你希望接收的站内消息类型" title="通知设置" />
              <div className="mt-6 space-y-3">
                <NotificationToggle description="平台发布的新公告和重要通知" enabled={notifications.announcement} label="平台公告" onChange={() => toggle('announcement')} />
                <NotificationToggle description="漏洞报告审核状态变更提醒" enabled={notifications.vulnAudit} label="漏洞审核结果" onChange={() => toggle('vulnAudit')} />
                <NotificationToggle description="积分增减、兑换成功等变动提醒" enabled={notifications.pointsChange} label="积分变动" onChange={() => toggle('pointsChange')} />
                <NotificationToggle description="系统维护、安全预警等重要提醒" enabled={notifications.systemAlert} label="系统安全提醒" onChange={() => toggle('systemAlert')} />
              </div>
              <p className="mt-5 text-xs text-slate-400 dark:text-slate-500">
                通知仅显示在平台内，后续版本支持邮件推送。系统安全提醒建议保持开启。
              </p>
            </SurfacePanel>
          )}

          {activeCategory === 'about' && (
            <SurfacePanel className="p-6">
              <SectionTitle icon={<Globe className="h-5 w-5" />} subtitle="当前平台版本与技术信息" title="关于平台" />
              <div className="mt-6 grid gap-4 border-t border-black/10 pt-5 dark:border-white/10 sm:grid-cols-2">
                <AboutRow label="平台名称" value="CQUPT-SRC" />
                <AboutRow label="当前版本" value="2.10.0-preview" />
                <AboutRow label="前端框架" value="React + Vite 6" />
                <AboutRow label="技术栈" value="TypeScript / Tailwind CSS 4" />
                <AboutRow label="运行环境" value="浏览器本地" />
                <AboutRow label="数据状态" value="前端演示模式" />
              </div>
            </SurfacePanel>
          )}
        </div>
      </div>
    </PageSection>
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
  icon: React.ReactNode
  label: string
  onClick: () => void
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
      <span className="text-xl">{flag}</span>
      <div className="flex-1">
        <p className={`text-sm font-medium ${active ? 'text-brand-700 dark:text-green-300' : ''}`}>{label}</p>
        <p className="text-xs text-slate-400 dark:text-slate-500">{sublabel}</p>
      </div>
      {active && <Check className="h-4 w-4 text-brand-600 dark:text-green-300" />}
    </button>
  )
}

function NotificationToggle({
  description,
  enabled,
  label,
  onChange,
}: {
  description: string
  enabled: boolean
  label: string
  onChange: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-black/10 px-4 py-3 dark:border-white/10">
      <div className="flex items-center gap-3">
        {enabled ? (
          <Bell className="h-4 w-4 shrink-0 text-brand-600 dark:text-green-300" />
        ) : (
          <BellOff className="h-4 w-4 shrink-0 text-slate-400" />
        )}
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">{description}</p>
        </div>
      </div>
      <button
        aria-label={`切换${label}通知`}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
          enabled ? 'bg-brand-600 dark:bg-green-500' : 'bg-slate-200 dark:bg-white/10'
        }`}
        onClick={onChange}
        type="button"
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            enabled ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}

function AboutRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-slate-400 dark:text-slate-500">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  )
}
