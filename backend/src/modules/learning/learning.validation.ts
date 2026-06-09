import { BadRequestException } from '@nestjs/common'
import { LearningResourceKind } from '@prisma/client'
import { LearningResourceBody, NormalizedLearningResourceInput } from './learning.types'

export function normalizeLearningResourceBody(body: LearningResourceBody): NormalizedLearningResourceInput {
  return {
    active: normalizeBoolean(body.active, true),
    category: requireText(body.category, '资源分类', 2, 40),
    coverUrl: normalizeOptionalUrl(body.coverUrl, '封面图片链接'),
    description: requireText(body.description, '资源说明', 5, 1000),
    externalUrl: normalizeUrl(body.externalUrl),
    kind: normalizeKind(body.kind),
    title: requireText(body.title, '资源标题', 2, 120),
  }
}

function requireText(value: unknown, label: string, minLength: number, maxLength: number) {
  if (typeof value !== 'string') {
    throw new BadRequestException(`${label}格式不正确`)
  }

  const text = value.trim()
  if (text.length < minLength) {
    throw new BadRequestException(`${label}至少需要 ${minLength} 个字符`)
  }

  if (text.length > maxLength) {
    throw new BadRequestException(`${label}不能超过 ${maxLength} 个字符`)
  }

  return text
}

function normalizeBoolean(value: unknown, defaultValue: boolean) {
  if (value === undefined || value === null || value === '') {
    return defaultValue
  }

  if (typeof value !== 'boolean') {
    throw new BadRequestException('上架状态格式不正确')
  }

  return value
}

function normalizeKind(value: unknown) {
  if (typeof value !== 'string') {
    throw new BadRequestException('资源类型格式不正确')
  }

  const normalized = value.trim()
  if (normalized === LearningResourceKind.RESOURCE || normalized === LearningResourceKind.RANGE) {
    return normalized
  }

  if (normalized === '工具资料') return LearningResourceKind.RESOURCE
  if (normalized === '靶场资源') return LearningResourceKind.RANGE

  throw new BadRequestException('资源类型不正确')
}

function normalizeUrl(value: unknown) {
  const url = requireText(value, '外部链接', 8, 1000)

  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('invalid protocol')
    }
    return parsed.toString()
  } catch {
    throw new BadRequestException('外部链接必须是 http:// 或 https:// 开头的有效地址')
  }
}

function normalizeOptionalUrl(value: unknown, label: string) {
  if (value === undefined || value === null || value === '') {
    return ''
  }

  const url = requireText(value, label, 8, 1000)

  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('invalid protocol')
    }
    return parsed.toString()
  } catch {
    throw new BadRequestException(`${label}必须是 http:// 或 https:// 开头的有效地址`)
  }
}
