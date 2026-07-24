import assert from 'node:assert/strict'
import test from 'node:test'
import { AiCredentialCrypto } from '../src/modules/ai/ai-credential.crypto'

test('AI credential encryption uses randomized authenticated ciphertext', () => {
  const previous = process.env.AI_CREDENTIAL_ENCRYPTION_KEY
  process.env.AI_CREDENTIAL_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64')
  try {
    const crypto = new AiCredentialCrypto()
    const first = crypto.encrypt('sk-sensitive-value')
    const second = crypto.encrypt('sk-sensitive-value')

    assert.notEqual(first.ciphertext, second.ciphertext)
    assert.notEqual(first.iv, second.iv)
    assert.equal(crypto.decrypt(first), 'sk-sensitive-value')
    assert.equal(JSON.stringify(first).includes('sk-sensitive-value'), false)
  } finally {
    if (previous === undefined) delete process.env.AI_CREDENTIAL_ENCRYPTION_KEY
    else process.env.AI_CREDENTIAL_ENCRYPTION_KEY = previous
  }
})

test('AI credential encryption rejects a missing independent key', () => {
  const previous = process.env.AI_CREDENTIAL_ENCRYPTION_KEY
  delete process.env.AI_CREDENTIAL_ENCRYPTION_KEY
  try {
    assert.throws(() => new AiCredentialCrypto().encrypt('secret'), /AI_CREDENTIAL_ENCRYPTION_KEY/)
  } finally {
    if (previous !== undefined) process.env.AI_CREDENTIAL_ENCRYPTION_KEY = previous
  }
})
