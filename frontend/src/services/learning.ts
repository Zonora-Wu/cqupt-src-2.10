import { getSavedSession } from './auth'

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

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api').replace(/\/$/, '')

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
  const session = getSavedSession()
  if (!session?.accessToken) {
    throw new Error('请先登录后再访问学习资源')
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

