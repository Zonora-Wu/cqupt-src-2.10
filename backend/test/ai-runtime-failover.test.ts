import assert from 'node:assert/strict'
import test from 'node:test'
import { AiModelPurpose, AiModelSource } from '@prisma/client'
import { AiService } from '../src/modules/ai/ai.service'

test('platform runtime switches to the next configured route after an upstream failure', async () => {
  const routeResults: Array<[string | undefined, boolean]> = []
  const modelService = {
    recordPlatformRouteResult: async (id: string | undefined, success: boolean) => { routeResults.push([id, success]) },
    resolvePlatformCandidates: async () => [
      { apiKey: 'first', baseUrl: 'https://first.example/v1/', model: 'model-a', providerId: 'first', routeId: 'route-a', source: AiModelSource.PLATFORM },
      { apiKey: 'second', baseUrl: 'https://second.example/v1/', model: 'model-b', providerId: 'second', routeId: 'route-b', source: AiModelSource.PLATFORM },
    ],
  }
  const runtime = { isCancelled: () => false, register: () => undefined, unregister: () => undefined }
  const service = new AiService(null as never, null as never, null as never, null as never, null as never, null as never, modelService as never, runtime as never)
  const previousFetch = global.fetch
  const requested: string[] = []
  global.fetch = (async (input: string | URL | Request) => {
    const url = String(input)
    requested.push(url)
    return url.includes('first.example')
      ? new Response(JSON.stringify({ error: { message: 'primary failed' } }), { status: 500 })
      : new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200 })
  }) as typeof fetch
  try {
    const result = await (service as unknown as {
      requestOpenAi: (path: string, options: Record<string, unknown>) => Promise<{ model: { model: string } }>
    }).requestOpenAi('chat/completions', {
      body: { messages: [], model: 'placeholder' },
      method: 'POST',
      platformPurpose: AiModelPurpose.USER_INTERACTIVE,
      resolvedModel: { apiKey: 'first', baseUrl: 'https://first.example/v1/', model: 'model-a', providerId: 'first', routeId: 'route-a', source: AiModelSource.PLATFORM },
      timeoutMs: 1000,
    })

    assert.deepEqual(requested, ['https://first.example/v1/chat/completions', 'https://second.example/v1/chat/completions'])
    assert.equal(result.model.model, 'model-b')
    assert.deepEqual(routeResults, [['route-a', false], ['route-b', true]])
  } finally {
    global.fetch = previousFetch
  }
})
