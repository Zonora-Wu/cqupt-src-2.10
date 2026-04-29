export type EmailLoginPayload = {
  code: string
  email: string
}

export type UnifiedLoginPayload = {
  code: string
  password: string
}

export type AuthUser = {
  email?: string
  id?: string
  name: string
  permissions?: string[]
  role: 'student' | 'admin' | 'auditor'
  status?: string
  unifiedCode: string
}

export type AuthSession = {
  accessToken: string
  refreshToken: string
  user: AuthUser
}

type BackendRole = 'STUDENT' | 'AUDITOR' | 'ADMIN'

type BackendUser = {
  email: string
  id: string
  name: string
  permissions: string[]
  role: BackendRole
  status: string
  unifiedCode: string
}

type BackendLoginResponse = {
  accessToken: string
  refreshToken: string
  user: BackendUser
}

type BackendEmailCodeResponse = {
  devCode?: string
  message: string
}

const AUTH_SESSION_KEY = 'cqupt-src-auth-session'
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api').replace(/\/$/, '')

export async function loginWithUnifiedCode(payload: UnifiedLoginPayload) {
  if (!payload.code.trim()) {
    throw new Error('请输入统一认证码')
  }

  if (!payload.password) {
    throw new Error('请输入密码')
  }

  const result = await request<BackendLoginResponse>('/auth/login/password', {
    body: {
      password: payload.password,
      unifiedCode: payload.code.trim(),
    },
    method: 'POST',
  })

  return saveSession(normalizeLoginResponse(result))
}

export async function sendEmailLoginCode(email: string) {
  if (!isValidEmail(email)) {
    throw new Error('请输入正确的邮箱地址')
  }

  return request<BackendEmailCodeResponse>('/auth/email-code', {
    body: {
      email: email.trim(),
    },
    method: 'POST',
  })
}

export async function loginWithEmailCode(payload: EmailLoginPayload) {
  if (!isValidEmail(payload.email)) {
    throw new Error('请输入正确的邮箱地址')
  }

  if (!/^\d{6}$/.test(payload.code)) {
    throw new Error('请输入 6 位邮箱验证码')
  }

  const result = await request<BackendLoginResponse>('/auth/login/email-code', {
    body: {
      code: payload.code,
      email: payload.email.trim(),
    },
    method: 'POST',
  })

  return saveSession(normalizeLoginResponse(result))
}

export async function getCurrentUser() {
  const session = getSavedSession()
  if (!session?.accessToken) {
    return null
  }

  try {
    const user = await request<BackendUser>('/auth/me', {
      accessToken: session.accessToken,
      method: 'GET',
    })
    const nextSession = {
      ...session,
      user: normalizeUser(user),
    }

    window.localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(nextSession))
    return nextSession.user
  } catch (error) {
    clearSavedSession()
    throw error
  }
}

export function getSavedSession() {
  const raw = window.localStorage.getItem(AUTH_SESSION_KEY)
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as AuthSession
  } catch {
    window.localStorage.removeItem(AUTH_SESSION_KEY)
    return null
  }
}

export function clearSavedSession() {
  window.localStorage.removeItem(AUTH_SESSION_KEY)
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function normalizeLoginResponse(response: BackendLoginResponse): AuthSession {
  return {
    accessToken: response.accessToken,
    refreshToken: response.refreshToken,
    user: normalizeUser(response.user),
  }
}

function normalizeUser(user: BackendUser): AuthUser {
  return {
    email: user.email,
    id: user.id,
    name: user.name,
    permissions: user.permissions,
    role: normalizeRole(user.role),
    status: user.status,
    unifiedCode: user.unifiedCode,
  }
}

function normalizeRole(role: BackendRole): AuthUser['role'] {
  if (role === 'ADMIN') return 'admin'
  if (role === 'AUDITOR') return 'auditor'
  return 'student'
}

function saveSession(session: AuthSession) {
  window.localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session))
  return session
}

async function request<T>(path: string, options: { accessToken?: string; body?: unknown; method: 'GET' | 'POST' }) {
  let response: Response
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (options.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`
  }

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      body: options.body ? JSON.stringify(options.body) : undefined,
      headers,
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
