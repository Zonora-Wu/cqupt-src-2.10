import { Body, Controller, Get, Inject, Post, Query, Req } from '@nestjs/common'
import { ClientRequestMeta } from '../auth/auth.types'
import { HumanVerificationService } from './human-verification.service'
import { normalizeHumanVerificationPurpose } from './human-verification.validation'

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

@Controller('human-verification')
export class HumanVerificationController {
  constructor(@Inject(HumanVerificationService) private readonly humanVerification: HumanVerificationService) {}

  @Post('challenge')
  createChallenge(@Body() body: Record<string, unknown>, @Req() req: RequestLike) {
    return this.humanVerification.createChallenge(normalizeHumanVerificationPurpose(body.purpose), getRequestMeta(req))
  }

  @Get('challenge')
  async getChallenge(@Query() query: Record<string, unknown>, @Req() req: RequestLike) {
    const result = await this.humanVerification.createChallenge(normalizeHumanVerificationPurpose(query.purpose), getRequestMeta(req))
    return result.challenge
  }
}
