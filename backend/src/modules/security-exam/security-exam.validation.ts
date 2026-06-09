import { BadRequestException } from '@nestjs/common'
import { SecurityQuestionType } from '@prisma/client'
import { NormalizedSecurityQuestionInput, SecurityExamAnswerInput, SecurityQuestionOption } from './security-exam.types'

const allowedTypes = new Set(Object.values(SecurityQuestionType))
const keyPattern = /^[A-Z]$/

export function normalizeQuestionBody(body: Record<string, unknown>): NormalizedSecurityQuestionInput {
  return normalizeQuestion(body)
}

export function normalizeQuestionListBody(body: Record<string, unknown>): NormalizedSecurityQuestionInput[] {
  const rawQuestions = Array.isArray(body.questions) ? body.questions : [body]
  const questions = rawQuestions.map((item) => normalizeQuestion(asRecord(item)))
  if (questions.length === 0) throw new BadRequestException('题库不能为空')
  if (questions.length > 100) throw new BadRequestException('单次最多导入 100 道题')
  return questions
}

export function normalizeSubmitExamBody(body: Record<string, unknown>): SecurityExamAnswerInput[] {
  const rawAnswers = Array.isArray(body.answers) ? body.answers : []
  if (rawAnswers.length === 0) throw new BadRequestException('请先完成答题')
  if (rawAnswers.length > 50) throw new BadRequestException('答题数量异常')
  return rawAnswers.map((item) => {
    const record = asRecord(item)
    const questionId = typeof record.questionId === 'string' ? record.questionId.trim() : ''
    const selectedKeys = normalizeKeyArray(record.selectedKeys)
    if (!questionId) throw new BadRequestException('题目 ID 不能为空')
    return { questionId, selectedKeys }
  })
}

export function normalizeAiGenerateBody(body: Record<string, unknown>) {
  const topic = typeof body.topic === 'string' && body.topic.trim() ? body.topic.trim().slice(0, 120) : '校园网络安全知识、SRC 负责任漏洞提交规范'
  const difficulty = typeof body.difficulty === 'string' && body.difficulty.trim() ? body.difficulty.trim().slice(0, 40) : '基础到中等'
  return { difficulty, topic }
}

export function normalizeImportedQuestionPayload(value: unknown): NormalizedSecurityQuestionInput[] {
  const payload = Array.isArray(value) ? value : asRecord(value).questions
  if (!Array.isArray(payload)) throw new BadRequestException('AI 未能识别有效题库结构')
  return payload.map((item) => normalizeQuestion(asRecord(item)))
}

function normalizeQuestion(record: Record<string, unknown>): NormalizedSecurityQuestionInput {
  const type = normalizeType(record.type)
  const stem = typeof record.stem === 'string' ? record.stem.trim() : typeof record.question === 'string' ? record.question.trim() : ''
  if (stem.length < 6) throw new BadRequestException('题干内容过短')
  if (stem.length > 500) throw new BadRequestException('题干不能超过 500 字')

  const options = normalizeOptions(record.options, type)
  const answerKeys = normalizeKeyArray(record.answerKeys ?? record.answers ?? record.answer)
  if (answerKeys.length === 0) throw new BadRequestException(`题目“${stem.slice(0, 24)}”缺少答案`)
  const optionKeys = new Set(options.map((option) => option.key))
  for (const key of answerKeys) {
    if (!optionKeys.has(key)) throw new BadRequestException(`答案 ${key} 不在选项中`)
  }
  if (type !== SecurityQuestionType.MULTIPLE_CHOICE && answerKeys.length !== 1) {
    throw new BadRequestException('单选题和判断题只能有一个正确答案')
  }
  if (type === SecurityQuestionType.MULTIPLE_CHOICE && answerKeys.length < 2) {
    throw new BadRequestException('多选题至少需要两个正确答案')
  }

  const explanation = typeof record.explanation === 'string' && record.explanation.trim() ? record.explanation.trim().slice(0, 1000) : undefined
  return { answerKeys: answerKeys.sort(), explanation, options, stem, type }
}

function normalizeType(value: unknown) {
  const raw = typeof value === 'string' ? value.trim().toUpperCase() : ''
  const alias: Record<string, SecurityQuestionType> = {
    SINGLE: SecurityQuestionType.SINGLE_CHOICE,
    SINGLE_CHOICE: SecurityQuestionType.SINGLE_CHOICE,
    单选: SecurityQuestionType.SINGLE_CHOICE,
    单选题: SecurityQuestionType.SINGLE_CHOICE,
    TRUE_FALSE: SecurityQuestionType.TRUE_FALSE,
    TRUEFALSE: SecurityQuestionType.TRUE_FALSE,
    判断: SecurityQuestionType.TRUE_FALSE,
    判断题: SecurityQuestionType.TRUE_FALSE,
    MULTIPLE: SecurityQuestionType.MULTIPLE_CHOICE,
    MULTIPLE_CHOICE: SecurityQuestionType.MULTIPLE_CHOICE,
    多选: SecurityQuestionType.MULTIPLE_CHOICE,
    多选题: SecurityQuestionType.MULTIPLE_CHOICE,
  }
  const normalized = alias[raw] ?? raw
  if (!allowedTypes.has(normalized as SecurityQuestionType)) throw new BadRequestException('题目类型无效')
  return normalized as SecurityQuestionType
}

function normalizeOptions(value: unknown, type: SecurityQuestionType): SecurityQuestionOption[] {
  if (type === SecurityQuestionType.TRUE_FALSE && !Array.isArray(value)) {
    return [{ key: 'A', text: '正确' }, { key: 'B', text: '错误' }]
  }
  if (!Array.isArray(value)) throw new BadRequestException('题目选项必须是数组')
  const options = value.map((item, index) => {
    if (typeof item === 'string') return { key: String.fromCharCode(65 + index), text: item.trim() }
    const record = asRecord(item)
    const key = typeof record.key === 'string' ? record.key.trim().toUpperCase() : String.fromCharCode(65 + index)
    const text = typeof record.text === 'string' ? record.text.trim() : typeof record.label === 'string' ? record.label.trim() : ''
    return { key, text }
  }).filter((option) => option.text)
  if (options.length < 2) throw new BadRequestException('每道题至少需要 2 个选项')
  if (options.length > 8) throw new BadRequestException('每道题最多 8 个选项')
  const keys = new Set<string>()
  for (const option of options) {
    if (!keyPattern.test(option.key)) throw new BadRequestException('选项 key 必须为 A-Z')
    if (keys.has(option.key)) throw new BadRequestException('选项 key 不能重复')
    keys.add(option.key)
  }
  return options
}

function normalizeKeyArray(value: unknown) {
  const source = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,，、\s]+/) : []
  return Array.from(new Set(source.map((item) => String(item).trim().toUpperCase()).filter((key) => keyPattern.test(key)))).sort()
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}
