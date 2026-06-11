import { apiRequest } from './apiClient'

export type LearningKind = 'RESOURCE' | 'RANGE'
export type LearningKindLabel = '工具资料' | '靶场资源'

export type LearningResourceItem = {
  active: boolean
  category: string
  createdAt: string
  description: string
  downloadCount: number
  externalUrl: string
  id: string
  kind: LearningKind
  kindLabel: LearningKindLabel
  status: '已上架' | '已下架'
  title: string
  updatedAt: string
}

export type LearningResourcePayload = {
  active: boolean
  category: string
  description: string
  externalUrl: string
  kind: LearningKind
  title: string
}

export type LearningResourceListResponse = {
  items: LearningResourceItem[]
  stats: {
    active: number
    range: number
    resource: number
    total: number
  }
}

export type LearningResourceClickResponse = {
  downloadCount: number
  id: string
  url: string
}

export function listLearningResources() {
  return request<LearningResourceListResponse>('/learning', { method: 'GET' })
}

export function clickLearningResource(id: string) {
  return request<LearningResourceClickResponse>(`/learning/${id}/click`, { method: 'POST' })
}

export function listManagedLearningResources() {
  return request<LearningResourceListResponse>('/learning/manage', { method: 'GET' })
}

export function createLearningResource(payload: LearningResourcePayload) {
  return request<LearningResourceItem>('/learning', {
    body: payload,
    method: 'POST',
  })
}

export function updateLearningResource(id: string, payload: LearningResourcePayload) {
  return request<LearningResourceItem>(`/learning/${id}`, {
    body: payload,
    method: 'PATCH',
  })
}

export function enableLearningResource(id: string) {
  return request<LearningResourceItem>(`/learning/${id}/enable`, { method: 'POST' })
}

export function disableLearningResource(id: string) {
  return request<LearningResourceItem>(`/learning/${id}/disable`, { method: 'POST' })
}

export function deleteLearningResource(id: string) {
  return request<LearningResourceItem>(`/learning/${id}`, { method: 'DELETE' })
}

async function request<T>(
  path: string,
  options: {
    body?: unknown
    method: 'DELETE' | 'GET' | 'PATCH' | 'POST'
  },
) {
  return apiRequest<T>(path, {
    ...options,
    auth: true,
    unauthenticatedMessage: '请先登录后再访问学习资源',
  })
}
