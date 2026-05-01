import { apiRequest } from './apiClient'

export type NotificationMessage = {
  content: string
  createdAt: string
  id: string
}

export type NotificationChannel = {
  iconType: 'award' | 'bell' | 'megaphone' | 'shield'
  id: string
  messages: NotificationMessage[]
  title: string
}

export type NotificationsResponse = {
  channels: NotificationChannel[]
}

export function getNotifications() {
  return apiRequest<NotificationsResponse>('/notifications', {
    auth: true,
    method: 'GET',
    unauthenticatedMessage: '请先登录后查看通知',
  })
}
