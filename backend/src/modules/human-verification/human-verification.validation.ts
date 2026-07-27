import { BadRequestException } from '@nestjs/common'
import { HumanVerificationInput, HumanVerificationPurpose } from './human-verification.types'

const purposes = new Set<HumanVerificationPurpose>([
  'LOGIN_PASSWORD',
  'LOGIN_EMAIL_CODE',
  'REGISTER_EMAIL_CODE',
  'REGISTER_SUBMIT',
  'RESET_PASSWORD',
  'CHANGE_PASSWORD',
  'CHANGE_EMAIL_CODE',
  'CHANGE_EMAIL_SUBMIT',
])

export function normalizeHumanVerificationPurpose(value: unknown): HumanVerificationPurpose {
  if (typeof value !== 'string' || !purposes.has(value as HumanVerificationPurpose)) {
    throw new BadRequestException('人机验证场景无效')
  }

  return value as HumanVerificationPurpose
}

export function normalizeHumanVerificationInput(body: Record<string, unknown>): HumanVerificationInput {
  const directProvider = body.humanVerificationProvider
  const directPayload = body.humanVerificationPayload
  const nested = body.humanVerification

  const provider = typeof directProvider === 'string'
    ? directProvider
    : isRecord(nested) && typeof nested.provider === 'string'
      ? nested.provider
      : ''
  const payload = typeof directPayload === 'string'
    ? directPayload
    : isRecord(nested) && typeof nested.payload === 'string'
      ? nested.payload
      : ''

  if (provider !== 'altcha') {
    throw new BadRequestException('请先完成安全校验')
  }

  if (!payload || payload.length > 20_000) {
    throw new BadRequestException('安全校验结果无效')
  }

  return { payload, provider }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
