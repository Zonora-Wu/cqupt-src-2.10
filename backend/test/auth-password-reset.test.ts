import assert from 'node:assert/strict'
import test from 'node:test'
import { RoleCode, UserStatus } from '@prisma/client'
import { verifyPassword } from '../src/common/crypto/password'
import { createHash } from 'node:crypto'
import { AuthService } from '../src/modules/auth/auth.service'

test('password reset code uses an isolated purpose', async () => {
  const createdCodes: Array<Record<string, unknown>> = []
  const sentEmails: Array<Record<string, unknown>> = []
  const tx = {
    $executeRaw: async () => 1,
    emailVerificationCode: {
      count: async () => 0,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        createdCodes.push(data)
        return { id: 'code-1' }
      },
      findFirst: async () => null,
      updateMany: async () => ({ count: 0 }),
    },
  }
  const prisma = {
    $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    emailVerificationCode: {
      count: async () => 0,
      findFirst: async () => null,
    },
    user: {
      findUnique: async () => ({
        emailVerifiedAt: new Date(),
        id: 'user-1',
        status: UserStatus.ACTIVE,
      }),
    },
  }
  const humanVerification = { verify: async (_input: unknown, purpose: string) => assert.equal(purpose, 'RESET_PASSWORD') }
  const email = { sendVerificationCode: async (input: Record<string, unknown>) => { sentEmails.push(input) } }
  const service = new AuthService(prisma as never, null as never, humanVerification as never, email as never, null as never)

  await service.sendPasswordResetCode(
    'student@example.com',
    { payload: 'verified', provider: 'altcha' },
    { ipAddress: '127.0.0.1' },
  )

  assert.equal(sentEmails[0]?.purpose, 'RESET_PASSWORD')
  assert.equal(createdCodes[0]?.purpose, 'RESET_PASSWORD')
  assert.equal(createdCodes[0]?.userId, 'user-1')
})

test('resetting password revokes sessions and consumes the code', async () => {
  let passwordHash = ''
  let refreshTokensRevoked = false
  let codeConsumed = false
  let auditWritten = false
  let notificationDispatched = false
  const tx = {
    auditLog: {
      create: async () => { auditWritten = true },
    },
    emailVerificationCode: {
      updateMany: async () => {
        codeConsumed = true
        return { count: 1 }
      },
    },
    refreshToken: {
      updateMany: async () => { refreshTokensRevoked = true },
    },
    user: {
      update: async ({ data }: { data: { passwordHash: string } }) => { passwordHash = data.passwordHash },
    },
  }
  const prisma = {
    $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    emailVerificationCode: {
      findFirst: async () => ({
        attemptCount: 0,
        codeHash: createHash('sha256').update('123456').digest('hex'),
        id: 'code-1',
      }),
    },
    user: {
      findUnique: async () => ({
        email: 'student@example.com',
        id: 'user-1',
        role: { code: RoleCode.STUDENT },
        status: UserStatus.ACTIVE,
      }),
    },
  }
  const notifications = {
    create: async () => 'notification-1',
    dispatchAfterCommit: async (ids: string[]) => {
      assert.deepEqual(ids, ['notification-1'])
      notificationDispatched = true
    },
  }
  const service = new AuthService(prisma as never, null as never, null as never, null as never, notifications as never)

  const result = await service.resetPassword(
    { code: '123456', email: 'student@example.com', newPassword: 'NewPassword1!' },
    { ipAddress: '127.0.0.1', requestPath: '/auth/password-reset' },
  )

  assert.equal(verifyPassword('NewPassword1!', passwordHash), true)
  assert.equal(refreshTokensRevoked, true)
  assert.equal(codeConsumed, true)
  assert.equal(auditWritten, true)
  assert.equal(notificationDispatched, true)
  assert.equal(result.message, '密码已重置，请使用新密码登录。')
})

test('a reset code is invalidated after five failed attempts', async () => {
  let invalidated = false
  const prisma = {
    emailVerificationCode: {
      findFirst: async () => ({
        attemptCount: 4,
        codeHash: createHash('sha256').update('654321').digest('hex'),
        id: 'code-1',
      }),
      updateMany: async ({ data }: { data: { attemptCount?: { increment: number } } }) => {
        invalidated = data.attemptCount?.increment === 1
        return { count: 1 }
      },
    },
    user: {
      findUnique: async () => ({
        id: 'user-1',
        role: { code: RoleCode.STUDENT },
        status: UserStatus.ACTIVE,
      }),
    },
  }
  const service = new AuthService(prisma as never, null as never, null as never, null as never, null as never)

  await assert.rejects(
    service.resetPassword(
      { code: '123456', email: 'student@example.com', newPassword: 'NewPassword1!' },
      { ipAddress: '127.0.0.1' },
    ),
    /邮箱验证码错误或已过期/,
  )
  assert.equal(invalidated, true)
})
