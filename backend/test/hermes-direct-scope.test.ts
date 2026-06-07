import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildHermesDirectEgressScope } from '../src/modules/ai-vulnerability-retest/hermes-direct-scope'

test('egress scope inherits resolved IPs, ports, and related subdomains', () => {
  const scope = buildHermesDirectEgressScope({
    expiresAt: new Date(Date.now() + 60_000),
    sessionId: 'session-1',
    targets: ['https://app.example.com/path', '203.0.113.10'],
  })

  assert.deepEqual(scope.exactHosts, ['203.0.113.10', 'app.example.com'])
  assert.deepEqual(scope.approvedIps, ['203.0.113.10'])
  assert.deepEqual(scope.domainSuffixes, ['example.com'])
  assert.equal(scope.allowAllPorts, true)
})

test('egress scope handles common multi-label public suffixes without widening to co.uk', () => {
  const scope = buildHermesDirectEgressScope({
    expiresAt: new Date(Date.now() + 60_000),
    sessionId: 'session-1',
    targets: ['https://portal.example.co.uk'],
  })

  assert.deepEqual(scope.domainSuffixes, ['example.co.uk'])
})
