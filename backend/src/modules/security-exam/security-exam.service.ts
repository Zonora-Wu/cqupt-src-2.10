import { BadGatewayException, BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common'
import { AiCallPurpose, AiSpace, AuditAction, SecurityQuestion, SecurityQuestionType } from '@prisma/client'
import { PDFParse } from 'pdf-parse'
import { AuthenticatedRequestUser, ClientRequestMeta } from '../auth/auth.types'
import { PrismaService } from '../prisma/prisma.service'
import { NormalizedSecurityQuestionInput, SecurityExamAnswerInput, SecurityExamQuestionView, SecurityQuestionAdminView, SecurityQuestionOption } from './security-exam.types'
import { normalizeImportedQuestionPayload } from './security-exam.validation'

const QUESTION_BLUEPRINT: Record<SecurityQuestionType, number> = {
  [SecurityQuestionType.SINGLE_CHOICE]: 10,
  [SecurityQuestionType.TRUE_FALSE]: 5,
  [SecurityQuestionType.MULTIPLE_CHOICE]: 5,
}
const TOTAL_SCORE = 100
const DEFAULT_OPENAI_BASE_URL = 'http://localhost:5000/v1'
const DEFAULT_OPENAI_MODEL = 'hermes-agent'

type UploadedQuestionFile = { buffer?: Buffer; mimetype?: string; originalname?: string; size?: number }

@Injectable()
export class SecurityExamService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getExamPaper(): Promise<{ questions: SecurityExamQuestionView[]; totalScore: number; threshold: number }> {
    const [threshold, groups] = await Promise.all([
      this.getSecurityExamThreshold(),
      Promise.all(Object.entries(QUESTION_BLUEPRINT).map(async ([type, count]) => {
        const questions = await this.prisma.securityQuestion.findMany({
          where: { active: true, deletedAt: null, type: type as SecurityQuestionType },
          orderBy: { createdAt: 'desc' },
          take: 300,
        })
        if (questions.length < count) {
          throw new BadRequestException(`安全题库中${formatType(type as SecurityQuestionType)}不足 ${count} 道，请联系管理员补充题库`)
        }
        return sample(questions, count)
      })),
    ])
    return {
      questions: groups.flat().sort(() => Math.random() - 0.5).map(toQuestionView),
      threshold,
      totalScore: TOTAL_SCORE,
    }
  }

  async submitExam(user: AuthenticatedRequestUser, answers: SecurityExamAnswerInput[], meta: ClientRequestMeta) {
    const threshold = await this.getSecurityExamThreshold()
    const ids = Array.from(new Set(answers.map((answer) => answer.questionId)))
    if (ids.length !== 20) throw new BadRequestException('安全答题需完成 20 道题后提交')

    const questions = await this.prisma.securityQuestion.findMany({ where: { active: true, deletedAt: null, id: { in: ids } } })
    if (questions.length !== ids.length) throw new BadRequestException('题目已更新，请刷新后重新答题')

    const answerMap = new Map(answers.map((answer) => [answer.questionId, normalizeKeys(answer.selectedKeys)]))
    let correctCount = 0
    const detail = questions.map((question) => {
      const selectedKeys = answerMap.get(question.id) ?? []
      const correct = sameKeys(selectedKeys, question.answerKeys)
      if (correct) correctCount += 1
      return {
        correct,
        questionId: question.id,
        selectedKeys,
        type: question.type,
      }
    })
    const score = Math.round((correctCount / questions.length) * TOTAL_SCORE)
    const passed = score >= threshold

    const attempt = await this.prisma.$transaction(async (tx) => {
      const created = await tx.securityExamAttempt.create({
        data: {
          correctCount,
          detailJson: detail,
          ipAddress: meta.ipAddress,
          passed,
          questionCount: questions.length,
          score,
          threshold,
          totalScore: TOTAL_SCORE,
          userAgent: meta.userAgent,
          userId: user.id,
        },
      })
      await tx.auditLog.create({
        data: {
          action: AuditAction.MANAGE_USER,
          actorId: user.id,
          ipAddress: meta.ipAddress,
          metadata: { action: 'submit_security_exam', correctCount, passed, questionCount: questions.length, score, threshold },
          requestPath: meta.requestPath,
          result: 'success',
          targetId: created.id,
          targetType: 'SecurityExamAttempt',
          userAgent: meta.userAgent,
        },
      })
      return created
    })

    return { correctCount, passed: attempt.passed, questionCount: questions.length, score: attempt.score, submittedAt: attempt.createdAt, threshold }
  }

  async listQuestions(): Promise<SecurityQuestionAdminView[]> {
    const rows = await this.prisma.securityQuestion.findMany({
      orderBy: [{ active: 'desc' }, { updatedAt: 'desc' }],
      take: 300,
      where: { deletedAt: null },
    })
    return rows.map(toAdminView)
  }

  async createQuestions(questions: NormalizedSecurityQuestionInput[], user: AuthenticatedRequestUser, meta: ClientRequestMeta, source = 'ADMIN') {
    const created = await this.prisma.$transaction(async (tx) => {
      const rows = []
      for (const question of questions) {
        rows.push(await tx.securityQuestion.create({
          data: {
            active: true,
            answerKeys: question.answerKeys,
            createdById: user.id,
            explanation: question.explanation,
            options: question.options,
            source,
            stem: question.stem,
            type: question.type,
          },
        }))
      }
      await tx.auditLog.create({
        data: {
          action: AuditAction.CHANGE_SYSTEM_SETTING,
          actorId: user.id,
          ipAddress: meta.ipAddress,
          metadata: { action: 'create_security_questions', count: rows.length, source },
          requestPath: meta.requestPath,
          result: 'success',
          targetId: rows[0]?.id,
          targetType: 'SecurityQuestion',
          userAgent: meta.userAgent,
        },
      })
      await tx.systemSetting.upsert({
        where: { key: 'security.exam.required' },
        create: { key: 'security.exam.required', value: { enabled: true }, description: '是否要求用户完成网络安全知识答题' },
        update: { value: { enabled: true }, updatedById: user.id },
      })
      await tx.systemSetting.upsert({
        where: { key: 'security.exam.threshold' },
        create: { key: 'security.exam.threshold', value: { threshold: 80 }, description: '网络安全知识答题通过分数' },
        update: { value: { threshold: 80 }, updatedById: user.id },
      })
      return rows
    })
    return { count: created.length, questions: created.map(toAdminView) }
  }

  async setQuestionActive(id: string, active: boolean, user: AuthenticatedRequestUser, meta: ClientRequestMeta) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const question = await tx.securityQuestion.update({ where: { id }, data: { active } })
      await tx.auditLog.create({
        data: {
          action: AuditAction.CHANGE_SYSTEM_SETTING,
          actorId: user.id,
          ipAddress: meta.ipAddress,
          metadata: { action: 'set_security_question_active', active },
          requestPath: meta.requestPath,
          result: 'success',
          targetId: question.id,
          targetType: 'SecurityQuestion',
          userAgent: meta.userAgent,
        },
      })
      return question
    })
    return toAdminView(updated)
  }

  async updateQuestion(id: string, input: NormalizedSecurityQuestionInput, user: AuthenticatedRequestUser, meta: ClientRequestMeta) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.securityQuestion.findFirst({ where: { deletedAt: null, id } })
      if (!existing) throw new NotFoundException('题目不存在或已删除')
      const question = await tx.securityQuestion.update({
        data: {
          answerKeys: input.answerKeys,
          explanation: input.explanation,
          options: input.options,
          stem: input.stem,
          type: input.type,
        },
        where: { id },
      })
      await tx.auditLog.create({
        data: {
          action: AuditAction.CHANGE_SYSTEM_SETTING,
          actorId: user.id,
          ipAddress: meta.ipAddress,
          metadata: { action: 'update_security_question', type: input.type },
          requestPath: meta.requestPath,
          result: 'success',
          targetId: id,
          targetType: 'SecurityQuestion',
          userAgent: meta.userAgent,
        },
      })
      return question
    })
    return toAdminView(updated)
  }

  async deleteQuestion(id: string, user: AuthenticatedRequestUser, meta: ClientRequestMeta) {
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.securityQuestion.findFirst({ where: { deletedAt: null, id } })
      if (!existing) throw new NotFoundException('题目不存在或已删除')
      await tx.securityQuestion.update({ where: { id }, data: { active: false, deletedAt: new Date() } })
      await tx.auditLog.create({
        data: {
          action: AuditAction.CHANGE_SYSTEM_SETTING,
          actorId: user.id,
          ipAddress: meta.ipAddress,
          metadata: { action: 'delete_security_question', type: existing.type },
          requestPath: meta.requestPath,
          result: 'success',
          targetId: id,
          targetType: 'SecurityQuestion',
          userAgent: meta.userAgent,
        },
      })
    })
    return { id, ok: true }
  }

  async replaceQuestion(id: string, input: NormalizedSecurityQuestionInput, user: AuthenticatedRequestUser, meta: ClientRequestMeta) {
    const replacement = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.securityQuestion.findFirst({ where: { deletedAt: null, id } })
      if (!existing) throw new NotFoundException('题目不存在或已删除')
      await tx.securityQuestion.update({ where: { id }, data: { active: false, deletedAt: new Date() } })
      const question = await tx.securityQuestion.create({
        data: {
          active: true,
          answerKeys: input.answerKeys,
          createdById: user.id,
          explanation: input.explanation,
          options: input.options,
          source: 'ADMIN_REPLACEMENT',
          stem: input.stem,
          type: input.type,
        },
      })
      await tx.auditLog.create({
        data: {
          action: AuditAction.CHANGE_SYSTEM_SETTING,
          actorId: user.id,
          ipAddress: meta.ipAddress,
          metadata: { action: 'replace_security_question', previousQuestionId: id, type: input.type },
          requestPath: meta.requestPath,
          result: 'success',
          targetId: question.id,
          targetType: 'SecurityQuestion',
          userAgent: meta.userAgent,
        },
      })
      return question
    })
    return toAdminView(replacement)
  }

  async getSettings() {
    const [enabled, threshold] = await Promise.all([this.isSecurityExamRequired(), this.getSecurityExamThreshold()])
    const counts = await this.prisma.securityQuestion.groupBy({
      by: ['type'],
      _count: { _all: true },
      where: { active: true, deletedAt: null },
    })
    return {
      enabled,
      threshold,
      totalScore: TOTAL_SCORE,
      requiredCounts: QUESTION_BLUEPRINT,
      activeCounts: Object.fromEntries(counts.map((item) => [item.type, item._count._all])),
    }
  }

  async updateSettings(input: { enabled: boolean; threshold: number }, user: AuthenticatedRequestUser, meta: ClientRequestMeta) {
    const threshold = clampThreshold(input.threshold)
    await this.prisma.$transaction(async (tx) => {
      await tx.systemSetting.upsert({
        where: { key: 'security.exam.required' },
        create: { key: 'security.exam.required', value: { enabled: input.enabled }, description: '是否要求用户完成网络安全知识答题', updatedById: user.id },
        update: { value: { enabled: input.enabled }, updatedById: user.id },
      })
      await tx.systemSetting.upsert({
        where: { key: 'security.exam.threshold' },
        create: { key: 'security.exam.threshold', value: { threshold }, description: '网络安全知识答题通过分数', updatedById: user.id },
        update: { value: { threshold }, updatedById: user.id },
      })
      await tx.auditLog.create({
        data: {
          action: AuditAction.CHANGE_SYSTEM_SETTING,
          actorId: user.id,
          ipAddress: meta.ipAddress,
          metadata: { action: 'update_security_exam_settings', enabled: input.enabled, threshold },
          requestPath: meta.requestPath,
          result: 'success',
          targetType: 'SystemSetting',
          userAgent: meta.userAgent,
        },
      })
    })
    return this.getSettings()
  }

  async generateQuestionsWithAi(input: { difficulty: string; topic: string }, user: AuthenticatedRequestUser, meta: ClientRequestMeta) {
    const prompt = buildQuestionGenerationPrompt(input.topic, input.difficulty)
    const { content, questions, result } = await this.generateValidatedQuestionSet(prompt, 0.4)
    const created = await this.createQuestions(questions, user, meta, 'AI_GENERATED')
    await this.prisma.aiCallLog.create({ data: { aiSpace: AiSpace.ADMIN, modelName: getOpenAiModel(), purpose: AiCallPurpose.SECURITY_QUESTION_GENERATION, sanitizedInputSummary: prompt.slice(0, 1000), outputSummary: content.slice(0, 1000), tokensUsed: extractTokenUsage(result.body), userId: user.id } })
    return created
  }

  async importQuestionsFromFile(file: UploadedQuestionFile | undefined, user: AuthenticatedRequestUser, meta: ClientRequestMeta) {
    if (!file?.buffer?.length) throw new BadRequestException('请上传题库文件')
    if (file.size && file.size > 10 * 1024 * 1024) throw new BadRequestException('题库文件不能超过 10MB')
    const text = await extractFileText(file)
    const name = file.originalname?.toLowerCase() ?? ''
    if (name.endsWith('.json') || file.mimetype?.includes('application/json')) {
      try {
        const questions = normalizeImportedQuestionPayload(JSON.parse(text))
        return this.createQuestions(questions, user, meta, 'FILE_IMPORT')
      } catch (error) {
        if (error instanceof BadRequestException) throw error
        throw new BadRequestException('题库 JSON 格式无效，请检查后重新导入')
      }
    }
    const prompt = buildQuestionImportPrompt(text.slice(0, 20_000))
    const result = await this.requestOpenAi('chat/completions', {
      body: { messages: [{ role: 'system', content: '你是题库结构化解析器。只输出 JSON，不输出 Markdown。' }, { role: 'user', content: prompt }], model: getOpenAiModel(), temperature: 0.1 },
      method: 'POST',
      timeoutMs: 60_000,
    })
    const content = extractOpenAiContent(result.body)
    const questions = normalizeImportedQuestionPayload(parseJsonPayload(content))
    return this.createQuestions(questions, user, meta, 'AI_IMPORT')
  }

  async generateQuestionsFromKnowledgeFile(file: UploadedQuestionFile | undefined, user: AuthenticatedRequestUser, meta: ClientRequestMeta) {
    if (!file?.buffer?.length) throw new BadRequestException('请上传知识库文件')
    if (file.size && file.size > 10 * 1024 * 1024) throw new BadRequestException('知识库文件不能超过 10MB')
    const text = await extractFileText(file)
    if (text.length < 100) throw new BadRequestException('知识库内容过短，无法生成有效题目')

    const prompt = buildQuestionGenerationPrompt('上传知识库中的网络安全规范与授权测试要求', '基础到中等', text.slice(0, 20_000))
    const { content, questions, result } = await this.generateValidatedQuestionSet(prompt, 0.35)
    const created = await this.createQuestions(questions, user, meta, 'AI_KNOWLEDGE_GENERATED')
    await this.prisma.aiCallLog.create({ data: { aiSpace: AiSpace.ADMIN, modelName: getOpenAiModel(), purpose: AiCallPurpose.SECURITY_QUESTION_GENERATION, sanitizedInputSummary: `知识库生成：${file.originalname ?? '未命名文件'}\n${text.slice(0, 1000)}`, outputSummary: content.slice(0, 1000), tokensUsed: extractTokenUsage(result.body), userId: user.id } })
    return created
  }

  private async isSecurityExamRequired() {
    const setting = await this.prisma.systemSetting.findUnique({ where: { key: 'security.exam.required' } })
    if (setting?.value === true) return true
    if (typeof setting?.value === 'object' && setting.value && 'enabled' in setting.value) return Boolean((setting.value as { enabled?: unknown }).enabled)
    return true
  }

  private async getSecurityExamThreshold() {
    const setting = await this.prisma.systemSetting.findUnique({ where: { key: 'security.exam.threshold' } })
    if (typeof setting?.value === 'number') return clampThreshold(setting.value)
    if (typeof setting?.value === 'object' && setting.value && 'threshold' in setting.value) return clampThreshold(Number((setting.value as { threshold?: unknown }).threshold))
    return 80
  }

  private async requestOpenAi(path: string, options: { body?: unknown; method: 'GET' | 'POST'; timeoutMs: number }) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs)
    const headers: Record<string, string> = options.body === undefined ? {} : { 'Content-Type': 'application/json' }
    const apiKey = process.env.OPENAI_API_KEY || process.env.HERMES_AGENT_API_KEY || ''
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`
    try {
      const response = await fetch(new URL(path, getOpenAiBaseUrl()), { body: options.body === undefined ? undefined : JSON.stringify(options.body), headers, method: options.method, signal: controller.signal })
      const body = await readResponseBody(response)
      if (!response.ok) throw new BadGatewayException({ detail: body, message: 'AI 题库生成调用失败', status: response.status })
      return { body, status: response.status }
    } catch (error) {
      if (error instanceof BadGatewayException) throw error
      throw new ServiceUnavailableException(error instanceof Error && error.name === 'AbortError' ? 'AI 题库生成超时，请稍后重试' : 'AI 题库生成服务暂不可用')
    } finally {
      clearTimeout(timeout)
    }
  }

  private async generateValidatedQuestionSet(prompt: string, temperature: number) {
    const batches = await Promise.all([
      this.generateValidatedQuestionBatch(prompt, temperature, SecurityQuestionType.SINGLE_CHOICE, QUESTION_BLUEPRINT[SecurityQuestionType.SINGLE_CHOICE]),
      this.generateValidatedQuestionBatch(prompt, temperature, SecurityQuestionType.TRUE_FALSE, QUESTION_BLUEPRINT[SecurityQuestionType.TRUE_FALSE]),
      this.generateValidatedQuestionBatch(prompt, temperature, SecurityQuestionType.MULTIPLE_CHOICE, QUESTION_BLUEPRINT[SecurityQuestionType.MULTIPLE_CHOICE]),
    ])
    const questions = batches.flatMap((batch) => batch.questions)
    assertQuestionBlueprint(questions)
    return {
      content: batches.map((batch) => batch.content).join('\n'),
      questions,
      result: { body: { usage: { total_tokens: batches.reduce((total, batch) => total + (extractTokenUsage(batch.result.body) ?? 0), 0) } } },
    }
  }

  private async generateValidatedQuestionBatch(
    prompt: string,
    temperature: number,
    type: SecurityQuestionType,
    count: number,
  ) {
    let lastError: unknown
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const retryInstruction = attempt === 0
        ? buildQuestionBatchPrompt(prompt, type, count)
        : `${buildQuestionBatchPrompt(prompt, type, count)}\n上一轮输出未通过校验。请严格只返回 ${count} 道 ${type} 题，不能少题、不能混入其他题型。`
      const result = await this.requestOpenAi('chat/completions', {
        body: { max_tokens: type === SecurityQuestionType.SINGLE_CHOICE ? 5000 : 3000, messages: [{ role: 'system', content: '你是 CQUPT-SRC 网络安全知识题库专家。只输出 JSON，不输出 Markdown。' }, { role: 'user', content: retryInstruction }], model: getOpenAiModel(), temperature },
        method: 'POST',
        timeoutMs: 45_000,
      })
      const content = extractOpenAiContent(result.body)
      try {
        const questions = normalizeImportedQuestionPayload(parseJsonPayload(content))
        if (questions.length !== count || questions.some((question) => question.type !== type)) {
          throw new BadRequestException(`AI 返回的${formatType(type)}数量或题型不符合要求`)
        }
        return { content, questions, result }
      } catch (error) {
        lastError = error
      }
    }
    const reason = lastError instanceof Error ? lastError.message : '返回内容不符合题库格式'
    throw new BadRequestException(`AI 连续两次返回的${formatType(type)}未通过校验：${reason}`)
  }
}

function toQuestionView(question: SecurityQuestion): SecurityExamQuestionView {
  return { id: question.id, options: normalizeOptionJson(question.options), stem: question.stem, type: question.type }
}

function toAdminView(question: SecurityQuestion): SecurityQuestionAdminView {
  return { ...toQuestionView(question), active: question.active, answerKeys: question.answerKeys, createdAt: question.createdAt, explanation: question.explanation, source: question.source, updatedAt: question.updatedAt }
}

function normalizeOptionJson(value: unknown): SecurityQuestionOption[] {
  return Array.isArray(value) ? value.map((item) => ({ key: String((item as { key?: unknown }).key ?? ''), text: String((item as { text?: unknown }).text ?? '') })).filter((item) => item.key && item.text) : []
}
function assertQuestionBlueprint(questions: NormalizedSecurityQuestionInput[]) {
  if (questions.length !== 20) throw new BadRequestException('AI 生成题目数量不符合要求，请重试')
  for (const [type, count] of Object.entries(QUESTION_BLUEPRINT)) {
    if (questions.filter((question) => question.type === type).length !== count) {
      throw new BadRequestException(`AI 生成的${formatType(type as SecurityQuestionType)}数量不符合要求，请重试`)
    }
  }
}
function normalizeKeys(keys: string[]) { return Array.from(new Set(keys.map((key) => key.trim().toUpperCase()).filter(Boolean))).sort() }
function sameKeys(a: string[], b: string[]) { const aa = normalizeKeys(a); const bb = normalizeKeys(b); return aa.length === bb.length && aa.every((key, index) => key === bb[index]) }
function sample<T>(items: T[], count: number) { return [...items].sort(() => Math.random() - 0.5).slice(0, count) }
function formatType(type: SecurityQuestionType) { return type === SecurityQuestionType.SINGLE_CHOICE ? '单选题' : type === SecurityQuestionType.TRUE_FALSE ? '判断题' : '多选题' }
function clampThreshold(value: number) { return Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : 80 }
function getOpenAiBaseUrl() { const baseUrl = process.env.OPENAI_BASE_URL || process.env.HERMES_AGENT_BASE_URL || DEFAULT_OPENAI_BASE_URL; return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/` }
function getOpenAiModel() { return process.env.OPENAI_MODEL || process.env.HERMES_AGENT_MODEL || DEFAULT_OPENAI_MODEL }
async function readResponseBody(response: Response) { const contentType = response.headers.get('content-type') ?? ''; return contentType.includes('application/json') ? response.json() : response.text() }
function extractOpenAiContent(body: unknown) { const choices = body && typeof body === 'object' ? (body as { choices?: unknown }).choices : null; if (!Array.isArray(choices)) return ''; const first = choices[0] as { message?: { content?: unknown }; text?: unknown } | undefined; return typeof first?.message?.content === 'string' ? first.message.content : typeof first?.text === 'string' ? first.text : '' }
function extractTokenUsage(body: unknown) { const usage = body && typeof body === 'object' ? (body as { usage?: unknown }).usage : null; const total = usage && typeof usage === 'object' ? ((usage as { total_tokens?: unknown }).total_tokens) : null; const n = Number(total); return Number.isFinite(n) ? Math.ceil(n) : null }
function parseJsonPayload(content: string) {
  const cleaned = content.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
  const start = [cleaned.indexOf('{'), cleaned.indexOf('[')].filter((index) => index >= 0).sort((a, b) => a - b)[0]
  if (start === undefined) throw new BadRequestException('AI 未返回 JSON 题库')
  const candidate = extractCompleteJson(cleaned, start)
  if (!candidate) throw new BadRequestException('AI 返回的 JSON 不完整')
  try {
    return JSON.parse(candidate) as unknown
  } catch {
    throw new BadRequestException('AI 返回的 JSON 格式无效')
  }
}
function extractCompleteJson(value: string, start: number) {
  const opening = value[start]
  const closing = opening === '{' ? '}' : ']'
  let depth = 0
  let escaped = false
  let inString = false
  for (let index = start; index < value.length; index += 1) {
    const char = value[index]
    if (inString) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') inString = true
    else if (char === opening) depth += 1
    else if (char === closing && --depth === 0) return value.slice(start, index + 1)
  }
  return null
}
async function extractFileText(file: UploadedQuestionFile) { const name = file.originalname?.toLowerCase() ?? ''; const mime = file.mimetype ?? ''; if (mime.includes('pdf') || name.endsWith('.pdf')) { const parser = new PDFParse({ data: file.buffer }); const result = await parser.getText(); await parser.destroy(); return (result.text ?? '').trim() } return file.buffer?.toString('utf8').trim() ?? '' }
function buildQuestionGenerationPrompt(topic: string, difficulty: string, knowledgeContext?: string) { return `请围绕“${topic}”生成 CQUPT-SRC 新用户准入网络安全知识题库，难度：${difficulty}。目标读者是没有专业基础的大一学生，题干与选项要简短、清楚、贴近日常校园网络使用场景。

最终题库蓝图为 20 道题：10 道 SINGLE_CHOICE、5 道 TRUE_FALSE、5 道 MULTIPLE_CHOICE；本次请求的具体题型和数量以末尾批次要求为准。

重点范围：网络安全法律法规的基础意识（不要求记忆法条编号）、个人信息和数据保护、网络账号安全、授权测试边界、漏洞负责任披露、渗透测试中应避免的行为，例如未授权扫描、爆破、撞库、数据下载、拒绝服务、权限维持、后门植入、公开未修复漏洞。

约束：只考察安全规范和风险判断；不要考察命令、工具参数、漏洞利用、绕过方法、攻击链或真实系统操作步骤；避免专业术语堆砌、复杂计算、陷阱题和需要猜测的题目。每题提供简洁的 explanation，说明正确行为或风险原因。${knowledgeContext ? `\n题目应以以下知识库内容为背景，优先考察其明确规定；知识库未覆盖的内容可使用上述基础安全规范补充。\n知识库：\n${knowledgeContext}\n` : ''}输出 JSON：{"questions":[{"type":"SINGLE_CHOICE","stem":"...","options":[{"key":"A","text":"..."}],"answerKeys":["A"],"explanation":"..."}]}` }
function buildQuestionBatchPrompt(basePrompt: string, type: SecurityQuestionType, count: number) { return `${basePrompt}\n\n本轮只生成 ${count} 道 ${type}。不要生成其他题型；返回 JSON 中 questions 数组必须恰好有 ${count} 项。${type === SecurityQuestionType.SINGLE_CHOICE ? '每题提供 A、B、C、D 四个选项且只有一个正确答案。' : type === SecurityQuestionType.TRUE_FALSE ? '每题提供 A=正确、B=错误 两个选项且只有一个正确答案。' : '每题提供 A、B、C、D 四个选项，answerKeys 必须有两个或以上正确答案。'}` }
function buildQuestionImportPrompt(text: string) { return `请将下面题库材料解析成平台标准题库 JSON。只保留网络安全知识、SRC 责任边界、数据脱敏、漏洞提交规范相关内容。若原材料没有答案，请基于安全常识补全答案并写 explanation。输出 JSON 格式同 {"questions":[...]}。材料：\n${text}` }
