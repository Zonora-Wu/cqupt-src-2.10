import assert from 'node:assert/strict'
import test from 'node:test'
import { AiModelSource } from '@prisma/client'
import { AiService } from '../src/modules/ai/ai.service'

const oldBinding = 'USER_BYOK:provider-a:credential-a:model-a'

test('an active problem session can continue after switching models', async () => {
  const updates: unknown[] = []
  const prisma = {
    aiProblemSession: {
      findFirst: async () => ({
        id: 'session-1',
        modelBindingKey: oldBinding,
        modelName: 'model-a',
        modelSource: AiModelSource.USER_BYOK,
      }),
      update: async (input: unknown) => {
        updates.push(input)
        return input
      },
    },
  }
  const service = new AiService(prisma as never, null as never, null as never, null as never, null as never, null as never, null as never, null as never)

  const transition = await bindSessionModel(service, {
    credentialId: 'credential-b',
    model: 'model-b',
    providerId: 'provider-b',
    source: AiModelSource.USER_BYOK,
  })

  assert.equal(transition?.changed, true)
  assert.equal(transition?.previousModel, 'model-a')
  assert.equal(updates.length, 1)
  assert.deepEqual(updates[0], {
    data: {
      modelBindingKey: 'USER_BYOK:provider-b:credential-b:model-b',
      modelName: 'model-b',
      modelSource: AiModelSource.USER_BYOK,
    },
    where: { id: 'session-1' },
  })
})

test('using the same model does not rewrite the session binding', async () => {
  let updateCount = 0
  const prisma = {
    aiProblemSession: {
      findFirst: async () => ({
        id: 'session-1',
        modelBindingKey: oldBinding,
        modelName: 'model-a',
        modelSource: AiModelSource.USER_BYOK,
      }),
      update: async () => { updateCount += 1 },
    },
  }
  const service = new AiService(prisma as never, null as never, null as never, null as never, null as never, null as never, null as never, null as never)

  const transition = await bindSessionModel(service, {
    credentialId: 'credential-a',
    model: 'model-a',
    providerId: 'provider-a',
    source: AiModelSource.USER_BYOK,
  })

  assert.equal(transition?.changed, false)
  assert.equal(updateCount, 0)
})

function bindSessionModel(service: AiService, model: {
  credentialId: string
  model: string
  providerId: string
  source: AiModelSource
}) {
  return (service as unknown as {
    assertAndBindSessionModel: (
      sessionId: string,
      userId: string,
      resolvedModel: typeof model,
    ) => Promise<{ changed: boolean; previousModel: string | null } | null>
  }).assertAndBindSessionModel('session-1', 'user-1', model)
}
