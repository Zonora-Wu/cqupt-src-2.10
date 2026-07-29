import assert from 'node:assert/strict'
import test from 'node:test'
import { validatePublicHttpsUrl } from '../src/common/security/outbound-url'
import { SecurityRateLimitService } from '../src/common/security/security-rate-limit.service'
import { validateEnv } from '../src/config/env'

test('outbound model URL rejects local and cloud metadata targets', async () => {
  const blocked = [
    'https://localhost/v1',
    'https://127.0.0.1/v1',
    'https://169.254.169.254/latest/meta-data',
    'https://10.0.0.1/v1',
    'https://[::1]/v1',
    'https://[fd00::1]/v1',
    'https://example.com:8443/v1',
  ]

  for (const target of blocked) {
    await assert.rejects(validatePublicHttpsUrl(target))
  }
})

test('environment validation rejects weak or reused secrets', () => {
  const encryptionKey = Buffer.alloc(32, 7).toString('base64')
  const base = {
    AI_CREDENTIAL_ENCRYPTION_KEY: encryptionKey,
    DATABASE_URL: 'postgresql://example.invalid/database',
    JWT_ACCESS_SECRET: 'a'.repeat(40),
    JWT_REFRESH_SECRET: 'b'.repeat(40),
    NODE_ENV: 'development',
  }

  assert.doesNotThrow(() => validateEnv(base))
  assert.throws(() => validateEnv({ ...base, JWT_ACCESS_SECRET: 'short' }), /JWT_ACCESS_SECRET/)
  assert.throws(() => validateEnv({ ...base, JWT_REFRESH_SECRET: base.JWT_ACCESS_SECRET }), /must be different/)
  assert.throws(() => validateEnv({ ...base, NODE_ENV: 'production' }), /REDIS_URL/)
})

test('fallback limiter blocks requests above the configured window limit', async () => {
  const limiter = new SecurityRateLimitService()
  await limiter.consume('test', 'same-subject', 2, 60_000)
  await limiter.consume('test', 'same-subject', 2, 60_000)
  await assert.rejects(limiter.consume('test', 'same-subject', 2, 60_000), { status: 429 })
  await limiter.onModuleDestroy()
})
