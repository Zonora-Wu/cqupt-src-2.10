import assert from 'node:assert/strict'
import test from 'node:test'
import { AiProblemSessionStatus } from '@prisma/client'
import { AiProblemSessionService } from '../src/modules/ai-knowledge/ai-problem-session.service'

test('forceNew preserves the old conversation for resolution and creates a new active session', async () => {
  const writes: Array<{ operation: string; input: unknown }> = []
  const oldSession = session('old-session')
  const newSession = session('new-session')
  const prisma = {
    aiProblemSession: {
      create: async (input: unknown) => {
        writes.push({ input, operation: 'create' })
        return newSession
      },
      findFirst: async () => oldSession,
      updateMany: async (input: unknown) => {
        writes.push({ input, operation: 'updateMany' })
        return { count: 1 }
      },
    },
  }
  const service = new AiProblemSessionService(prisma as never, null as never)
  const user = { id: 'user-1' } as never

  const reused = await service.create({ mode: 'student' }, user)
  const created = await service.create({ forceNew: true, mode: 'student' }, user)

  assert.equal(reused.id, oldSession.id)
  assert.equal(created.id, newSession.id)
  assert.deepEqual(writes.map((write) => write.operation), ['updateMany', 'create'])
  assert.deepEqual(writes[0].input, {
    data: { status: AiProblemSessionStatus.AWAITING_RESOLUTION },
    where: { mode: 'student', status: AiProblemSessionStatus.ACTIVE, userId: 'user-1' },
  })
})

function session(id: string) {
  const now = new Date()
  return {
    aiSpace: 'STUDENT',
    autoApprovalDecision: null,
    canonicalKey: null,
    canonicalProblemJson: null,
    closedAt: null,
    clusterId: null,
    clusterDecision: null,
    clusterDecisionReason: null,
    clusterDecisionScore: null,
    createdAt: now,
    duplicateRiskScore: 0,
    id,
    initialQuestion: '新问题会话',
    knowledgeEntryId: null,
    lastActiveAt: now,
    leftAt: null,
    mode: 'student',
    modelBindingKey: null,
    modelName: null,
    modelSource: null,
    resolutionByUser: null,
    resolutionPromptCount: 0,
    resolutionPromptedAt: null,
    resolutionSnoozedUntil: null,
    resolvedAt: null,
    status: AiProblemSessionStatus.ACTIVE,
    startedAt: now,
    summaryJson: null,
    title: '新问题会话',
    tokenEstimate: 0,
    topicKey: 'new',
    turnCount: 0,
    updatedAt: now,
    userId: 'user-1',
    userOutcomeNote: null,
  }
}
