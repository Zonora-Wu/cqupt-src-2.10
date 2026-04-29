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
  name: string
  role: 'student' | 'admin' | 'auditor'
  unifiedCode: string
}

const DEMO_EMAIL_CODE = '123456'
const DEMO_UNIFIED_CODE = '2025001'
const DEMO_PASSWORD = '123456+-'
const DEMO_ADMIN_CODE = '0000000'
const DEMO_ADMIN_PASSWORD = 'admin123456+-'
const DEMO_AUDITOR_CODE = '0000001'
const DEMO_AUDITOR_PASSWORD = 'auditor123456+-'

export async function loginWithUnifiedCode(payload: UnifiedLoginPayload) {
  await wait(500)

  if (!payload.code.trim()) {
    throw new Error('请输入统一认证码')
  }

  if (!payload.password) {
    throw new Error('请输入密码')
  }

  if (payload.code === DEMO_ADMIN_CODE && payload.password === DEMO_ADMIN_PASSWORD) {
    return {
      token: 'demo-admin-login-token',
      user: {
        email: 'admin@cqupt-src.local',
        name: '平台管理员',
        role: 'admin' as const,
        unifiedCode: DEMO_ADMIN_CODE,
      },
    }
  }

  if (payload.code === DEMO_AUDITOR_CODE && payload.password === DEMO_AUDITOR_PASSWORD) {
    return {
      token: 'demo-auditor-login-token',
      user: {
        email: 'auditor@cqupt-src.local',
        name: '审核员 A',
        role: 'auditor' as const,
        unifiedCode: DEMO_AUDITOR_CODE,
      },
    }
  }

  if (payload.code !== DEMO_UNIFIED_CODE || payload.password !== DEMO_PASSWORD) {
    throw new Error('统一认证码或密码错误')
  }

  return {
    token: 'demo-unified-login-token',
    user: {
      email: 'student2025001@cqupt.edu.cn',
      name: '学生用户',
      role: 'student' as const,
      unifiedCode: DEMO_UNIFIED_CODE,
    },
  }
}

export async function sendEmailLoginCode(email: string) {
  await wait(500)

  if (!isValidEmail(email)) {
    throw new Error('请输入正确的邮箱地址')
  }

  return {
    message: `验证码已发送至 ${email}`,
  }
}

export async function loginWithEmailCode(payload: EmailLoginPayload) {
  await wait(600)

  if (!isValidEmail(payload.email)) {
    throw new Error('请输入正确的邮箱地址')
  }

  if (!/^\d{6}$/.test(payload.code)) {
    throw new Error('请输入 6 位邮箱验证码')
  }

  if (payload.code !== DEMO_EMAIL_CODE) {
    throw new Error('演示环境验证码为 123456')
  }

  return {
    token: 'demo-email-login-token',
    user: {
      email: payload.email,
      name: 'CQUPT-SRC 用户',
      role: 'student' as const,
      unifiedCode: 'EMAIL_USER',
    },
  }
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function wait(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}
