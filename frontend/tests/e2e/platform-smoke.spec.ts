import { expect, test, type APIRequestContext } from '@playwright/test'
import { sha, solveChallenge, type Challenge } from 'altcha/lib'

const apiBaseUrl = process.env.E2E_API_BASE_URL ?? 'http://127.0.0.1:3001/api'

const accounts = [
  { code: process.env.CQUPT_SRC_STUDENT_CODE ?? '2025001', password: process.env.CQUPT_SRC_STUDENT_PASSWORD ?? '123456+-', role: 'STUDENT' },
  { code: process.env.CQUPT_SRC_AUDITOR_CODE ?? '0000001', password: process.env.CQUPT_SRC_AUDITOR_PASSWORD ?? 'auditor123456+-', role: 'AUDITOR' },
  { code: process.env.CQUPT_SRC_ADMIN_CODE ?? '0000000', password: process.env.CQUPT_SRC_ADMIN_PASSWORD ?? 'admin123456+-', role: 'ADMIN' },
] as const

test('public home renders without failed first-party resources', async ({ page }) => {
  const failures: string[] = []
  page.on('response', (response) => {
    if (response.url().startsWith(page.url().split('/').slice(0, 3).join('/')) && response.status() >= 400) {
      failures.push(`${response.status()} ${response.url()}`)
    }
  })
  await page.goto('/')
  await expect(page.getByRole('button', { name: '登录', exact: true }).first()).toBeVisible()
  await expect(page.locator('main')).toBeVisible()
  expect(failures).toEqual([])
})

for (const account of accounts) {
  test(`${account.role.toLowerCase()} authenticates and receives the expected role`, async ({ request }) => {
    const token = await login(request, account.code, account.password)
    const response = await request.get(`${apiBaseUrl}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
    expect(response.ok()).toBeTruthy()
    const body = await response.json() as { role?: { code?: string } | string }
    const role = typeof body.role === 'string' ? body.role : body.role?.code
    expect(role).toBe(account.role)
  })
}

test('student cannot access administrator system settings', async ({ request }) => {
  const account = accounts[0]
  const token = await login(request, account.code, account.password)
  const response = await request.get(`${apiBaseUrl}/system-settings`, { headers: { Authorization: `Bearer ${token}` } })
  expect([401, 403, 404]).toContain(response.status())
})

async function login(request: APIRequestContext, code: string, password: string) {
  const challengeResponse = await request.post(`${apiBaseUrl}/human-verification/challenge`, { data: { purpose: 'LOGIN_PASSWORD' } })
  expect(challengeResponse.ok(), await challengeResponse.text()).toBeTruthy()
  const challengeBody = await challengeResponse.json() as { challenge: Challenge }
  const solution = await solveChallenge({ challenge: challengeBody.challenge, deriveKey: sha.deriveKey, timeout: 60_000 })
  expect(solution).not.toBeNull()
  const payload = Buffer.from(JSON.stringify({ challenge: challengeBody.challenge, solution })).toString('base64')
  const response = await request.post(`${apiBaseUrl}/auth/login/password`, {
    data: { humanVerification: { payload, provider: 'altcha' }, password, unifiedCode: code },
  })
  expect(response.ok(), await response.text()).toBeTruthy()
  const body = await response.json() as { accessToken?: string }
  expect(body.accessToken).toBeTruthy()
  return body.accessToken as string
}
