import { BadRequestException } from '@nestjs/common'
import { AnnouncementRange } from '@prisma/client'
import { AnnouncementBody, NormalizedAnnouncementInput } from './announcement.types'

const rangeMap: Record<string, AnnouncementRange> = {
  ADMINS: AnnouncementRange.ADMINS,
  ALL: AnnouncementRange.ALL,
  AUDITORS: AnnouncementRange.AUDITORS,
  STUDENTS: AnnouncementRange.STUDENTS,
  全体用户: AnnouncementRange.ALL,
  学生用户: AnnouncementRange.STUDENTS,
  审核员: AnnouncementRange.AUDITORS,
  管理员: AnnouncementRange.ADMINS,
}

export function normalizeAnnouncementBody(body: AnnouncementBody): NormalizedAnnouncementInput {
  return {
    category: requireText(body.category, '公告分类', 2, 40),
    content: requireText(body.content, '公告正文', 5, 20000),
    pinned: normalizeBoolean(body.pinned, false),
    range: normalizeRange(body.range),
    summary: requireText(body.summary, '公告摘要', 5, 500),
    title: requireText(body.title, '公告标题', 4, 120),
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
    throw new BadRequestException('置顶状态格式不正确')
  }

  return value
}

function normalizeRange(value: unknown) {
  if (typeof value !== 'string') {
    throw new BadRequestException('发布范围格式不正确')
  }

  const range = rangeMap[value.trim()]
  if (!range) {
    throw new BadRequestException('发布范围不正确')
  }

  return range
}

