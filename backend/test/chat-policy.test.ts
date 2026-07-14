import assert from 'node:assert/strict'
import test from 'node:test'
import { ChatRateLimitService } from '../src/modules/chat/chat-rate-limit.service'
import { normalizeChatText, normalizeGroupBody, normalizeMessageBody } from '../src/modules/chat/chat.validation'

test('normalizes message text before sensitive-word matching', () => {
  assert.equal(normalizeChatText(' ＡＢＣ\n\t测试  '), 'ABC 测试')
})

test('rejects empty and oversized messages', () => {
  assert.throws(() => normalizeChatText('   '), /不能为空/)
  assert.throws(() => normalizeChatText('a'.repeat(2001)), /不能超过/)
})

test('requires idempotency key for messages', () => {
  assert.deepEqual(normalizeMessageBody({ clientMessageId: 'chat-message-001', content: '你好' }), { clientMessageId: 'chat-message-001', content: '你好' })
  assert.throws(() => normalizeMessageBody({ content: '你好' }), /消息标识/)
})

test('caps normal group members before creator is added', () => {
  assert.throws(() => normalizeGroupBody({ title: '测试群', memberIds: Array.from({ length: 200 }, (_, index) => `user${String(index).padStart(8, '0')}`) }), /最多 200 人/)
})

test('enforces message rate window', () => {
  const limiter = new ChatRateLimitService()
  limiter.consume('sender', 3, 60_000)
  limiter.consume('sender', 3, 60_000)
  limiter.consume('sender', 3, 60_000)
  assert.throws(() => limiter.consume('sender', 3, 60_000), /操作过于频繁/)
})
