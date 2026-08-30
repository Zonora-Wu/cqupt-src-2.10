import { apiRequest } from './apiClient'

export type NotificationMessage = {
  content: string
  createdAt: string
  entityId?: string | null
  entityType?: string | null
  id: string
  readAt?: string | null
  route?: string | null
}

export type NotificationChannel = {
  iconType: 'award' | 'bell' | 'megaphone' | 'shield'
  id: string
  messages: NotificationMessage[]
  title: string
}

export type NotificationsResponse = {
  channels: NotificationChannel[]
  unread: {
    bell: number
    menu: Record<string, number>
  }
}

export function markNotificationRead(notificationId: string) {
  return apiRequest<{ success: boolean }>(`/notifications/${notificationId}/read`, { auth: true, method: 'POST' })
}

export function markNotificationChannelRead(channelId: string) {
  return apiRequest<{ success: boolean }>(`/notifications/channels/${channelId}/read`, { auth: true, method: 'POST' })
}

export function markNotificationEntityRead(entityType: string, entityId: string, menuScope?: string) {
  return apiRequest<{ success: boolean }>('/notifications/entities/mark-read', {
    auth: true,
    body: { entityId, entityType, menuScope },
    method: 'POST',
  })
}

export function getNotifications() {
  return apiRequest<NotificationsResponse>('/notifications', {
    auth: true,
    method: 'GET',
    unauthenticatedMessage: '请先登录后查看通知',
  })
}
