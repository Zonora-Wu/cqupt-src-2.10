import { BadRequestException, HttpException, HttpStatus, Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { randomBytes, createHash } from 'node:crypto'
import { ClientRequestMeta } from '../auth/auth.types'
import { PrismaService } from '../prisma/prisma.service'
import { CaptchaPurpose, CaptchaTrackPoint, NormalizedCaptchaChallengeInput, NormalizedCaptchaVerifyInput } from './captcha.types'

const CHALLENGE_TTL_MS = 2 * 60 * 1000
const TOKEN_TTL_MS = 5 * 60 * 1000
const MAX_ATTEMPTS_PER_CHALLENGE = 5
const MAX_IP_FAILURES = 20
const RATIO_TOLERANCE = 0.035

@Injectable()
export class CaptchaService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async createSliderChallenge(input: NormalizedCaptchaChallengeInput, meta: ClientRequestMeta) {
    await this.cleanupExpiredCaptchaData()
    await this.assertIpIsNotCoolingDown(meta.ipAddress)

    const answerRatio = randomRatio(0.62, 0.88)
    const challenge = await this.prisma.captchaChallenge.create({
      data: {
        answerRatio,
        expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
        ipAddress: meta.ipAddress,
        purpose: input.purpose,
        userAgent: meta.userAgent,
      },
    })

    return {
      answerHintRatio: answerRatio,
      challengeId: challenge.id,
      expiresIn: Math.floor(CHALLENGE_TTL_MS / 1000),
      purpose: input.purpose,
    }
  }

  async verifySliderChallenge(input: NormalizedCaptchaVerifyInput, meta: ClientRequestMeta) {
    const challenge = await this.prisma.captchaChallenge.findUnique({
      where: { id: input.challengeId },
    })

    if (!challenge || challenge.purpose !== input.purpose) {
      throw new UnauthorizedException('滑块验证已失效，请刷新后重试')
    }

    if (challenge.expiresAt <= new Date() || challenge.verifiedAt) {
      throw new UnauthorizedException('滑块验证已过期，请重新验证')
    }

    if (challenge.attempts >= MAX_ATTEMPTS_PER_CHALLENGE) {
      throwTooManyRequests('滑块验证尝试次数过多，请刷新后重试')
    }

    await this.prisma.captchaChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    })

    const verdict = judgeTrack(input.track, input.offsetRatio, challenge.answerRatio)
    if (!verdict.ok) {
      throw new BadRequestException(verdict.reason)
    }

    const rawToken = `captcha_${randomBytes(32).toString('base64url')}`
    const tokenHash = hashToken(rawToken)
    await this.prisma.$transaction([
      this.prisma.captchaChallenge.update({
        where: { id: challenge.id },
        data: { verifiedAt: new Date() },
      }),
      this.prisma.captchaToken.create({
        data: {
          challengeId: challenge.id,
          expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
          ipAddress: meta.ipAddress,
          purpose: input.purpose,
          tokenHash,
          userAgent: meta.userAgent,
        },
      }),
    ])

    return {
      captchaToken: rawToken,
      expiresIn: Math.floor(TOKEN_TTL_MS / 1000),
    }
  }

  async consumeCaptchaToken(token: string, purpose: CaptchaPurpose, meta: ClientRequestMeta) {
    const tokenHash = hashToken(token)
    const captchaToken = await this.prisma.captchaToken.findUnique({
      where: { tokenHash },
    })

    if (
      !captchaToken ||
      captchaToken.purpose !== purpose ||
      captchaToken.consumedAt ||
      captchaToken.expiresAt <= new Date()
    ) {
      throw new UnauthorizedException('滑块验证已失效，请重新完成验证')
    }

    if (captchaToken.ipAddress && meta.ipAddress && captchaToken.ipAddress !== meta.ipAddress) {
      throw new UnauthorizedException('滑块验证环境变化，请重新验证')
    }

    await this.prisma.captchaToken.update({
      where: { id: captchaToken.id },
      data: { consumedAt: new Date() },
    })
  }

  private async assertIpIsNotCoolingDown(ipAddress?: string) {
    if (!ipAddress) return
    const since = new Date(Date.now() - 10 * 60 * 1000)
    const failures = await this.prisma.captchaChallenge.count({
      where: {
        attempts: { gte: MAX_ATTEMPTS_PER_CHALLENGE },
        createdAt: { gte: since },
        ipAddress,
      },
    })

    if (failures >= MAX_IP_FAILURES) {
      throwTooManyRequests('滑块验证失败过多，请稍后再试')
    }
  }

  private async cleanupExpiredCaptchaData() {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
    await this.prisma.captchaChallenge.deleteMany({
      where: {
        expiresAt: { lt: cutoff },
      },
    })
  }
}

function judgeTrack(track: CaptchaTrackPoint[], offsetRatio: number, answerRatio: number) {
  const duration = track[track.length - 1].t - track[0].t
  if (duration < 500) return { ok: false, reason: '滑动过快，请重新验证' }
  if (duration > 8000) return { ok: false, reason: '滑动超时，请重新验证' }
  if (Math.abs(offsetRatio - answerRatio) > RATIO_TOLERANCE) {
    return { ok: false, reason: '滑块位置不正确，请重试' }
  }

  const xs = track.map((point) => point.x)
  const ys = track.map((point) => point.y)
  const maxX = Math.max(...xs)
  const minX = Math.min(...xs)
  if (maxX - minX < 0.45) {
    return { ok: false, reason: '滑动轨迹异常，请重试' }
  }

  const uniqueDeltas = new Set<string>()
  let backwards = 0
  for (let index = 1; index < xs.length; index += 1) {
    const delta = xs[index] - xs[index - 1]
    if (delta < -0.006) backwards += 1
    uniqueDeltas.add(delta.toFixed(3))
  }

  if (uniqueDeltas.size < 5) {
    return { ok: false, reason: '滑动轨迹过于机械，请重试' }
  }

  const yRange = Math.max(...ys) - Math.min(...ys)
  if (yRange > 0.45) {
    return { ok: false, reason: '滑动轨迹异常，请重试' }
  }

  if (backwards > Math.max(8, track.length * 0.35)) {
    return { ok: false, reason: '滑动轨迹异常，请重试' }
  }

  return { ok: true, reason: '' }
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

function randomRatio(min: number, max: number) {
  return Number((min + Math.random() * (max - min)).toFixed(4))
}

function throwTooManyRequests(message: string): never {
  throw new HttpException(message, HttpStatus.TOO_MANY_REQUESTS)
}
