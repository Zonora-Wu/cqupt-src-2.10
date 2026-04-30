import { getSavedSession } from './auth'

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

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api').replace(/\/$/, '')

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
  let response: Response

  try {
    response = await fetch(`${API_BASE_URL}${path}`, { method: 'GET' })
  } catch {
    throw new Error('无法连接后端服务，请确认后端已启动')
  }

  const data = await parseResponse(response)
  if (!response.ok) {
    throw new Error(getApiErrorMessage(data))
  }

  return data as T
}

async function authedRequest<T>(
  path: string,
  options: {
    body?: unknown
    method: 'GET' | 'PATCH' | 'POST'
  },
) {
  const session = getSavedSession()
  if (!session?.accessToken) {
    throw new Error('请先登录后再访问公告')
  }

  let response: Response

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      body: options.body ? JSON.stringify(options.body) : undefined,
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
      },
      method: options.method,
    })
  } catch {
    throw new Error('无法连接后端服务，请确认后端已启动')
  }

  const data = await parseResponse(response)
  if (!response.ok) {
    throw new Error(getApiErrorMessage(data))
  }

  return data as T
}

async function parseResponse(response: Response) {
  const text = await response.text()
  if (!text) {
    return null
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

function getApiErrorMessage(data: unknown) {
  if (typeof data === 'object' && data && 'message' in data) {
    const message = (data as { message?: unknown }).message
    if (Array.isArray(message)) {
      return message.join('，')
    }
    if (typeof message === 'string') {
      return message
    }
  }

  return '请求失败，请稍后重试'
}

