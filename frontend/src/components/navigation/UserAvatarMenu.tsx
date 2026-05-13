import { CircleUserRound, LogOut, Settings2, ShieldCheck } from 'lucide-react'
import { useRef, useState } from 'react'

type UserAvatarMenuProps = {
  avatarUrl?: string | null
  name: string
  onAccountSecurity: () => void
  onLogout: () => void
  onProfile: () => void
  onSystemSettings: () => void
}

export function UserAvatarMenu({
  avatarUrl,
  name,
  onAccountSecurity,
  onLogout,
  onProfile,
  onSystemSettings,
}: UserAvatarMenuProps) {
  const closeTimerRef = useRef<number | null>(null)
  const [open, setOpen] = useState(false)

  const openMenu = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
    setOpen(true)
  }

  const scheduleClose = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
    }
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false)
      closeTimerRef.current = null
    }, 160)
  }

  return (
    <div
      className="relative"
      onMouseEnter={openMenu}
      onMouseLeave={scheduleClose}
    >
      <button
        aria-label="打开用户菜单"
        className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-brand-600 text-base font-semibold text-white shadow-[0_0_18px_rgba(42,100,56,0.35)] transition hover:bg-brand-700"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        {avatarUrl ? (
          <img alt={name} className="h-full w-full object-cover" src={avatarUrl} />
        ) : (
          name.slice(0, 1)
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-[90] pt-3">
        <div className="w-44 overflow-hidden rounded-lg border border-black/10 bg-[#f7f9f7]/95 p-1 shadow-xl backdrop-blur-sm dark:border-white/10 dark:bg-[#0f1511]/95">
          <MenuItem icon={<CircleUserRound />} label="个人中心" onClick={() => runAndClose(onProfile, setOpen)} />
          <MenuItem icon={<ShieldCheck />} label="账号安全" onClick={() => runAndClose(onAccountSecurity, setOpen)} />
          <MenuItem icon={<Settings2 />} label="系统设置" onClick={() => runAndClose(onSystemSettings, setOpen)} />
          <div className="my-1 h-px bg-black/10 dark:bg-white/10" />
          <MenuItem danger icon={<LogOut />} label="退出登录" onClick={() => runAndClose(onLogout, setOpen)} />
        </div>
        </div>
      )}
    </div>
  )
}

function runAndClose(callback: () => void, setOpen: (open: boolean) => void) {
  callback()
  setOpen(false)
}

function MenuItem({
  danger = false,
  icon,
  label,
  onClick,
}: {
  danger?: boolean
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition ${
        danger
          ? 'text-red-600 hover:bg-red-500/10 dark:text-red-300'
          : 'text-slate-700 hover:bg-black/5 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white'
      } [&>svg]:h-4 [&>svg]:w-4`}
      onClick={onClick}
      type="button"
    >
      {icon}
      {label}
    </button>
  )
}
