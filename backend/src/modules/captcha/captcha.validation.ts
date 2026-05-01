import { BadRequestException } from '@nestjs/common'
import {
  CaptchaChallengeBody,
  CaptchaPurpose,
  CaptchaTrackPoint,
  CaptchaVerifyBody,
  NormalizedCaptchaChallengeInput,
  NormalizedCaptchaVerifyInput,
} from './captcha.types'

const purposeAliases: Record<string, CaptchaPurpose> = {
  LOGIN_EMAIL_CODE: 'LOGIN_EMAIL_CODE',
  REGISTER_EMAIL_CODE: 'REGISTER_EMAIL_CODE',
  登录邮箱验证码: 'LOGIN_EMAIL_CODE',
  注册邮箱验证码: 'REGISTER_EMAIL_CODE',
}

export function normalizeCaptchaChallengeBody(body: CaptchaChallengeBody): NormalizedCaptchaChallengeInput {
  return {
    purpose: normalizePurpose(body.purpose),
  }
}

export function normalizeCaptchaVerifyBody(body: CaptchaVerifyBody): NormalizedCaptchaVerifyInput {
  return {
    challengeId: requireText(body.challengeId, '挑战 ID', 5, 120),
    offsetRatio: normalizeRatio(body.offsetRatio),
    purpose: normalizePurpose(body.purpose),
    track: normalizeTrack(body.track),
  }
}

export function normalizeCaptchaToken(value: unknown) {
  return requireText(value, '滑块验证票据', 20, 240)
}

function normalizePurpose(value: unknown): CaptchaPurpose {
  if (value === undefined || value === null || value === '') return 'REGISTER_EMAIL_CODE'
  const text = requireText(value, '验证用途', 2, 60)
  const purpose = purposeAliases[text]
  if (!purpose) {
    throw new BadRequestException('验证用途不正确')
  }

  return purpose
}

function normalizeRatio(value: unknown) {
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number) || number < 0 || number > 1) {
    throw new BadRequestException('滑动位置格式不正确')
  }

  return number
}

function normalizeTrack(value: unknown): CaptchaTrackPoint[] {
  if (!Array.isArray(value) || value.length < 8 || value.length > 240) {
    throw new BadRequestException('滑动轨迹不完整')
  }

  return value.map((item) => {
    if (!item || typeof item !== 'object') {
      throw new BadRequestException('滑动轨迹格式不正确')
    }

    const point = item as Record<string, unknown>
    return {
      x: normalizePointNumber(point.x, '轨迹 x'),
      y: normalizePointNumber(point.y, '轨迹 y'),
      t: normalizePointNumber(point.t, '轨迹时间'),
    }
  })
}

function normalizePointNumber(value: unknown, label: string) {
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number)) {
    throw new BadRequestException(`${label}格式不正确`)
  }

  return number
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
