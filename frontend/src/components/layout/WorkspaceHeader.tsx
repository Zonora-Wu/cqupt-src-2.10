import { Moon, Sun } from 'lucide-react'
import type { MouseEvent } from 'react'
import { ScrollableNav } from '../navigation/ScrollableNav'
import { UserAvatarMenu } from '../navigation/UserAvatarMenu'
import { NotificationBell } from '../ui/NotificationPanel'
import { BrandLogo } from './BrandLogo'

type WorkspaceHeaderProps = {
  activeItem: string
  avatarUrl?: string | null
  badges?: Record<string, number>
  items: string[]
  name: string
  notificationUnreadCount: number
  onAccountSecurity: () => void
  onItemChange: (item: string) => void
  onLogout: () => void
  onNotificationClick: () => void
  onProfile: () => void
  onSystemSettings: () => void
  onThemeChange: (theme: 'dark' | 'light', event: MouseEvent<HTMLButtonElement>) => void
  theme: 'dark' | 'light'
}

export function WorkspaceHeader({
  activeItem,
  avatarUrl,
  badges,
  items,
  name,
  notificationUnreadCount,
  onAccountSecurity,
  onItemChange,
  onLogout,
  onNotificationClick,
  onProfile,
  onSystemSettings,
  onThemeChange,
  theme,
}: WorkspaceHeaderProps) {
  return (
    <header className="fixed left-0 right-0 top-0 z-50 border-b border-black/[0.08] bg-[var(--app-header-bg)] backdrop-blur-xl transition-colors duration-300 dark:border-white/[0.06]">
      <div className="mx-auto grid h-16 max-w-[1440px] grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 sm:gap-4 sm:px-5 md:grid-cols-[auto_minmax(0,1fr)_auto] md:px-8">
        <div className="flex min-w-0 items-center gap-4 overflow-hidden">
          <BrandLogo className="h-8 max-w-full object-contain object-left sm:h-10" />
        </div>

        <ScrollableNav activeItem={activeItem} badges={badges} items={items} onChange={onItemChange} />

        <div className="flex shrink-0 items-center justify-end gap-1 sm:gap-2">
          <NotificationBell notificationUnreadCount={notificationUnreadCount} onClick={onNotificationClick} />
          <button
            aria-label="切换主题"
            className="theme-toggle-button rounded-lg p-2 text-slate-600 transition hover:bg-black/5 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
            onClick={(event) => onThemeChange(theme === 'dark' ? 'light' : 'dark', event)}
            type="button"
          >
            {theme === 'dark' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          </button>
          <UserAvatarMenu
            avatarUrl={avatarUrl}
            name={name}
            onAccountSecurity={onAccountSecurity}
            onLogout={onLogout}
            onProfile={onProfile}
            onSystemSettings={onSystemSettings}
          />
        </div>
      </div>
      <div className="border-t border-black/5 px-4 py-2 sm:px-5 md:hidden dark:border-white/10">
        <ScrollableNav activeItem={activeItem} badges={badges} items={items} mobile onChange={onItemChange} />
      </div>
    </header>
  )
}
