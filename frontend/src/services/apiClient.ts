export const AUTH_SESSION_EXPIRED_EVENT = 'cqupt-src-auth-session-expired'

type HttpMethod = 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT'

type ApiRequestOptions = {
  auth?: boolean
  body?: unknown
  headers?: Record<string, string>
  method: HttpMethod
  unauthenticatedMessage?: string
}

type ApiFormRequestOptions = {
  auth?: boolean
  formData: FormData
  method?: 'PATCH' | 'POST' | 'PUT'
  unauthenticatedMessage?: string
}

type ApiBlobRequestOptions = {
  auth?: boolean
  method?: 'GET' | 'POST'
  unauthenticatedMessage?: string
}

type StoredSession = {
  accessToken?: string
}

const AUTH_SESSION_KEY = 'cqupt-src-auth-session'
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api').replace(/\/$/, '')

export class ApiError extends Error {
  data: unknown
  status: number | null

  constructor(message: string, options: { data?: unknown; status?: number | null } = {}) {
    super(message)
    this.name = 'ApiError'
    this.data = options.data ?? null
    this.status = options.status ?? null
  }
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions) {
  const response = await rawApiRequest(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    rawBody: options.body === undefined ? undefined : JSON.stringify(options.body),
  })

  const data = await parseResponse(response)
  assertOk(response, data, Boolean(options.auth))
  return data as T
}

export async function apiFormRequest<T>(path: string, options: ApiFormRequestOptions) {
  const response = await rawApiRequest(path, {
    auth: options.auth,
    method: options.method ?? 'POST',
    rawBody: options.formData,
    unauthenticatedMessage: options.unauthenticatedMessage,
  })

  const data = await parseResponse(response)
  assertOk(response, data, Boolean(options.auth))
  return data as T
}

export async function apiBlobRequest(path: string, options: ApiBlobRequestOptions = {}) {
  const response = await rawApiRequest(path, {
    auth: options.auth,
    method: options.method ?? 'GET',
    unauthenticatedMessage: options.unauthenticatedMessage,
  })

  if (!response.ok) {
    const data = await parseResponse(response)
    assertOk(response, data, Boolean(options.auth))
  }

  return response.blob()
}

async function rawApiRequest(
  path: string,
  options: ApiRequestOptions & {
    rawBody?: BodyInit
  },
) {
  const headers: Record<string, string> = {
    ...options.headers,
  }

  if (options.auth) {
    const accessToken = getAccessToken()
    if (!accessToken) {
      invalidateSession()
      throw new ApiError(options.unauthenticatedMessage ?? '登录状态已失效，请重新登录', { status: 401 })
    }
    headers.Authorization = `Bearer ${accessToken}`
  }

  try {
    return await fetch(`${API_BASE_URL}${path}`, {
      body: options.rawBody,
      headers,
      method: options.method,
    })
  } catch {
    throw new ApiError('无法连接后端服务，请确认后端已启动', { status: null })
  }
}

async function parseResponse(response: Response) {
  const text = await response.text()
  if (!text) return null

  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

function assertOk(response: Response, data: unknown, authenticatedRequest: boolean) {
  if (response.ok) return

  if (authenticatedRequest && response.status === 401) {
    invalidateSession()
  }

  throw new ApiError(getApiErrorMessage(data), {
    data,
    status: response.status,
  })
}

function getAccessToken() {
  const raw = window.localStorage.getItem(AUTH_SESSION_KEY)
  if (!raw) return null

  try {
    const session = JSON.parse(raw) as StoredSession
    return session.accessToken ?? null
  } catch {
    window.localStorage.removeItem(AUTH_SESSION_KEY)
    return null
  }
}

function invalidateSession() {
  window.localStorage.removeItem(AUTH_SESSION_KEY)
  window.dispatchEvent(new CustomEvent(AUTH_SESSION_EXPIRED_EVENT))
}

function getApiErrorMessage(data: unknown) {
  if (typeof data === 'object' && data && 'message' in data) {
    const message = (data as { message?: unknown }).message
    if (Array.isArray(message)) return message.join('，')
    if (typeof message === 'string') return message
  }

  return '请求失败，请稍后重试'
}
