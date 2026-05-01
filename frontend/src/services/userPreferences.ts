export type ThemeMode = 'dark' | 'light' | 'system'
export type EffectiveTheme = 'dark' | 'light'
export type DisplayLanguage = 'en-US' | 'zh-CN'

export type UserDevicePreferences = {
  compactMode: boolean
  language: DisplayLanguage
  notifications: {
    announcement: boolean
    pointsChange: boolean
    systemAlert: boolean
    vulnAudit: boolean
  }
  reduceMotion: boolean
  themeMode: ThemeMode
}

const STORAGE_PREFIX = 'cqupt-src-device-preferences'

export const defaultUserDevicePreferences: UserDevicePreferences = {
  compactMode: false,
  language: 'zh-CN',
  notifications: {
    announcement: true,
    pointsChange: false,
    systemAlert: true,
    vulnAudit: true,
  },
  reduceMotion: false,
  themeMode: 'dark',
}

export function getUserDevicePreferences(userKey: string): UserDevicePreferences {
  const key = getStorageKey(userKey)
  const raw = window.localStorage.getItem(key)
  if (!raw) return defaultUserDevicePreferences

  try {
    const parsed = JSON.parse(raw) as Partial<UserDevicePreferences>
    return normalizePreferences(parsed)
  } catch {
    window.localStorage.removeItem(key)
    return defaultUserDevicePreferences
  }
}

export function saveUserDevicePreferences(userKey: string, preferences: UserDevicePreferences) {
  window.localStorage.setItem(getStorageKey(userKey), JSON.stringify(normalizePreferences(preferences)))
}

export function resetUserDevicePreferences(userKey: string) {
  window.localStorage.removeItem(getStorageKey(userKey))
  return defaultUserDevicePreferences
}

export function resolveThemeMode(themeMode: ThemeMode): EffectiveTheme {
  if (themeMode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }

  return themeMode
}

function getStorageKey(userKey: string) {
  return `${STORAGE_PREFIX}:${userKey}`
}

function normalizePreferences(input: Partial<UserDevicePreferences>): UserDevicePreferences {
  return {
    compactMode: typeof input.compactMode === 'boolean' ? input.compactMode : defaultUserDevicePreferences.compactMode,
    language: input.language === 'en-US' ? 'en-US' : 'zh-CN',
    notifications: {
      announcement:
        typeof input.notifications?.announcement === 'boolean'
          ? input.notifications.announcement
          : defaultUserDevicePreferences.notifications.announcement,
      pointsChange:
        typeof input.notifications?.pointsChange === 'boolean'
          ? input.notifications.pointsChange
          : defaultUserDevicePreferences.notifications.pointsChange,
      systemAlert:
        typeof input.notifications?.systemAlert === 'boolean'
          ? input.notifications.systemAlert
          : defaultUserDevicePreferences.notifications.systemAlert,
      vulnAudit:
        typeof input.notifications?.vulnAudit === 'boolean'
          ? input.notifications.vulnAudit
          : defaultUserDevicePreferences.notifications.vulnAudit,
    },
    reduceMotion: typeof input.reduceMotion === 'boolean' ? input.reduceMotion : defaultUserDevicePreferences.reduceMotion,
    themeMode:
      input.themeMode === 'light' || input.themeMode === 'system' || input.themeMode === 'dark'
        ? input.themeMode
        : defaultUserDevicePreferences.themeMode,
  }
}
