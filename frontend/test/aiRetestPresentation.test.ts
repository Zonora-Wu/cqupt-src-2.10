import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  describeAiRetestStatus,
  getAiRetestChannel,
  isAiRetestActive,
  shouldPollAiRetest,
} from '../src/components/ai-retest/aiRetestPresentation'

test('classifies approval waits as active but not silently executing', () => {
  const planReview = describeAiRetestStatus('PLAN_REVIEW')
  const directReview = describeAiRetestStatus('DIRECT_ACTION_REVIEW')

  assert.equal(isAiRetestActive('PLAN_REVIEW'), true)
  assert.equal(shouldPollAiRetest('PLAN_REVIEW'), true)
  assert.equal(planReview.label, '等待方案审批')
  assert.equal(directReview.label, '等待高风险动作审批')
  assert.equal(directReview.tone, 'warning')
})

test('stops polling terminal jobs and gives explicit failure copy', () => {
  assert.equal(shouldPollAiRetest('FAILED'), false)
  assert.equal(shouldPollAiRetest('BLOCKED'), false)
  assert.equal(describeAiRetestStatus('FAILED').tone, 'danger')
  assert.match(describeAiRetestStatus('BLOCKED').description, /策略/)
})

test('labels Runner, Hermes Direct and planning-only channels', () => {
  assert.equal(getAiRetestChannel('CONTROLLED_RUN'), '受限 Runner')
  assert.equal(getAiRetestChannel('HERMES_DIRECT'), 'Hermes Direct')
  assert.equal(getAiRetestChannel('PLAN_ONLY'), '人工计划')
})
