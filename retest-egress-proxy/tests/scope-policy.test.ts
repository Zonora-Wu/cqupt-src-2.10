import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isDestinationAllowed, isPrivateOrSpecialIp, normalizeScope } from '../src/scope-policy.js'

test('scope allows exact targets, inherited subdomains, and approved ports', () => {
  const scope = normalizeScope({
    allowedPorts: [80, 443, 8443],
    allowAllPorts: false,
    approvedIps: [],
    domainSuffixes: ['example.test'],
    exactHosts: ['app.example.test'],
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    sessionId: 'session-1',
  })

  assert.equal(isDestinationAllowed(scope, 'app.example.test', 443, ['203.0.113.8']), true)
  assert.equal(isDestinationAllowed(scope, 'api.example.test', 8443, ['203.0.113.9']), true)
  assert.equal(isDestinationAllowed(scope, 'other.test', 443, ['203.0.113.10']), false)
  assert.equal(isDestinationAllowed(scope, 'api.example.test', 22, ['203.0.113.9']), false)
})

test('scope blocks private and metadata destinations unless the IP is explicitly approved', () => {
  const base = {
    allowedPorts: [80],
    allowAllPorts: false,
    domainSuffixes: [],
    exactHosts: ['internal.example.test'],
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    sessionId: 'session-1',
  }
  assert.equal(isDestinationAllowed(normalizeScope({ ...base, approvedIps: [] }), 'internal.example.test', 80, ['127.0.0.1']), false)
  assert.equal(isDestinationAllowed(normalizeScope({ ...base, approvedIps: ['127.0.0.1'] }), 'internal.example.test', 80, ['127.0.0.1']), true)
  assert.equal(isPrivateOrSpecialIp('169.254.169.254'), true)
})
