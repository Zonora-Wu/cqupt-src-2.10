import { ApiError, apiRequest } from './apiClient'
import { type HumanVerificationPayload } from './humanVerification'

export type EmailLoginPayload = {
  code: string
  email: string
}

export type UnifiedLoginPayload = Partial<HumanVerificationPayload> & {
  code: string
  password: string
}

export type RegisterPayload = {
  code: string
  email: string
  name: string
  password: string
  unifiedCode: string
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

type BackendPendingRegistrationResponse = {
  pending: true
  message: string
}

export type RegisterResult =
  | { pending: false; session: AuthSession }
  | { pending: true; message: string }

type BackendEmailCodeResponse = {
  devCode?: string
  message: string
}

const AUTH_SESSION_KEY = 'cqupt-src-auth-session'
export async function loginWithUnifiedCode(payload: UnifiedLoginPayload) {
  const unifiedCode = normalizeUnifiedCode(payload.code)
  if (!isValidUnifiedCode(unifiedCode)) {
    throw new Error('请输入 7 位数字统一认证码')
  }

  if (!payload.password) {
    throw new Error('请输入密码')
  }

  const result = await apiRequest<BackendLoginResponse>('/auth/login/password', {
    body: {
      ...(payload.humanVerification ? { humanVerification: payload.humanVerification } : {}),
      password: payload.password,
      unifiedCode,
    },
    method: 'POST',
  })

  return saveSession(normalizeLoginResponse(result))
}

export async function sendEmailLoginCode(email: string, humanVerification: HumanVerificationPayload['humanVerification']) {
  if (!isValidEmail(email)) {
    throw new Error('请输入正确的邮箱地址')
  }

  if (!humanVerification.payload) {
    throw new Error('请先完成安全校验')
  }

  return apiRequest<BackendEmailCodeResponse>('/auth/email-code', {
    body: {
      email: email.trim(),
      humanVerification,
    },
    method: 'POST',
  })
}

export async function sendRegisterEmailCode(email: string, humanVerification: HumanVerificationPayload['humanVerification']) {
  if (!isValidEmail(email)) {
    throw new Error('请输入正确的邮箱地址')
  }

  if (!humanVerification.payload) {
    throw new Error('请先完成安全校验')
  }

  return apiRequest<BackendEmailCodeResponse>('/auth/register/email-code', {
    body: {
      email: email.trim(),
      humanVerification,
    },
    method: 'POST',
  })
}

export async function registerAccount(payload: RegisterPayload): Promise<RegisterResult> {
  const unifiedCode = normalizeUnifiedCode(payload.unifiedCode)
  if (!isValidUnifiedCode(unifiedCode)) {
    throw new Error('请输入 7 位数字统一认证码')
  }

  const result = await apiRequest<BackendLoginResponse | BackendPendingRegistrationResponse>('/auth/register', {
    body: {
      code: payload.code,
      email: payload.email.trim(),
      name: payload.name.trim(),
      password: payload.password,
      unifiedCode,
    },
    method: 'POST',
  })

  if ('pending' in result && result.pending === true) {
    return { pending: true, message: result.message }
  }

  const session = saveSession(normalizeLoginResponse(result as BackendLoginResponse))
  return { pending: false, session }
}

export async function loginWithEmailCode(payload: EmailLoginPayload) {
  if (!isValidEmail(payload.email)) {
    throw new Error('请输入正确的邮箱地址')
  }

  if (!/^\d{6}$/.test(payload.code)) {
    throw new Error('请输入 6 位邮箱验证码')
  }

  const result = await apiRequest<BackendLoginResponse>('/auth/login/email-code', {
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
    const user = await apiRequest<BackendUser>('/auth/me', {
      auth: true,
      method: 'GET',
    })
    const nextSession = {
      ...session,
      user: normalizeUser(user),
    }

    window.localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(nextSession))
    return nextSession.user
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      clearSavedSession()
    }
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

export function normalizeUnifiedCode(value: string) {
  return value.replace(/\D/g, '').slice(0, 7)
}

export function isValidUnifiedCode(value: string) {
  return /^\d{7}$/.test(value)
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
