import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { AddressInfo } from 'node:net'
import { createRetestRunnerServer } from '../src/server.js'

process.env.NODE_ENV = 'test'
process.env.RETEST_RUNNER_TOKEN = 'test-runner-token'

const target = createServer((req, res) => {
  if (req.url === '/redirect-off-origin') {
    res.writeHead(302, { Location: 'https://example.org/outside' })
    res.end()
    return
  }
  if (req.url === '/large') {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end(`token=secret ${'x'.repeat(10000)}`)
    return
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'X-Frame-Options': 'DENY',
    })
    res.end()
    return
  }
  res.writeHead(200, {
    'Content-Type': 'text/html',
    'Server': 'test-server',
    'X-Frame-Options': 'DENY',
  })
  res.end('hello alice@example.com\nAuthorization: Bearer abc.def.ghi')
})

const runner = createRetestRunnerServer()

try {
  await listen(target, '127.0.0.1')
  await listen(runner, '127.0.0.1')
  const targetPort = (target.address() as AddressInfo).port
  const runnerPort = (runner.address() as AddressInfo).port
  const allowedOrigin = `http://127.0.0.1:${targetPort}`

  const safe = await execute(runnerPort, buildRequest(`${allowedOrigin}/safe`, allowedOrigin, 'http_get', 'GET'))
  assert.equal(safe.status, 'FAILED', 'Runner must block localhost even when backend accidentally sends it')
  assert.equal(safe.errorCode, 'NETWORK_DESTINATION_BLOCKED')

  const external = await execute(runnerPort, buildRequest('https://example.com/', 'https://example.com', 'http_get', 'GET'))
  assert.equal(['SUCCEEDED', 'FAILED'].includes(external.status), true, 'external request should return structured status')
  assert.equal(typeof external.executionId, 'string')

  const redirect = await execute(runnerPort, buildRequest(`${allowedOrigin}/redirect-off-origin`, allowedOrigin, 'http_get', 'GET'))
  assert.equal(redirect.status, 'FAILED')
  assert.equal(redirect.errorCode, 'NETWORK_DESTINATION_BLOCKED', 'localhost target is blocked before redirect is followed')

  const large = await execute(runnerPort, {
    ...buildRequest(`${allowedOrigin}/large`, allowedOrigin, 'http_get', 'GET'),
    safety: { ...buildRequest(`${allowedOrigin}/large`, allowedOrigin, 'http_get', 'GET').safety, allowInternalNetwork: true },
  })
  assert.equal(large.status, 'FAILED', 'Runner must reject attempts to enable internal network access')

  const unauthorized = await fetch(`http://127.0.0.1:${runnerPort}/v1/retests/steps:execute`, {
    body: JSON.stringify(buildRequest('https://example.com/', 'https://example.com', 'http_get', 'GET')),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })
  assert.equal(unauthorized.status, 401)

  console.log('PASS restricted runner contract/security tests')
} finally {
  await close(runner)
  await close(target)
}

function buildRequest(targetUrl: string, allowedOrigin: string, template: string, method: string) {
  return {
    budget: {
      maxConcurrentRequests: 1,
      maxRequestsPerJob: 30,
      maxRequestsPerStep: 1,
      maxResponseBytes: 1024,
      requestTimeoutMs: 5000,
      totalTimeoutMs: 10000,
    },
    safety: {
      allowCredentials: false,
      allowDatabaseAccess: false,
      allowHermesScripts: false,
      allowInternalNetwork: false,
      allowMetadataNetwork: false,
      allowRedirectOffOrigin: false,
      allowShell: false,
      allowedOrigin,
      redactSensitiveOutput: true,
    },
    step: {
      method,
      sequence: 1,
      targetUrl,
      template,
      title: 'contract test',
    },
    traceId: 'runner-contract-test',
    version: 'ai-retest-runner-v1',
  }
}

async function execute(port: number, body: unknown) {
  const response = await fetch(`http://127.0.0.1:${port}/v1/retests/steps:execute`, {
    body: JSON.stringify(body),
    headers: {
      Authorization: 'Bearer test-runner-token',
      'Content-Type': 'application/json',
    },
    method: 'POST',
  })
  assert.equal(response.status, 200)
  return response.json() as Promise<Record<string, unknown>>
}

function listen(server: ReturnType<typeof createServer>, host: string) {
  return new Promise<void>((resolve) => server.listen(0, host, resolve))
}

function close(server: ReturnType<typeof createServer>) {
  return new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
}
