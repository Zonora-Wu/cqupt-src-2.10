import { Body, Controller, Get, Inject, Post, Req, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../auth/auth.decorators'
import { AuthenticatedRequestUser, ClientRequestMeta } from '../auth/auth.types'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { PermissionsGuard } from '../auth/permissions.guard'
import { AiChatBody } from './ai.types'
import { AiService } from './ai.service'
import { normalizeAiChatBody } from './ai.validation'

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

@Controller('ai')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AiController {
  constructor(@Inject(AiService) private readonly ai: AiService) {}

  @Get('health')
  health() {
    return this.ai.checkAgentHealth()
  }

  @Get('appearance')
  appearance() {
    return this.ai.getAppearance()
  }

  @Get('quota')
  quota(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.ai.getQuota(user.id)
  }

  @Post('chat')
  chat(@Body() body: AiChatBody, @CurrentUser() user: AuthenticatedRequestUser, @Req() req: RequestLike) {
    const input = normalizeAiChatBody(body)
    return this.ai.chat(input, user, getRequestMeta(req))
  }
}
