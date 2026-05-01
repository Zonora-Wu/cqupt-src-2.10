import { BadRequestException } from '@nestjs/common'

export type NormalizedRegisterInput = {
  code: string
  college: string
  email: string
  grade: string
  identityText: string
  name: string
  password: string
  studentNo: string
  unifiedCode: string
}

export function normalizeRegisterBody(body: Record<string, unknown>): NormalizedRegisterInput {
  const password = requireText(body.password, '密码', 8, 128)

  return {
    code: normalizeEmailCode(body.code),
    college: requireText(body.college, '学院', 2, 80),
    email: normalizeEmail(body.email),
    grade: optionalText(body.grade, 20),
    identityText: requireText(body.identityText, '身份', 2, 40),
    name: requireText(body.name, '姓名', 2, 40),
    password: validatePassword(password),
    studentNo: optionalText(body.studentNo, 40),
    unifiedCode: normalizeUnifiedCode(body.unifiedCode),
  }
}

export function normalizeEmail(value: unknown) {
  const email = requireText(value, '邮箱', 6, 120).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new BadRequestException('邮箱格式不正确')
  }

  return email
}

export function normalizeEmailCode(value: unknown) {
  const code = requireText(value, '邮箱验证码', 6, 6)
  if (!/^\d{6}$/.test(code)) {
    throw new BadRequestException('邮箱验证码必须是 6 位数字')
  }

  return code
}

function normalizeUnifiedCode(value: unknown) {
  const code = requireText(value, '统一认证码', 4, 32)
  if (!/^[A-Za-z0-9_-]+$/.test(code)) {
    throw new BadRequestException('统一认证码只能包含字母、数字、下划线或短横线')
  }

  return code
}

function validatePassword(password: string) {
  const categories = [
    /[A-Za-z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length

  if (categories < 2) {
    throw new BadRequestException('密码需包含字母、数字、符号中至少两类')
  }

  return password
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

function optionalText(value: unknown, maxLength: number) {
  if (value === undefined || value === null || value === '') return ''
  if (typeof value !== 'string') {
    throw new BadRequestException('文本格式不正确')
  }

  const text = value.trim()
  if (text.length > maxLength) {
    throw new BadRequestException(`文本不能超过 ${maxLength} 个字符`)
  }

  return text
}
