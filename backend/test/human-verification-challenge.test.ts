import assert from 'node:assert/strict'
import test from 'node:test'
import { sha, solveChallenge } from 'altcha/lib'
import { HumanVerificationService } from '../src/modules/human-verification/human-verification.service'
import type { HumanVerificationPurpose } from '../src/modules/human-verification/human-verification.types'

test('ALTCHA challenge uses bounded mobile-friendly work and remains verifiable', async () => {
  const previous = {
    cost: process.env.ALTCHA_CHALLENGE_COST,
    origin: process.env.FRONTEND_ORIGIN,
    prefix: process.env.ALTCHA_KEY_PREFIX_LENGTH,
    secret: process.env.ALTCHA_HMAC_SECRET,
  }
  process.env.ALTCHA_CHALLENGE_COST = '32000'
  process.env.ALTCHA_KEY_PREFIX_LENGTH = '2'
  process.env.ALTCHA_HMAC_SECRET = 'test-only-altcha-secret'
  process.env.FRONTEND_ORIGIN = 'https://test.example.edu'

  const consumedNonces: string[] = []
  const prisma = {
    $transaction: async (operations: Array<Promise<unknown>>) => Promise.all(operations),
    humanVerificationNonce: {
      create: async ({ data }: { data: { nonceHash: string } }) => {
        consumedNonces.push(data.nonceHash)
        return data
      },
      deleteMany: async () => ({ count: 0 }),
    },
  }

  try {
    const service = new HumanVerificationService(prisma as never)
    const meta = { ipAddress: '192.0.2.10' }
    const maximumCounters: Record<HumanVerificationPurpose, number> = {
      CHANGE_EMAIL_CODE: 6_000,
      CHANGE_EMAIL_SUBMIT: 9_000,
      CHANGE_PASSWORD: 9_000,
      LOGIN_EMAIL_CODE: 5_000,
      LOGIN_PASSWORD: 3_000,
      REGISTER_EMAIL_CODE: 6_000,
      REGISTER_SUBMIT: 8_000,
      RESET_PASSWORD: 8_000,
    }
    let loginPayload = ''

    for (const [purpose, maximumCounter] of Object.entries(maximumCounters) as Array<[HumanVerificationPurpose, number]>) {
      const result = await service.createChallenge(purpose, meta)
      assert.equal(result.expiresIn, 300)
      assert.equal(result.challenge.parameters.cost, 1)
      assert.equal(result.challenge.parameters.keyPrefix.length, 6)

      const solution = await solveChallenge({
        challenge: result.challenge,
        deriveKey: sha.deriveKey,
        timeout: 10_000,
      })
      assert.ok(solution)
      assert.ok(solution.counter <= maximumCounter)
      if (purpose === 'LOGIN_PASSWORD') {
        loginPayload = Buffer.from(JSON.stringify({ challenge: result.challenge, solution })).toString('base64')
      }
    }

    assert.ok(loginPayload)
    await service.verify({ payload: loginPayload, provider: 'altcha' }, 'LOGIN_PASSWORD', meta)
    assert.equal(consumedNonces.length, 1)
  } finally {
    restoreEnv('ALTCHA_CHALLENGE_COST', previous.cost)
    restoreEnv('ALTCHA_KEY_PREFIX_LENGTH', previous.prefix)
    restoreEnv('ALTCHA_HMAC_SECRET', previous.secret)
    restoreEnv('FRONTEND_ORIGIN', previous.origin)
  }
})

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name]
  else process.env[name] = value
}
