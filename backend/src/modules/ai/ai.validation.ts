import { BadRequestException } from '@nestjs/common'
import { AiChatBody, NormalizedAiChatInput } from './ai.types'

const allowedModes = new Set(['student', 'auditor', 'admin'])

export function normalizeAiChatBody(body: AiChatBody): NormalizedAiChatInput {
  const message = requireText(body.message, '消息内容', 1, 6000)
  const mode = normalizeMode(body.mode)

  return {
    context: normalizeContext(body.context),
    message,
    mode,
  }
}

function requireText(value: unknown, label: string, minLength: number, maxLength: number) {
  if (typeof value !== 'string') {
    throw new BadRequestException(`${label}格式不正确`)
  }

  const text = value.trim()
  if (text.length < minLength) {
    throw new BadRequestException(`${label}不能为空`)
  }

  if (text.length > maxLength) {
    throw new BadRequestException(`${label}不能超过 ${maxLength} 个字符`)
  }

  return text
}

function normalizeMode(value: unknown): NormalizedAiChatInput['mode'] {
  if (value === undefined || value === null || value === '') return 'student'

  if (typeof value !== 'string') {
    throw new BadRequestException('AI 模式格式不正确')
  }

  const mode = value.trim().toLowerCase()
  if (allowedModes.has(mode)) {
    return mode as NormalizedAiChatInput['mode']
  }

  throw new BadRequestException('AI 模式不正确')
}

function normalizeContext(value: unknown) {
  if (value === undefined || value === null || value === '') return undefined

  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException('上下文格式不正确')
  }

  const json = JSON.stringify(value)
  if (json.length > 12000) {
    throw new BadRequestException('上下文内容过长')
  }

  return value as Record<string, unknown>
}
