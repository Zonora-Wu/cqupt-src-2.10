import { BadRequestException } from '@nestjs/common'
import { PublishResponsibilityAgreementInput, SignResponsibilityAgreementInput, SubmitSecurityExamInput } from './access.types'

export function normalizeSignResponsibilityAgreementBody(body: Record<string, unknown>): SignResponsibilityAgreementInput {
  return {
    deviceFingerprint: optionalText(body.deviceFingerprint, 160),
  }
}

export function normalizePublishResponsibilityAgreementBody(body: Record<string, unknown>): PublishResponsibilityAgreementInput {
  const title = requiredText(body.title, '责任书标题', 120)
  const content = requiredText(body.content, '责任书正文', 100_000)
  return { content, title }
}

export function normalizeSubmitSecurityExamBody(body: Record<string, unknown>): SubmitSecurityExamInput {
  const score = typeof body.score === 'number' ? body.score : Number(body.score)
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    throw new BadRequestException('安全答题分数必须是 0 到 100 之间的数字')
  }

  return {
    score: Math.round(score),
  }
}

function optionalText(value: unknown, maxLength: number) {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string') {
    throw new BadRequestException('文本格式不正确')
  }

  const text = value.trim()
  if (text.length > maxLength) {
    throw new BadRequestException(`文本不能超过 ${maxLength} 个字符`)
  }

  return text || undefined
}

function requiredText(value: unknown, label: string, maxLength: number) {
  if (typeof value !== 'string') {
    throw new BadRequestException(`${label}不能为空`)
  }

  const text = value.trim()
  if (!text) {
    throw new BadRequestException(`${label}不能为空`)
  }
  if (text.length > maxLength) {
    throw new BadRequestException(`${label}不能超过 ${maxLength} 个字符`)
  }
  return text
}
