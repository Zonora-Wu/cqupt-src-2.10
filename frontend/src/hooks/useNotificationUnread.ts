import { useCallback, useEffect, useState } from 'react'
import { useChatSocket } from './useChatSocket'
import { NOTIFICATION_READ_STATE_EVENT } from '../services/notificationReadState'
import { getNotificationUnreadCount } from '../services/notificationReadState'
import { getNotifications } from '../services/notifications'

const EMPTY_UNREAD = { bell: 0, menu: {} as Record<string, number> }

export function useNotificationUnread() {
  const [unread, setUnread] = useState(EMPTY_UNREAD)

  const refresh = useCallback(() => {
    void getNotifications().then((data) => {
      const legacyChannels = data.channels.filter((channel) => channel.messages.every((message) => message.readAt === undefined))
      setUnread({
        bell: data.unread.bell + getNotificationUnreadCount(legacyChannels),
        menu: data.unread.menu,
      })
    }).catch(() => {})
  }, [])

  const onSocket = useCallback((event: string) => {
    if (event === 'notification.created') refresh()
  }, [refresh])

  useChatSocket(onSocket)

  useEffect(() => {
    refresh()
    const timer = window.setInterval(refresh, 60_000)
    window.addEventListener('focus', refresh)
    window.addEventListener(NOTIFICATION_READ_STATE_EVENT, refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
      window.removeEventListener(NOTIFICATION_READ_STATE_EVENT, refresh)
    }
  }, [refresh])

  return unread
}
