import { BadRequestException } from '@nestjs/common'
import { ChangeEmailInput, ChangePasswordInput, SendChangeEmailCodeInput, SendCurrentEmailCodeInput } from './account.types'

export function normalizeChangePasswordBody(body: Record<string, unknown>): ChangePasswordInput {
  const code = normalizeEmailCode(body.code)
  const newPassword = validatePassword(requireText(body.newPassword, '新密码', 8, 128))

  return { code, newPassword }
}

export function normalizeSendCurrentEmailCodeBody(body: Record<string, unknown>): SendCurrentEmailCodeInput {
  const purpose = body.purpose
  if (purpose !== 'CHANGE_EMAIL' && purpose !== 'CHANGE_PASSWORD') {
    throw new BadRequestException('purpose 参数无效')
  }
  return { purpose }
}

export function normalizeSendChangeEmailCodeBody(body: Record<string, unknown>): SendChangeEmailCodeInput {
  return {
    newEmail: normalizeEmail(body.newEmail),
  }
}

export function normalizeChangeEmailBody(body: Record<string, unknown>): ChangeEmailInput {
  return {
    code: normalizeEmailCode(body.code),
    newEmail: normalizeEmail(body.newEmail),
  }
}

function normalizeEmail(value: unknown) {
  const email = requireText(value, '新邮箱', 6, 120).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new BadRequestException('邮箱格式不正确')
  }

  return email
}

function normalizeEmailCode(value: unknown) {
  const code = requireText(value, '邮箱验证码', 6, 6)
  if (!/^\d{6}$/.test(code)) {
    throw new BadRequestException('邮箱验证码必须是 6 位数字')
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
    throw new BadRequestException('新密码需包含字母、数字、符号中至少两类')
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
