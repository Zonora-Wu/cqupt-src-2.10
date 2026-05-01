import { Body, Controller, Get, Inject, Post, Req, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../auth/auth.decorators'
import { AuthenticatedRequestUser, ClientRequestMeta } from '../auth/auth.types'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { AccountService } from './account.service'
import {
  normalizeChangeEmailBody,
  normalizeChangePasswordBody,
  normalizeSendChangeEmailCodeBody,
} from './account.validation'

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

@Controller('account')
@UseGuards(JwtAuthGuard)
export class AccountController {
  constructor(@Inject(AccountService) private readonly account: AccountService) {}

  @Get('profile')
  getProfile(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.account.getProfile(user)
  }

  @Post('password/change')
  changePassword(@Body() body: Record<string, unknown>, @CurrentUser() user: AuthenticatedRequestUser, @Req() req: RequestLike) {
    return this.account.changePassword(user, normalizeChangePasswordBody(body), getRequestMeta(req))
  }

  @Post('email/code')
  sendChangeEmailCode(@Body() body: Record<string, unknown>, @CurrentUser() user: AuthenticatedRequestUser, @Req() req: RequestLike) {
    return this.account.sendChangeEmailCode(user, normalizeSendChangeEmailCodeBody(body), getRequestMeta(req))
  }

  @Post('email/change')
  changeEmail(@Body() body: Record<string, unknown>, @CurrentUser() user: AuthenticatedRequestUser, @Req() req: RequestLike) {
    return this.account.changeEmail(user, normalizeChangeEmailBody(body), getRequestMeta(req))
  }
}
