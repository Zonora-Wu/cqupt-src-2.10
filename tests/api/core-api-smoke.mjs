const API_BASE_URL = (process.env.API_BASE_URL ?? 'http://localhost:3000/api').replace(/\/$/, '')

const accounts = {
  admin: {
    password: process.env.CQUPT_SRC_ADMIN_PASSWORD ?? 'admin123456+-',
    unifiedCode: process.env.CQUPT_SRC_ADMIN_CODE ?? '0000000',
  },
  auditor: {
    password: process.env.CQUPT_SRC_AUDITOR_PASSWORD ?? 'auditor123456+-',
    unifiedCode: process.env.CQUPT_SRC_AUDITOR_CODE ?? '0000001',
  },
  student: {
    password: process.env.CQUPT_SRC_STUDENT_PASSWORD ?? '123456+-',
    unifiedCode: process.env.CQUPT_SRC_STUDENT_CODE ?? '2025001',
  },
}

const results = []

async function main() {
  console.log(`Core API smoke test target: ${API_BASE_URL}`)

  await step('health check', () => request('/health'))
  await step('public announcements', () => request('/announcements/public'))

  const student = await login('student', accounts.student)
  const auditor = await login('auditor', accounts.auditor)
  const admin = await login('admin', accounts.admin)

  if (!student?.accessToken || !auditor?.accessToken || !admin?.accessToken) {
    console.log('')
    console.log('Authenticated checks skipped because one or more demo accounts could not log in.')
    printSummary()
    return
  }

  await step('student current user', () => request('/auth/me', { token: student.accessToken }))
  await step('student access status', () => request('/access/status', { token: student.accessToken }))
  await step('student visible announcements', () => request('/announcements/visible', { token: student.accessToken }))
  await step('student learning resources', () => request('/learning', { token: student.accessToken }))
  await step('student vulnerability list', () => request('/vulnerabilities/my', { token: student.accessToken }))
  await step('student certificate list', () => request('/certificates/my', { token: student.accessToken }))
  await step('student points summary', () => request('/points/summary', { token: student.accessToken }))
  await step('student points ledger', () => request('/points/ledger', { token: student.accessToken }))
  await step('student mall products', () => request('/mall/products', { token: student.accessToken }))
  await step('student mall redemptions', () => request('/mall/redemptions/my', { token: student.accessToken }))

  await step('auditor review queue', () => request('/vulnerabilities/review-queue', { token: auditor.accessToken }))
  await step('auditor announcements manage', () => request('/announcements/manage', { token: auditor.accessToken }))
  await step('auditor certificates manage', () => request('/certificates/manage', { token: auditor.accessToken }))

  await step('admin users manage', () => request('/users/manage', { token: admin.accessToken }))
  await step('admin user options', () => request('/users/manage/options', { token: admin.accessToken }))
  await step('admin audit logs', () => request('/audit-logs', { token: admin.accessToken }))
  await step('admin audit stats', () => request('/audit-logs/stats', { token: admin.accessToken }))
  await step('admin announcements manage', () => request('/announcements/manage', { token: admin.accessToken }))
  await step('admin learning manage', () => request('/learning/manage', { token: admin.accessToken }))
  await step('admin mall products manage', () => request('/mall/manage/products', { token: admin.accessToken }))
  await step('admin mall redemptions manage', () => request('/mall/manage/redemptions', { token: admin.accessToken }))
  await step('admin certificates manage', () => request('/certificates/manage', { token: admin.accessToken }))
  await step('admin active certificate template', () =>
    request('/system-settings/certificate-template/active', { token: admin.accessToken }),
  )

  printSummary()
}

async function login(label, account) {
  return step(`${label} login`, async () => {
    const data = await request('/auth/login/password', {
      body: {
        password: account.password,
        unifiedCode: account.unifiedCode,
      },
      method: 'POST',
    })

    if (!data?.accessToken) {
      throw new Error('login response did not include accessToken')
    }

    return data
  })
}

async function step(label, action) {
  const startedAt = performance.now()

  try {
    const result = await action()
    const duration = Math.round(performance.now() - startedAt)
    results.push({ duration, label, ok: true })
    console.log(`PASS ${label} (${duration}ms)`)
    return result
  } catch (error) {
    const duration = Math.round(performance.now() - startedAt)
    const message = error instanceof Error ? error.message : String(error)
    results.push({ duration, label, message, ok: false })
    console.error(`FAIL ${label} (${duration}ms): ${message}`)
    return null
  }
}

async function request(path, options = {}) {
  const headers = {
    Accept: 'application/json',
  }

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`
  }

  let response

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      headers,
      method: options.method ?? 'GET',
    })
  } catch (error) {
    throw new Error(`cannot connect to backend: ${error instanceof Error ? error.message : String(error)}`)
  }

  const contentType = response.headers.get('content-type') ?? ''
  const text = await response.text()
  const data = parseJsonOrText(text, contentType)

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${formatMessage(data)}`)
  }

  if (typeof data === 'string' && data.trim().startsWith('<!doctype html')) {
    throw new Error('received frontend HTML instead of API JSON; backend may not be running on this port')
  }

  return data
}

function parseJsonOrText(text, contentType) {
  if (!text) return null

  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(text)
    } catch {
      throw new Error('response content-type is JSON but body is not valid JSON')
    }
  }

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function formatMessage(data) {
  if (typeof data === 'object' && data && 'message' in data) {
    const message = data.message
    return Array.isArray(message) ? message.join('; ') : String(message)
  }

  if (typeof data === 'string') {
    return data.slice(0, 180).replace(/\s+/g, ' ')
  }

  return JSON.stringify(data)
}

function printSummary() {
  const failed = results.filter((item) => !item.ok)

  console.log('')
  console.log(`Summary: ${results.length - failed.length}/${results.length} passed`)

  if (failed.length > 0) {
    console.log('')
    console.log('Failed checks:')
    failed.forEach((item) => {
      console.log(`- ${item.label}: ${item.message}`)
    })
    process.exitCode = 1
  }
}

await main()
