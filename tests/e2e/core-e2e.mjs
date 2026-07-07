import { randomBytes, scryptSync } from 'node:crypto'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { PrismaClient } = require('../../backend/node_modules/@prisma/client')

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '../..')
const API_BASE_URL = (process.env.API_BASE_URL ?? 'http://localhost:3001/api').replace(/\/$/, '')
const EVIDENCE_DIR = process.env.E2E_EVIDENCE_DIR ?? resolve(PROJECT_ROOT, 'tests/e2e/evidence')
const runId = `e2e_${Date.now().toString(36)}_${randomBytes(3).toString('hex')}`
const marker = `[${runId}]`
const prisma = new PrismaClient()

const accounts = {
  admin: {
    password: process.env.CQUPT_SRC_ADMIN_PASSWORD ?? 'admin123456+-',
    unifiedCode: process.env.CQUPT_SRC_ADMIN_CODE ?? '0000000',
  },
  auditor: {
    password: process.env.CQUPT_SRC_AUDITOR_PASSWORD ?? 'auditor123456+-',
    unifiedCode: process.env.CQUPT_SRC_AUDITOR_CODE ?? '0000001',
  },
}

const state = {
  adminToken: null,
  attachmentId: null,
  candidateId: null,
  evidence: [],
  knowledgeId: null,
  reportId: null,
  skillName: `cqupt_e2e_${runId.replace(/[^a-z0-9_]/g, '_')}`.slice(0, 60),
  skillPath: null,
  tempUserId: null,
  tempUserToken: null,
  timings: [],
}

async function main() {
  mkdirSync(EVIDENCE_DIR, { recursive: true })
  console.log(`Core E2E target: ${API_BASE_URL}`)
  console.log(`Run marker: ${marker}`)

  await step('health check', async () => {
    const health = await request('/health')
    assert(health?.status === 'ok', 'health status should be ok')
  })

  await step('prepare isolated student account', async () => {
    state.tempUserId = await createTempStudent()
    const tempLogin = await login({ password: 'E2e123456+-', unifiedCode: runId.slice(0, 32) })
    state.tempUserToken = tempLogin.accessToken
    assert(Boolean(state.tempUserToken), 'temp student token should exist')
  })

  await step('admin and auditor login', async () => {
    state.adminToken = (await login(accounts.admin)).accessToken
    const auditorToken = (await login(accounts.auditor)).accessToken
    assert(Boolean(state.adminToken), 'admin token should exist')
    assert(Boolean(auditorToken), 'auditor token should exist')
  })

  await step('RBAC denies student access to admin knowledge stats', async () => {
    const denied = await request('/ai/knowledge/stats', { expectedStatus: 403, token: state.tempUserToken })
    assert(String(denied.message ?? '').length > 0, '403 response should include message')
  })

  await step('security access gate blocks vulnerability before prerequisites', async () => {
    const status = await request('/access/status', { token: state.tempUserToken })
    assert(status.canSubmitVulnerability === false, 'fresh student must not submit before prerequisites')
    assert(status.missingRequirements?.length >= 1, 'fresh student should expose missing requirements')

    await request('/vulnerabilities', {
      body: vulnerabilityBody('blocked-before-access'),
      expectedStatus: 403,
      method: 'POST',
      token: state.tempUserToken,
    })
  })

  await step('security exam + responsibility agreement unlock vulnerability submission', async () => {
    const agreement = await request('/access/responsibility-agreement/current', { token: state.tempUserToken })
    assert(agreement?.id, 'active responsibility agreement should exist')
    await request('/access/responsibility-agreement/sign', {
      body: { deviceFingerprint: `core-e2e-${runId}` },
      method: 'POST',
      token: state.tempUserToken,
    })

    const paper = await request('/security-exam/paper', { token: state.tempUserToken })
    assert(Array.isArray(paper.questions) && paper.questions.length === 20, 'exam paper should contain 20 questions')
    assert(!('answerKeys' in paper.questions[0]), 'exam paper must not leak answerKeys')
    const answers = await buildCorrectExamAnswers(paper.questions.map((item) => item.id))
    const result = await request('/security-exam/submit', {
      body: { answers },
      method: 'POST',
      token: state.tempUserToken,
    })
    assert(result.passed === true, 'correct exam submission should pass')
    assert(result.score >= result.threshold, 'score should satisfy threshold')

    const status = await request('/access/status', { token: state.tempUserToken })
    assert(status.canSubmitVulnerability === true, 'student should be allowed after signing and passing exam')
  })

  await step('vulnerability submit + attachment upload + controlled preview', async () => {
    const created = await request('/vulnerabilities', {
      body: vulnerabilityBody('core-flow'),
      method: 'POST',
      token: state.tempUserToken,
    })
    state.reportId = created.id
    assert(created.id && created.reportNo, 'created vulnerability should include id and reportNo')

    const pdf = buildPdfBuffer(reportPdfText())
    const upload = await multipart('/vulnerabilities/' + state.reportId + '/attachments', {
      fileBuffer: pdf,
      fileName: `${runId}-attachment.pdf`,
      token: state.tempUserToken,
    })
    state.attachmentId = upload.id
    assert(upload.id && upload.sha256 && upload.previewUrl, 'attachment upload should return id, sha256 and previewUrl')

    const preview = await rawRequest(upload.previewUrl, { token: state.tempUserToken })
    assert(preview.status === 200, 'attachment preview should return HTTP 200')
    assert((preview.headers.get('content-type') ?? '').includes('application/pdf'), 'preview content-type should be PDF')
    const previewBytes = Buffer.from(await preview.arrayBuffer())
    assert(previewBytes.subarray(0, 5).toString('utf8') === '%PDF-', 'preview body should be a real PDF')
  })

  await step('AI attachment text extraction and report draft parsing', async () => {
    const pdf = buildPdfBuffer(reportPdfText())
    const text = await multipart('/ai/attachments/text', {
      fileBuffer: pdf,
      fileName: `${runId}-qa.pdf`,
      token: state.tempUserToken,
    })
    assert(text.kind === 'PDF_TEXT', 'attachment text endpoint should return PDF_TEXT')
    assert((text.textExcerpt ?? '').includes('SQL'), 'extracted text should include vulnerability keyword')

    const drafts = await multipart('/ai/report-drafts', {
      fileBuffer: pdf,
      fileName: `${runId}-drafts.pdf`,
      token: state.tempUserToken,
    })
    assert(Array.isArray(drafts.drafts) && drafts.drafts.length >= 1, 'report draft parser should identify at least one draft')
    assert(drafts.drafts[0].title.includes('SQL'), 'draft title should be parsed from PDF heading')
  })

  await step('AI knowledge create/review + skill candidate approve/install', async () => {
    const stats = await request('/ai/knowledge/stats', { token: state.adminToken })
    assert(stats && typeof stats === 'object', 'admin stats should return an object')

    const knowledge = await request('/ai/knowledge', {
      body: {
        answer: `当遇到 ${marker} 这类上传 PDF 报告解析失败时，应先确认 PDF 可复制文本、文件未加密、标题符合 1.1. 漏洞名称结构，并保留失败报错、修复步骤和最终验证结果，供后续知识库复用。`,
        category: 'VULNERABILITY_REPORTING',
        question: `${marker} PDF 报告解析失败应该如何排查？`,
        roleScope: 'ALL',
        sensitivity: 'INTERNAL',
        tags: ['e2e', 'pdf'],
        title: `${marker} PDF 报告解析排查`,
        visibility: 'PLATFORM_PUBLIC',
      },
      method: 'POST',
      token: state.adminToken,
    })
    state.knowledgeId = knowledge.id
    assert(knowledge.status === 'APPROVED', 'admin-created knowledge should be approved')

    const reviewed = await request(`/ai/knowledge/${state.knowledgeId}/review`, {
      body: { note: `${marker} E2E review`, status: 'APPROVED' },
      method: 'POST',
      token: state.adminToken,
    })
    assert(reviewed.status === 'APPROVED', 'knowledge review should remain approved')

    const candidate = await request('/ai/knowledge/skill-candidates', {
      body: {
        description: `${marker} PDF 报告解析排查流程 Skill`,
        name: state.skillName,
        sourceKnowledgeIds: [state.knowledgeId],
      },
      method: 'POST',
      token: state.adminToken,
    })
    state.candidateId = candidate.id
    assert(candidate.status === 'NEEDS_REVIEW', 'new skill candidate should require review')

    const approved = await request(`/ai/knowledge/skill-candidates/${state.candidateId}/review`, {
      body: { note: `${marker} approve`, status: 'APPROVED' },
      method: 'POST',
      token: state.adminToken,
    })
    assert(approved.status === 'APPROVED', 'skill candidate should be approved')

    const installed = await request(`/ai/knowledge/skill-candidates/${state.candidateId}/install`, {
      method: 'POST',
      token: state.adminToken,
    })
    state.skillPath = installed.targetPath
    assert(installed.candidate?.status === 'INSTALLED', 'skill candidate should be installed')
    assert(state.skillPath && existsSync(state.skillPath), 'installed SKILL.md should exist on host')
    assert(installed.containerPath === `/opt/data/skills/cqupt-src/${state.skillName}/SKILL.md`, 'container path should point to platform skill mount')
  })

  await writeEvidence('passed')
  printSummary()
}

async function step(label, action) {
  const startedAt = performance.now()
  try {
    await action()
    const duration = Math.round(performance.now() - startedAt)
    state.timings.push({ duration, label, ok: true })
    console.log(`PASS ${label} (${duration}ms)`)
  } catch (error) {
    const duration = Math.round(performance.now() - startedAt)
    const message = error instanceof Error ? error.message : String(error)
    state.timings.push({ duration, label, message, ok: false })
    console.error(`FAIL ${label} (${duration}ms): ${message}`)
    await writeEvidence('failed')
    throw error
  }
}

async function login(account) {
  const data = await request('/auth/login/password', {
    body: account,
    expectedStatus: 201,
    method: 'POST',
  })
  assert(data?.accessToken, 'login response should include accessToken')
  return data
}

async function request(path, options = {}) {
  const response = await rawRequest(path, options)
  const contentType = response.headers.get('content-type') ?? ''
  const text = await response.text()
  const data = parseJsonOrText(text, contentType)
  const expected = options.expectedStatus
  if (expected === undefined) {
    if (!response.ok) throw new Error(`${path} expected 2xx, got ${response.status}: ${formatMessage(data)}`)
  } else if (response.status !== expected) {
    throw new Error(`${path} expected HTTP ${expected}, got ${response.status}: ${formatMessage(data)}`)
  }
  return data
}

async function rawRequest(path, options = {}) {
  const headers = { Accept: 'application/json', ...(options.headers ?? {}) }
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  if (options.token) headers.Authorization = `Bearer ${options.token}`
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path.startsWith('/api/') ? path.slice(4) : path}`
  return fetch(url, {
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    headers,
    method: options.method ?? 'GET',
  })
}

async function multipart(path, { fileBuffer, fileName, token }) {
  const form = new FormData()
  form.append('file', new Blob([fileBuffer], { type: 'application/pdf' }), fileName)
  const response = await fetch(`${API_BASE_URL}${path}`, {
    body: form,
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    method: 'POST',
  })
  const text = await response.text()
  const data = parseJsonOrText(text, response.headers.get('content-type') ?? '')
  if (!response.ok) throw new Error(`${path} HTTP ${response.status}: ${formatMessage(data)}`)
  return data
}

async function createTempStudent() {
  const role = await prisma.role.findUnique({ where: { code: 'STUDENT' } })
  assert(role, 'STUDENT role should exist; run backend db:seed first')
  const authSource = await prisma.authorizationSource.findUnique({ where: { code: 'online_exam' } })
  const user = await prisma.user.create({
    data: {
      authorizationLevel: 'BASIC',
      authorizationSourceId: authSource?.id,
      college: 'E2E测试学院',
      email: `${runId}@example.edu.cn`,
      emailVerifiedAt: new Date(),
      grade: '2026',
      identityText: 'E2E 临时学生',
      name: `${marker} 临时学生`,
      passwordHash: hashPassword('E2e123456+-'),
      roleId: role.id,
      status: 'ACTIVE',
      studentNo: runId.slice(0, 32),
      unifiedCode: runId.slice(0, 32),
    },
  })
  return user.id
}

async function buildCorrectExamAnswers(questionIds) {
  const rows = await prisma.securityQuestion.findMany({ where: { id: { in: questionIds } }, select: { answerKeys: true, id: true } })
  const byId = new Map(rows.map((row) => [row.id, row.answerKeys]))
  return questionIds.map((questionId) => ({ questionId, selectedKeys: byId.get(questionId) ?? [] }))
}

function vulnerabilityBody(suffix) {
  return {
    assetName: `${marker} 统一身份认证系统`,
    assetUrl: `https://src-e2e.example.edu.cn/${runId}/${suffix}`,
    detailMarkdown: `## 复现步骤\n1. 在授权测试窗口访问测试资产。\n2. 使用只读参数触发 ${marker} 测试用例。\n3. 观察响应中存在可验证的异常行为但不读取真实数据。\n\n## 影响评估\n该问题可能导致未授权信息暴露，当前 E2E 仅使用模拟资产和脱敏内容验证平台流转。\n\n## 修复建议\n对输入参数进行白名单校验，补充服务端鉴权与审计日志。\n\n## 测试边界说明\n本次测试仅验证平台流程，不对真实系统执行扫描、爆破或破坏性操作。`,
    ownerUnit: 'E2E测试责任单位',
    requestPacket: `GET /${runId}/${suffix} HTTP/1.1\nHost: src-e2e.example.edu.cn`,
    selfSeverity: 'MEDIUM',
    title: `${marker} 授权范围内信息泄露验证 ${suffix}`,
    vulnerabilityType: '信息泄露',
  }
}

function reportPdfText() {
  return `CQUPT-SRC E2E 渗透测试报告\n\n1.1. ${marker} SQL注入漏洞验证\n受影响目标：https://src-e2e.example.edu.cn/${runId}/login\n漏洞类别：Web安全\n漏洞类型：SQL 注入\n漏洞等级：高危\n网络位置：校内授权测试环境\n漏洞描述：登录接口参数缺少严格校验，E2E 使用模拟文本验证报告解析能力。\n漏洞详情：在授权边界内提交单引号参数后出现异常响应，未读取真实数据。\n解决方案：使用参数化查询、统一输入校验并补充审计日志。\n所属定级单元：E2E测试责任单位\n\n2.1. ${marker} XSS 漏洞验证\n受影响目标：https://src-e2e.example.edu.cn/${runId}/profile\n漏洞类别：Web安全\n漏洞类型：XSS\n漏洞等级：中危\n网络位置：校内授权测试环境\n漏洞描述：昵称字段输出编码不足。\n漏洞详情：仅使用安全占位字符串验证解析，不执行脚本。\n解决方案：输出编码并启用 CSP。`
}

function buildPdfBuffer(text) {
  const lines = text.split('\n').slice(0, 60)
  const escaped = lines.map((line) => line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)'))
  const stream = ['BT', '/F1 11 Tf', '50 780 Td', '14 TL', ...escaped.map((line, index) => `${index === 0 ? '' : 'T* '}(${line}) Tj`), 'ET'].join('\n')
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  for (let i = 0; i < objects.length; i += 1) {
    offsets.push(Buffer.byteLength(pdf))
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`
  }
  const xrefOffset = Buffer.byteLength(pdf)
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (let i = 1; i < offsets.length; i += 1) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  return Buffer.from(pdf)
}

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const derivedKey = scryptSync(password, salt, 64).toString('hex')
  return `scrypt:${salt}:${derivedKey}`
}

function parseJsonOrText(text, contentType) {
  if (!text) return null
  if (contentType.includes('application/json')) return JSON.parse(text)
  try { return JSON.parse(text) } catch { return text }
}

function formatMessage(data) {
  if (typeof data === 'object' && data && 'message' in data) return Array.isArray(data.message) ? data.message.join('; ') : String(data.message)
  if (typeof data === 'string') return data.slice(0, 240).replace(/\s+/g, ' ')
  return JSON.stringify(data)
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function writeEvidence(status) {
  const failed = state.timings.filter((item) => !item.ok)
  const evidence = {
    apiBaseUrl: API_BASE_URL,
    failed,
    generatedAt: new Date().toISOString(),
    marker,
    reportId: state.reportId,
    runId,
    skillName: state.skillName,
    skillPath: state.skillPath,
    status,
    steps: state.timings,
  }
  const path = resolve(EVIDENCE_DIR, `core-e2e-${runId}.json`)
  writeFileSync(path, JSON.stringify(evidence, null, 2))
  console.log(`Evidence: ${path}`)
}

function printSummary() {
  const failed = state.timings.filter((item) => !item.ok)
  console.log('')
  console.log(`Summary: ${state.timings.length - failed.length}/${state.timings.length} passed`)
  if (failed.length > 0) process.exitCode = 1
}

async function cleanupArtifacts() {
  if (process.env.CLEANUP_E2E_ARTIFACTS === 'false') return

  if (state.skillPath) {
    rmSync(dirname(state.skillPath), { force: true, recursive: true })
  }

  if (state.candidateId) {
    await prisma.aiSkillInstallLog.deleteMany({ where: { candidateId: state.candidateId } })
    await prisma.aiSkillCandidate.deleteMany({ where: { id: state.candidateId } })
  }

  if (state.knowledgeId) {
    await prisma.aiKnowledgeRevision.deleteMany({ where: { knowledgeId: state.knowledgeId } })
    await prisma.aiKnowledgeFeedback.deleteMany({ where: { knowledgeId: state.knowledgeId } })
    await prisma.aiKnowledgeHit.deleteMany({ where: { knowledgeId: state.knowledgeId } })
    await prisma.aiKnowledgeEntry.deleteMany({ where: { id: state.knowledgeId } })
  }

  if (state.reportId) {
    await prisma.vulnerabilityAttachment.deleteMany({ where: { reportId: state.reportId } })
    await prisma.vulnerabilityEvent.deleteMany({ where: { reportId: state.reportId } })
    await prisma.reviewComment.deleteMany({ where: { reportId: state.reportId } })
    await prisma.reviewAssignment.deleteMany({ where: { reportId: state.reportId } })
    await prisma.retestRecord.deleteMany({ where: { reportId: state.reportId } })
    await prisma.pointLedgerEntry.deleteMany({ where: { reportId: state.reportId } })
    await prisma.vulnerabilityReport.deleteMany({ where: { id: state.reportId } })
  }

  if (state.tempUserId) {
    await prisma.auditLog.deleteMany({ where: { actorId: state.tempUserId } })
    await prisma.refreshToken.deleteMany({ where: { userId: state.tempUserId } })
    await prisma.securityExamAttempt.deleteMany({ where: { userId: state.tempUserId } })
    await prisma.responsibilitySignature.deleteMany({ where: { userId: state.tempUserId } })
    await prisma.aiCallLog.deleteMany({ where: { userId: state.tempUserId } })
    await prisma.user.deleteMany({ where: { id: state.tempUserId } })
  }

  console.log('Cleaned E2E database and installed-skill artifacts')
}

async function cleanup() {
  if (process.exitCode !== 1) {
    await cleanupArtifacts()
  }
  await prisma.$disconnect()
}

try {
  await main()
} catch (error) {
  console.error(error instanceof Error ? error.stack : error)
  process.exitCode = 1
} finally {
  await cleanup()
}
