import { getSavedSession } from './auth'
import type { NotificationChannel } from './notifications'

const LEGACY_SEEN_KEY_PREFIX = 'notif_seen_'
const SEEN_KEY_PREFIX = 'cqupt-src-notification-seen'
export const NOTIFICATION_READ_STATE_EVENT = 'cqupt-src:notification-read-state-changed'

function getUserScope() {
  const user = getSavedSession()?.user
  return user?.id ?? user?.unifiedCode ?? 'anonymous'
}

function getSeenKey(channelId: string) {
  return `${SEEN_KEY_PREFIX}:${getUserScope()}:${channelId}`
}

export function getNotificationSeenAt(channelId: string) {
  try {
    const scopedValue = localStorage.getItem(getSeenKey(channelId))
    if (scopedValue !== null) return Number(scopedValue) || 0
    return Number(localStorage.getItem(`${LEGACY_SEEN_KEY_PREFIX}${channelId}`)) || 0
  } catch {
    return 0
  }
}

export function markNotificationSeen(channelId: string, seenAt = Date.now()) {
  try {
    localStorage.setItem(getSeenKey(channelId), String(seenAt))
  } catch {
    // localStorage unavailable - keep the notification state for this render only.
  }
  window.dispatchEvent(new Event(NOTIFICATION_READ_STATE_EVENT))
}

export function getNotificationUnreadCount(channels: NotificationChannel[]) {
  return channels.reduce((total, channel) => (
    total + channel.messages.filter((message) => new Date(message.createdAt).getTime() > getNotificationSeenAt(channel.id)).length
  ), 0)
}
