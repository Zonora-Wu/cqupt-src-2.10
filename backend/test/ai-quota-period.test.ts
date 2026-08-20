import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getActiveTokenLimit,
  getNextQuotaPeriodStart,
  getQuotaPeriodStart,
  normalizeQuotaPeriod,
  normalizeStoredTokenLimit,
} from '../src/common/ai-quota-period'

test('normalizes quota settings and selects active token limit', () => {
  const limits = { daily: 10, weekly: 20, monthly: 30 }
  assert.equal(getActiveTokenLimit(limits, 'DAY'), 10)
  assert.equal(getActiveTokenLimit(limits, 'WEEK'), 20)
  assert.equal(getActiveTokenLimit(limits, 'MONTH'), 30)
  assert.equal(normalizeStoredTokenLimit('40', 5), 40)
  assert.equal(normalizeStoredTokenLimit(-1, 5), 5)
  assert.equal(normalizeQuotaPeriod('invalid'), 'MONTH')
})

test('uses local calendar boundaries with Monday as week start', () => {
  const wednesday = new Date(2026, 7, 19, 18, 30)
  assert.deepEqual(getQuotaPeriodStart('DAY', wednesday), new Date(2026, 7, 19))
  assert.deepEqual(getQuotaPeriodStart('WEEK', wednesday), new Date(2026, 7, 17))
  assert.deepEqual(getQuotaPeriodStart('MONTH', wednesday), new Date(2026, 7, 1))
  assert.deepEqual(getNextQuotaPeriodStart('DAY', wednesday), new Date(2026, 7, 20))
  assert.deepEqual(getNextQuotaPeriodStart('WEEK', wednesday), new Date(2026, 7, 24))
  assert.deepEqual(getNextQuotaPeriodStart('MONTH', wednesday), new Date(2026, 8, 1))
})

test('maps Sunday to preceding Monday', () => {
  const sunday = new Date(2026, 7, 23, 12)
  assert.deepEqual(getQuotaPeriodStart('WEEK', sunday), new Date(2026, 7, 17))
})
