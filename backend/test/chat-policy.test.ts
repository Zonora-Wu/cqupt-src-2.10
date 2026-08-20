import assert from 'node:assert/strict'
import test from 'node:test'
import { SecurityRateLimitService } from '../src/common/security/security-rate-limit.service'
import { getUnreadBaseline, isMessageCursorAfter } from '../src/modules/chat/chat.service'
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

test('enforces message rate window', async () => {
  const securityLimiter = new SecurityRateLimitService()
  await securityLimiter.consume('chat', 'sender', 3, 60_000)
  await securityLimiter.consume('chat', 'sender', 3, 60_000)
  await securityLimiter.consume('chat', 'sender', 3, 60_000)
  await assert.rejects(securityLimiter.consume('chat', 'sender', 3, 60_000), /操作过于频繁/)
  await securityLimiter.onModuleDestroy()
})

test('read cursor only advances by message timestamp and id', () => {
  const current = { createdAt: new Date('2026-08-05T10:00:00.000Z'), id: 'message-002' }
  assert.equal(isMessageCursorAfter({ createdAt: new Date('2026-08-05T10:00:01.000Z'), id: 'message-001' }, current), true)
  assert.equal(isMessageCursorAfter({ createdAt: new Date('2026-08-05T10:00:00.000Z'), id: 'message-003' }, current), true)
  assert.equal(isMessageCursorAfter({ createdAt: new Date('2026-08-05T10:00:00.000Z'), id: 'message-001' }, current), false)
})

test('unread baseline starts at join time until a read cursor exists', () => {
  const joinedAt = new Date('2026-08-05T09:00:00.000Z')
  const lastReadAt = new Date('2026-08-05T10:00:00.000Z')
  assert.equal(getUnreadBaseline({ joinedAt, lastReadAt: null }, new Date('2026-08-01T00:00:00.000Z')), joinedAt)
  assert.equal(getUnreadBaseline({ joinedAt, lastReadAt }, new Date('2026-08-01T00:00:00.000Z')), lastReadAt)
})
