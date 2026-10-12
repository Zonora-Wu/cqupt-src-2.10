import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { createChallenge, sha, verifySolution, type Challenge, type Solution } from 'altcha/lib'
import { createHash, randomInt } from 'node:crypto'
import { ClientRequestMeta } from '../auth/auth.types'
import { PrismaService } from '../prisma/prisma.service'
import { HumanVerificationInput, HumanVerificationPurpose } from './human-verification.types'

const CHALLENGE_TTL_SECONDS = 5 * 60
const CONSUMED_NONCE_TTL_MS = 10 * 60 * 1000
const DEFAULT_COST = 1
const DEFAULT_KEY_PREFIX_LENGTH = 3
const PURPOSE_COUNTER_RANGES: Record<HumanVerificationPurpose, readonly [number, number]> = {
  CHANGE_EMAIL_CODE: [3_000, 6_000],
  CHANGE_EMAIL_SUBMIT: [5_000, 9_000],
  CHANGE_PASSWORD: [5_000, 9_000],
  LOGIN_EMAIL_CODE: [2_500, 5_000],
  LOGIN_PASSWORD: [1_200, 3_000],
  REGISTER_EMAIL_CODE: [3_000, 6_000],
  REGISTER_SUBMIT: [4_000, 8_000],
  RESET_PASSWORD: [4_000, 8_000],
}

type AltchaPayload = {
  challenge?: Challenge
  solution?: Solution
  test?: boolean
}

@Injectable()
export class HumanVerificationService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async createChallenge(purpose: HumanVerificationPurpose, meta: ClientRequestMeta) {
    const expiresAt = Math.floor(Date.now() / 1000) + CHALLENGE_TTL_SECONDS
    const [counterMin, counterMax] = PURPOSE_COUNTER_RANGES[purpose]
    const challenge = await createChallenge({
      algorithm: 'SHA-256',
      counter: randomInt(counterMin, counterMax + 1),
      cost: resolveChallengeCost(),
      data: {
        host: normalizeHost(process.env.PUBLIC_SITE_URL ?? process.env.FRONTEND_ORIGIN ?? 'https://test.cquptsrc.asia'),
        ipHash: hashMetaValue(meta.ipAddress),
        purpose,
      },
      deriveKey: sha.deriveKey,
      expiresAt,
      hmacSignatureSecret: getAltchaSecret(),
      keyLength: 32,
      keyPrefixLength: normalizeKeyPrefixLength(process.env.ALTCHA_KEY_PREFIX_LENGTH),
    })

    return {
      challenge,
      expiresIn: CHALLENGE_TTL_SECONDS,
      provider: 'altcha' as const,
      purpose,
    }
  }

  async verify(input: HumanVerificationInput, purpose: HumanVerificationPurpose, meta: ClientRequestMeta) {
    if (input.provider !== 'altcha') {
      throw new UnauthorizedException('人机验证方式无效')
    }

    const decoded = decodeAltchaPayload(input.payload)
    if (decoded.test) {
      throw new UnauthorizedException('测试模式人机验证不可用于当前环境')
    }

    if (!decoded.challenge || !decoded.solution) {
      throw new UnauthorizedException('安全校验结果无效，请重新验证')
    }

    const challengePurpose = decoded.challenge.parameters.data?.purpose
    if (challengePurpose !== purpose) {
      throw new UnauthorizedException('安全校验场景不匹配，请重新验证')
    }

    const expectedHost = normalizeHost(process.env.PUBLIC_SITE_URL ?? process.env.FRONTEND_ORIGIN ?? 'https://test.cquptsrc.asia')
    if (decoded.challenge.parameters.data?.host !== expectedHost) {
      throw new UnauthorizedException('安全校验来源不匹配，请刷新后重试')
    }

    const expectedIpHash = hashMetaValue(meta.ipAddress)
    if (decoded.challenge.parameters.data?.ipHash !== expectedIpHash) {
      throw new UnauthorizedException('安全校验环境变化，请重新验证')
    }

    const result = await verifySolution({
      challenge: decoded.challenge,
      deriveKey: sha.deriveKey,
      hmacSignatureSecret: getAltchaSecret(),
      solution: decoded.solution,
    })

    if (!result.verified) {
      if (result.expired) {
        throw new UnauthorizedException('安全校验已过期，请重新验证')
      }
      throw new UnauthorizedException('安全校验未通过，请重新验证')
    }

    const nonceHash = createHash('sha256').update(decoded.challenge.parameters.nonce).digest('hex')
    try {
      await this.prisma.$transaction([
        this.prisma.humanVerificationNonce.deleteMany({ where: { expiresAt: { lte: new Date() } } }),
        this.prisma.humanVerificationNonce.create({
          data: {
            expiresAt: new Date(Date.now() + CONSUMED_NONCE_TTL_MS),
            nonceHash,
            purpose,
          },
        }),
      ])
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new UnauthorizedException('安全校验已使用，请重新验证')
      }
      throw error
    }
  }
}

function isUniqueConstraintError(error: unknown) {
  if (!error || typeof error !== 'object') return false
  if ('code' in error && error.code === 'P2002') return true
  if ('message' in error && typeof error.message === 'string' && error.message.includes('Unique constraint')) {
    return true
  }
  return false
}

function decodeAltchaPayload(payload: string): AltchaPayload {
  try {
    const decoded = Buffer.from(payload, 'base64').toString('utf8')
    const parsed = JSON.parse(decoded) as unknown
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('payload is not object')
    }
    return parsed as AltchaPayload
  } catch {
    throw new BadRequestException('安全校验结果格式错误')
  }
}

function getAltchaSecret() {
  return process.env.ALTCHA_HMAC_SECRET || process.env.JWT_ACCESS_SECRET || 'development-altcha-secret'
}

function hashMetaValue(value: string | undefined) {
  return createHash('sha256').update(value || 'unknown').digest('hex').slice(0, 24)
}

function resolveChallengeCost() {
  const override = normalizeCost(process.env.ALTCHA_CHALLENGE_COST)
  return override ?? DEFAULT_COST
}

function normalizeCost(value: string | undefined) {
  const cost = Number(value)
  return Number.isInteger(cost) && cost >= 1 && cost <= 64 ? cost : null
}

function normalizeKeyPrefixLength(value: string | undefined) {
  const length = Number(value)
  return Number.isInteger(length) && length >= 3 && length <= 4 ? length : DEFAULT_KEY_PREFIX_LENGTH
}

function normalizeHost(value: string) {
  const first = value.split(',')[0]?.trim() || value
  try {
    return new URL(first).host.toLowerCase()
  } catch {
    return first.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase()
  }
}
