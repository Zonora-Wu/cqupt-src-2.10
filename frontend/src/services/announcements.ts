import { apiRequest } from './apiClient'

export type AnnouncementStatusLabel = '草稿' | '已发布' | '已下架'
export type AnnouncementRangeLabel = '全体用户' | '学生用户' | '审核员' | '管理员'

export type AnnouncementItem = {
  author: string
  category: string
  content: string
  createdAt: string
  id: string
  offlineAt: string | null
  pinned: boolean
  publishedAt: string | null
  range: AnnouncementRangeLabel
  rangeCode: 'ALL' | 'STUDENTS' | 'AUDITORS' | 'ADMINS'
  readCount: number
  status: AnnouncementStatusLabel
  statusCode: 'DRAFT' | 'PUBLISHED' | 'OFFLINE'
  summary: string
  title: string
  updatedAt: string
}

export type AnnouncementPayload = {
  category: string
  content: string
  pinned: boolean
  range: AnnouncementRangeLabel
  summary: string
  title: string
}

export type AnnouncementListResponse = {
  items: AnnouncementItem[]
  stats?: {
    draft: number
    offline: number
    published: number
    total: number
  }
}

export function listPublicAnnouncements() {
  return publicRequest<AnnouncementListResponse>('/announcements/public')
}

export function getPublicAnnouncement(id: string) {
  return publicRequest<AnnouncementItem>(`/announcements/public/${id}`)
}

export function listVisibleAnnouncements() {
  return authedRequest<AnnouncementListResponse>('/announcements/visible', { method: 'GET' })
}

export function getVisibleAnnouncement(id: string) {
  return authedRequest<AnnouncementItem>(`/announcements/visible/${id}`, { method: 'GET' })
}

export function listManagedAnnouncements() {
  return authedRequest<AnnouncementListResponse>('/announcements/manage', { method: 'GET' })
}

export function createAnnouncement(payload: AnnouncementPayload) {
  return authedRequest<AnnouncementItem>('/announcements', {
    body: payload,
    method: 'POST',
  })
}

export function updateAnnouncement(id: string, payload: AnnouncementPayload) {
  return authedRequest<AnnouncementItem>(`/announcements/${id}`, {
    body: payload,
    method: 'PATCH',
  })
}

export function publishAnnouncement(id: string) {
  return authedRequest<AnnouncementItem>(`/announcements/${id}/publish`, { method: 'POST' })
}

export function offlineAnnouncement(id: string) {
  return authedRequest<AnnouncementItem>(`/announcements/${id}/offline`, { method: 'POST' })
}

async function publicRequest<T>(path: string) {
  return apiRequest<T>(path, { method: 'GET' })
}

async function authedRequest<T>(
  path: string,
  options: {
    body?: unknown
    method: 'GET' | 'PATCH' | 'POST'
  },
) {
  return apiRequest<T>(path, {
    ...options,
    auth: true,
    unauthenticatedMessage: '请先登录后再访问公告',
  })
}
