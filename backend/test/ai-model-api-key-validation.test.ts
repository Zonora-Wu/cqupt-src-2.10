import assert from 'node:assert/strict'
import test from 'node:test'
import { validateProviderApiKey } from '../src/modules/ai/ai-model.service'

test('provider API key validation rejects response text saved as a credential', () => {
  assert.throws(
    () => validateProviderApiKey('Internal server error', 'deepseek'),
    /API Key 格式不正确/,
  )
})

test('provider API key validation rejects whitespace and malformed DeepSeek keys', () => {
  assert.throws(() => validateProviderApiKey('sk-part one', 'deepseek'), /API Key 格式不正确/)
  assert.throws(() => validateProviderApiKey('not-a-deepseek-key', 'deepseek'), /应以 sk- 开头/)
})

test('provider API key validation accepts official and custom provider keys', () => {
  assert.equal(validateProviderApiKey('sk-valid-example', 'deepseek'), 'sk-valid-example')
  assert.equal(validateProviderApiKey('relay-token_example', 'custom'), 'relay-token_example')
})
