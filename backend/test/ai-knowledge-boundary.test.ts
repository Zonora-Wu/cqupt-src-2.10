import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { AiKnowledgeFeedbackValue, AiKnowledgeRoleScope, AiKnowledgeSensitivity, AiKnowledgeStatus, AiKnowledgeVisibility, RoleCode } from '@prisma/client'
import { AiKnowledgeService } from '../src/modules/ai-knowledge/ai-knowledge.service'

test('knowledge controller and problem-session approval expose no Knowledge to Skill route', async () => {
  const [controller, moduleSource, problemSessions] = await Promise.all([
    readFile(new URL('../src/modules/ai-knowledge/ai-knowledge.controller.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/modules/ai-knowledge/ai-knowledge.module.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/modules/ai-knowledge/ai-problem-session.service.ts', import.meta.url), 'utf8'),
  ])
  assert.doesNotMatch(controller, /skill-candidates|skill-audit|installSkillCandidate|createSkillCandidate/)
  assert.doesNotMatch(moduleSource, /AiSkillLifecycleService|AiKnowledgeWorker/)
  assert.doesNotMatch(problemSessions, /skillLifecycle\.processKnowledge/)
})

test('first unhelpful feedback disables direct answer and opens low-quality maintenance', async () => {
  const observed = await runFeedback(AiKnowledgeFeedbackValue.UNHELPFUL)
  assert.equal(observed.update.directAnswerEnabled, false)
  assert.equal(observed.update.retrievalEnabled, undefined)
  assert.equal(observed.task.taskType, 'LOW_QUALITY')
  assert.equal(observed.task.priority, 'P1')
})

test('abuse report suspends every knowledge route and opens security maintenance', async () => {
  const observed = await runFeedback(AiKnowledgeFeedbackValue.REPORT_ABUSE)
  assert.equal(observed.update.directAnswerEnabled, false)
  assert.equal(observed.update.agentInjectEnabled, false)
  assert.equal(observed.update.retrievalEnabled, false)
  assert.equal(observed.task.taskType, 'SECURITY')
  assert.equal(observed.task.priority, 'P0')
})

async function runFeedback(value: AiKnowledgeFeedbackValue) {
  const observed: { task: Record<string, unknown>; update: Record<string, unknown> } = { task: {}, update: {} }
  const entry = {
    id: 'knowledge-1', roleScope: AiKnowledgeRoleScope.STUDENT, sensitivity: AiKnowledgeSensitivity.INTERNAL,
    status: AiKnowledgeStatus.APPROVED, visibility: AiKnowledgeVisibility.ROLE_ONLY,
  }
  const tx = {
    aiKnowledgeEntry: { update: async ({ data }: { data: Record<string, unknown> }) => { observed.update = data; return { ...entry, ...data } } },
    aiKnowledgeFeedback: { create: async () => ({ id: 'feedback-1' }) },
    aiKnowledgeMaintenanceTask: { upsert: async ({ create }: { create: Record<string, unknown> }) => { observed.task = create; return create } },
  }
  const prisma = {
    aiKnowledgeEntry: { findUnique: async () => entry },
    $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
  }
  const service = new AiKnowledgeService(prisma as never)
  await service.addFeedback('knowledge-1', { value }, 'user-1', RoleCode.STUDENT)
  return observed
}
