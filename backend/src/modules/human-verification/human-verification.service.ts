import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common'
import { createChallenge, sha, verifySolution, type Challenge, type Solution } from 'altcha/lib'
import { createHash } from 'node:crypto'
import { ClientRequestMeta } from '../auth/auth.types'
import { HumanVerificationInput, HumanVerificationPurpose } from './human-verification.types'

const CHALLENGE_TTL_SECONDS = 2 * 60
const CONSUMED_NONCE_TTL_MS = 10 * 60 * 1000
const DEFAULT_COST = 48_000

type AltchaPayload = {
  challenge?: Challenge
  solution?: Solution
  test?: boolean
}

@Injectable()
export class HumanVerificationService {
  private readonly consumedNonces = new Map<string, number>()

  async createChallenge(purpose: HumanVerificationPurpose, meta: ClientRequestMeta) {
    const expiresAt = Math.floor(Date.now() / 1000) + CHALLENGE_TTL_SECONDS
    const challenge = await createChallenge({
      algorithm: 'SHA-256',
      cost: normalizeCost(process.env.ALTCHA_CHALLENGE_COST),
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

    this.assertNonceNotConsumed(decoded.challenge.parameters.nonce)

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

    this.markNonceConsumed(decoded.challenge.parameters.nonce)
  }

  private assertNonceNotConsumed(nonce: string) {
    this.cleanupConsumedNonces()
    const consumedAt = this.consumedNonces.get(nonce)
    if (consumedAt && Date.now() - consumedAt < CONSUMED_NONCE_TTL_MS) {
      throw new UnauthorizedException('安全校验已使用，请重新验证')
    }
  }

  private markNonceConsumed(nonce: string) {
    this.consumedNonces.set(nonce, Date.now())
  }

  private cleanupConsumedNonces() {
    const cutoff = Date.now() - CONSUMED_NONCE_TTL_MS
    for (const [nonce, consumedAt] of this.consumedNonces) {
      if (consumedAt < cutoff) {
        this.consumedNonces.delete(nonce)
      }
    }
  }
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

function normalizeCost(value: string | undefined) {
  const cost = Number(value)
  return Number.isInteger(cost) && cost >= 10_000 && cost <= 500_000 ? cost : DEFAULT_COST
}

function normalizeKeyPrefixLength(value: string | undefined) {
  const length = Number(value)
  return Number.isInteger(length) && length >= 1 && length <= 4 ? length : 2
}

function normalizeHost(value: string) {
  const first = value.split(',')[0]?.trim() || value
  try {
    return new URL(first).host.toLowerCase()
  } catch {
    return first.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase()
  }
}
