import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import {
  decryptCredentialEnvelope,
  encryptCredentialEnvelope,
  parseCredentialKeyring,
} from '../src/modules/ai-vulnerability-retest/retest-credential-vault.service'

const originalKeyring = process.env.AI_RETEST_CREDENTIAL_KEYS
const originalActiveKey = process.env.AI_RETEST_CREDENTIAL_ACTIVE_KEY_ID

afterEach(() => {
  process.env.AI_RETEST_CREDENTIAL_KEYS = originalKeyring
  process.env.AI_RETEST_CREDENTIAL_ACTIVE_KEY_ID = originalActiveKey
})

test('credential envelope uses authenticated encryption and bound associated data', () => {
  const key = Buffer.alloc(32, 7)
  const aad = 'job-1:COOKIE:scope-hash'
  const encrypted = encryptCredentialEnvelope({ cookie: 'session=secret' }, key, aad)

  assert.notEqual(encrypted.toString('utf8').includes('secret'), true)
  assert.deepEqual(decryptCredentialEnvelope(encrypted, key, aad), { cookie: 'session=secret' })
  assert.throws(() => decryptCredentialEnvelope(encrypted, key, `${aad}-changed`))
})

test('credential keyring requires 32-byte keys and an active key', () => {
  process.env.AI_RETEST_CREDENTIAL_KEYS = `v1:${Buffer.alloc(32, 1).toString('base64')}`
  process.env.AI_RETEST_CREDENTIAL_ACTIVE_KEY_ID = 'v1'

  const keyring = parseCredentialKeyring()

  assert.equal(keyring.activeKeyId, 'v1')
  assert.equal(keyring.keys.get('v1')?.length, 32)
})
