import { BadRequestException } from '@nestjs/common'

export type NormalizedRegisterInput = {
  code: string
  email: string
  name: string
  password: string
  unifiedCode: string
}

export type NormalizedResetPasswordInput = {
  code: string
  email: string
  newPassword: string
}

export function normalizeRegisterBody(body: Record<string, unknown>): NormalizedRegisterInput {
  const password = requireText(body.password, '密码', 8, 128)

  return {
    code: normalizeEmailCode(body.code),
    email: normalizeEmail(body.email),
    name: requireText(body.name, '姓名', 2, 40),
    password: validatePassword(password),
    unifiedCode: normalizeUnifiedCode(body.unifiedCode),
  }
}

export function normalizeResetPasswordBody(body: Record<string, unknown>): NormalizedResetPasswordInput {
  return {
    code: normalizeEmailCode(body.code),
    email: normalizeEmail(body.email),
    newPassword: validatePassword(requirePassword(body.newPassword, '新密码')),
  }
}

function requirePassword(value: unknown, label: string) {
  if (typeof value !== 'string') throw new BadRequestException(`${label}格式不正确`)
  if (value.length < 8) throw new BadRequestException(`${label}至少需要 8 个字符`)
  if (value.length > 128) throw new BadRequestException(`${label}不能超过 128 个字符`)
  return value
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

export function normalizeUnifiedCode(value: unknown) {
  const code = requireText(value, '统一认证码', 7, 7)
  if (!/^\d{7}$/.test(code)) {
    throw new BadRequestException('统一认证码必须是 7 位数字')
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
