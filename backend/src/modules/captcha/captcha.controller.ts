import { Body, Controller, Inject, Post, Req } from '@nestjs/common'
import { ClientRequestMeta } from '../auth/auth.types'
import { CaptchaService } from './captcha.service'
import { CaptchaChallengeBody, CaptchaVerifyBody } from './captcha.types'
import { normalizeCaptchaChallengeBody, normalizeCaptchaVerifyBody } from './captcha.validation'

type RequestLike = {
  ip?: string
  path?: string
  headers?: {
    ['user-agent']?: string
    ['x-forwarded-for']?: string | string[]
  }
}

function getRequestMeta(req: RequestLike): ClientRequestMeta {
  const forwardedFor = req.headers?.['x-forwarded-for']
  const forwardedIp = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor

  return {
    ipAddress: forwardedIp?.split(',')[0]?.trim() || req.ip,
    requestPath: req.path,
    userAgent: req.headers?.['user-agent'],
  }
}

@Controller('captcha/slider')
export class CaptchaController {
  constructor(@Inject(CaptchaService) private readonly captcha: CaptchaService) {}

  @Post('challenge')
  createChallenge(@Body() body: CaptchaChallengeBody, @Req() req: RequestLike) {
    return this.captcha.createSliderChallenge(normalizeCaptchaChallengeBody(body), getRequestMeta(req))
  }

  @Post('verify')
  verifyChallenge(@Body() body: CaptchaVerifyBody, @Req() req: RequestLike) {
    return this.captcha.verifySliderChallenge(normalizeCaptchaVerifyBody(body), getRequestMeta(req))
  }
}
