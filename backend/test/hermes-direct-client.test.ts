import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { HermesDirectClient, parseHermesSseStream } from '../src/modules/ai-vulnerability-retest/hermes-direct.client'

const originalFetch = global.fetch
const originalEnv = {
  baseUrl: process.env.AI_RETEST_HERMES_BASE_URL,
  token: process.env.AI_RETEST_HERMES_TOKEN,
}

afterEach(() => {
  global.fetch = originalFetch
  process.env.AI_RETEST_HERMES_BASE_URL = originalEnv.baseUrl
  process.env.AI_RETEST_HERMES_TOKEN = originalEnv.token
})

test('HermesDirectClient creates an isolated run with service authentication', async () => {
  process.env.AI_RETEST_HERMES_BASE_URL = 'http://127.0.0.1:5001/v1/'
  process.env.AI_RETEST_HERMES_TOKEN = 'direct-service-token'
  let request: Request | undefined
  global.fetch = async (input, init) => {
    request = new Request(input, init)
    return Response.json({ run_id: 'run_123', status: 'started' }, { status: 202 })
  }

  const result = await new HermesDirectClient().createSession({
    idempotencyKey: 'job-1',
    instructions: 'system instructions',
    prompt: 'perform approved retest',
    sessionId: 'retest-job-1',
    traceId: 'trace-1',
  })

  assert.equal(result.runId, 'run_123')
  assert.equal(request?.url, 'http://127.0.0.1:5001/v1/runs')
  assert.equal(request?.headers.get('authorization'), 'Bearer direct-service-token')
  assert.equal(request?.headers.get('idempotency-key'), 'job-1')
  assert.equal(request?.headers.get('x-cqupt-src-trace-id'), 'trace-1')
  assert.deepEqual(await request?.json(), {
    input: 'perform approved retest',
    instructions: 'system instructions',
    model: 'hermes-agent',
    session_id: 'retest-job-1',
  })
})

test('parseHermesSseStream handles split frames, comments, and terminal events', async () => {
  const encoder = new TextEncoder()
  const chunks = [
    ': keepalive\n\ndata: {"event":"tool.started","run_id":"run_1",',
    '"tool":"terminal","preview":"curl https://example.test"}\n\n',
    'data: {"event":"run.completed","run_id":"run_1","output":"done"}\n\n',
  ]
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })

  const events = []
  for await (const event of parseHermesSseStream(stream)) events.push(event)

  assert.equal(events.length, 2)
  assert.equal(events[0]?.event, 'tool.started')
  assert.equal(events[1]?.event, 'run.completed')
})

test('HermesDirectClient only sends one-time approval decisions', async () => {
  process.env.AI_RETEST_HERMES_BASE_URL = 'http://127.0.0.1:5001/v1'
  process.env.AI_RETEST_HERMES_TOKEN = 'direct-service-token'
  const bodies: unknown[] = []
  global.fetch = async (_input, init) => {
    bodies.push(JSON.parse(String(init?.body)))
    return Response.json({ resolved: 1 })
  }

  const client = new HermesDirectClient()
  await client.approveAction('run_1', 'trace-1')
  await client.rejectAction('run_1', 'trace-1')

  assert.deepEqual(bodies, [{ choice: 'once' }, { choice: 'deny' }])
})
