import assert from 'node:assert/strict'
import test from 'node:test'
import { HealthService } from '../src/modules/health/health.service'

test('readiness fails when a required dependency is unavailable', async () => {
  const previousNodeEnv = process.env.NODE_ENV
  const previousAiUrl = process.env.OPENAI_BASE_URL
  process.env.NODE_ENV = 'production'
  delete process.env.OPENAI_BASE_URL
  const service = new HealthService(
    { $queryRaw: async () => { throw new Error('database unavailable') } } as never,
    { checkHealth: async () => ({ required: true, status: 'ok' }) } as never,
    { getHealth: () => ({ configured: true, ready: true }) } as never,
    { checkHealth: async () => true } as never,
  )
  try {
    const result = await service.checkReadiness()
    assert.equal(result.ready, false)
    assert.equal(result.status, 'unavailable')
    assert.equal(result.dependencies.database.status, 'down')
    assert.equal(result.dependencies.ai.status, 'skipped')
  } finally {
    restoreEnv('NODE_ENV', previousNodeEnv)
    restoreEnv('OPENAI_BASE_URL', previousAiUrl)
  }
})

test('AI failure degrades readiness without taking core platform offline', async () => {
  const previousNodeEnv = process.env.NODE_ENV
  const previousAiUrl = process.env.OPENAI_BASE_URL
  const previousFetch = global.fetch
  process.env.NODE_ENV = 'production'
  process.env.OPENAI_BASE_URL = 'https://1.1.1.1/v1'
  global.fetch = (async () => new Response('', { status: 503 })) as typeof fetch
  const service = new HealthService(
    { $queryRaw: async () => [{ result: 1 }] } as never,
    { checkHealth: async () => ({ required: true, status: 'ok' }) } as never,
    { getHealth: () => ({ configured: true, ready: true }) } as never,
    { checkHealth: async () => true } as never,
  )
  try {
    const result = await service.checkReadiness()
    assert.equal(result.ready, true)
    assert.equal(result.status, 'degraded')
    assert.equal(result.dependencies.ai.status, 'down')
  } finally {
    global.fetch = previousFetch
    restoreEnv('NODE_ENV', previousNodeEnv)
    restoreEnv('OPENAI_BASE_URL', previousAiUrl)
  }
})

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key]
  else process.env[key] = value
}
