import { expect, test } from '@playwright/test'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { PrismaClient } = require('../../backend/node_modules/@prisma/client')

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000/api'
const prisma = new PrismaClient()
const marker = `PW-AIRETEST-${Date.now()}`

let adminSession: {
  accessToken: string
  refreshToken: string
  user: {
    email: string
    id: string
    name: string
    permissions: string[]
    role: string
    status: string
    unifiedCode: string
  }
}
let artifactId = ''
let jobId = ''
let reportId = ''

test.beforeAll(async () => {
  const loginResponse = await fetch(`${API_BASE_URL}/auth/login/password`, {
    body: JSON.stringify({ password: 'admin123456+-', unifiedCode: '0000000' }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })
  expect(loginResponse.ok).toBeTruthy()
  adminSession = await loginResponse.json()

  const student = await prisma.user.findUniqueOrThrow({ where: { unifiedCode: '2025001' } })
  const report = await prisma.vulnerabilityReport.create({
    data: {
      assetName: `${marker} asset`,
      assetUrl: 'https://example.com/playwright-ai-retest',
      impactAssessment: `${marker} impact assessment`,
      ownerUnit: 'Playwright 测试单位',
      repairSuggestion: 'Apply server-side authorization and regression tests.',
      reportNo: marker,
      reproductionSteps: '1. Open the authorized test target.\\n2. Verify the sanitized response.',
      selfSeverity: 'MEDIUM',
      status: 'PENDING_REVIEW',
      submittedAt: new Date(),
      submitterId: student.id,
      testBoundary: 'Only the isolated Playwright fixture target.',
      title: `${marker} AI 复测 UI`,
      vulnerabilityType: '信息泄露',
    },
  })
  reportId = report.id

  const job = await prisma.aiVulnerabilityRetestJob.create({
    data: {
      expiresAt: new Date(Date.now() + 30 * 60_000),
      finishedAt: new Date(),
      idempotencyKey: `${marker}-job`,
      mode: 'CONTROLLED_RUN',
      policyDecision: 'ALLOW_WITH_LIMITS',
      reproducibility: 'INSUFFICIENT_EVIDENCE',
      requestBodyHash: 'a'.repeat(64),
      requestedById: adminSession.user.id,
      riskLevel: 'MEDIUM',
      sanitizedContext: { confirmedTargets: ['https://example.com/playwright-ai-retest'] },
      status: 'SUCCEEDED',
      targetSnapshot: {
        confirmedAt: new Date().toISOString(),
        confirmedBy: adminSession.user.id,
        confirmedTargets: ['https://example.com/playwright-ai-retest'],
        confirmationText: '确认该隔离目标已获得授权',
        credentialRequest: { needsAccount: false, needsCaptcha: false },
      },
      traceId: `${marker}-trace`,
      vulnerabilityId: report.id,
    },
  })
  jobId = job.id

  const artifact = await prisma.aiVulnerabilityRetestArtifact.create({
    data: {
      artifactType: 'HTTP_RESPONSE',
      jobId: job.id,
      mimeType: 'text/plain',
      redactionSummary: { authorization: 1 },
      retentionUntil: new Date(Date.now() + 24 * 60 * 60_000),
      sanitizedPreview: `${marker} sanitized evidence preview`,
      sha256: 'b'.repeat(64),
      sizeBytes: 128,
      storageKey: `e2e/${marker}/evidence.txt`,
    },
  })
  artifactId = artifact.id

  await prisma.aiVulnerabilityRetestReport.create({
    data: {
      confidence: 'MEDIUM',
      jobId: job.id,
      manualReviewRequired: true,
      promptVersion: 'playwright-v1',
      reportHash: 'c'.repeat(64),
      reportJson: {
        conclusion: {
          confidence: 'MEDIUM',
          manualReviewRequired: true,
          reproducibility: 'INSUFFICIENT_EVIDENCE',
          riskLevelSuggestion: 'MEDIUM',
        },
        evidenceSummary: `${marker} evidence remains insufficient for an automatic conclusion.`,
        impactAssessment: `${marker} impact requires manual confirmation.`,
        limitations: ['Only sanitized fixture evidence was reviewed.'],
        manualRetestAdvice: {
          authorizationChecklist: [],
          blockedReason: null,
          evidenceToReview: [],
          manualRetestOnly: false,
          remediationAdvice: [],
          runnerExecutionAllowed: true,
          safeManualApproach: [],
        },
        remediationAdvice: {
          regressionTest: 'Repeat the authorized request after remediation.',
          rootCauseFix: 'Enforce server-side authorization.',
          shortTerm: 'Limit access while the fix is deployed.',
        },
        reviewCommentDraft: `${marker} review comment draft`,
        schemaVersion: 'ai-retest-report-schema-v2',
        steps: [{
          evidence: [{ id: artifact.id, sha256: artifact.sha256, type: artifact.artifactType }],
          executionState: 'EXECUTED',
          resultSummary: { statusCode: 200 },
          riskLevel: 'LOW',
          sequence: 1,
          sourceId: null,
          status: 'SUCCEEDED',
          target: 'https://example.com/playwright-ai-retest',
          title: 'Read sanitized response',
          toolType: 'http_get',
        }],
      },
      reproducibility: 'INSUFFICIENT_EVIDENCE',
      runnerAllowed: true,
      schemaVersion: 'ai-retest-report-schema-v2',
    },
  })
})

test.afterAll(async () => {
  const report = jobId
    ? await prisma.aiVulnerabilityRetestReport.findUnique({ where: { jobId } })
    : null
  const targetIds = [artifactId, jobId, reportId, report?.adoptedCommentId].filter(Boolean)
  await prisma.auditLog.deleteMany({ where: { targetId: { in: targetIds } } })
  if (reportId) await prisma.vulnerabilityReport.delete({ where: { id: reportId } }).catch(() => {})
  await prisma.$disconnect()
})

test('administrator completes the AI retest review workflow without browser errors', async ({ page }) => {
  const browserErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text())
  })
  page.on('pageerror', (error) => browserErrors.push(error.message))

  await page.addInitScript((session) => {
    window.localStorage.setItem('cqupt-src-auth-session', JSON.stringify(session))
  }, {
    ...adminSession,
    user: { ...adminSession.user, role: 'admin' },
  })

  await page.goto('/')
  await page.getByRole('button', { name: '漏洞管理', exact: true }).first().click()
  await page.getByPlaceholder('编号、标题、影响资产或提交人').fill(marker)
  await expect(page.getByText(`${marker} AI 复测 UI`)).toBeVisible()
  await page.getByRole('button', { name: '查看详情' }).click()

  await expect(page.getByRole('heading', { name: 'AI 漏洞复测' })).toBeVisible()
  await expect(page.getByText('已完成', { exact: true })).toBeVisible()
  await expect(page.getByText(`${marker} review comment draft`)).toBeVisible()

  await page.getByRole('button', { name: '查看脱敏证据' }).click()
  await expect(page.getByText(`${marker} sanitized evidence preview`)).toBeVisible()

  await page.getByRole('button', { name: '引用到审核意见' }).click()
  await expect(page.getByText('AI 复测报告已写入审核意见草稿，请人工核对后再提交。')).toBeVisible()
  await page.getByRole('button', { name: '确认有效' }).click()
  await expect(page.getByPlaceholder('请填写审核依据、处理说明或驳回原因…')).toHaveValue(
    `【AI 复测报告引用草稿，需人工确认】\n${marker} review comment draft`,
  )
  await page.getByRole('button', { name: '取消', exact: true }).last().click()

  await page.getByRole('button', { name: '启动新复测' }).click()
  const startDialog = page.getByRole('dialog', { name: '启动 AI 漏洞复测' })
  const startButton = startDialog.getByRole('button', { name: '确认并启动' })
  await expect(startButton).toBeDisabled()
  await startDialog.getByText('人工计划', { exact: true }).click()
  await startDialog.getByText('我已阅读漏洞详情，确认上述目标属于本次授权范围，并理解 AI 结果仅作为审核辅助。').click()
  await expect(startButton).toBeEnabled()
  await startDialog.getByRole('button', { name: '取消', exact: true }).click()

  expect(browserErrors).toEqual([])
})
