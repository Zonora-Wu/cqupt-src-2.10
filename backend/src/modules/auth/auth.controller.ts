import { Body, Controller, Get, Inject, Post, Req, UseGuards } from '@nestjs/common'
import { CurrentUser } from './auth.decorators'
import { JwtAuthGuard } from './jwt-auth.guard'
import { AuthService } from './auth.service'
import { AuthenticatedRequestUser, ClientRequestMeta } from './auth.types'

type RequestLike = {
  ip?: string
  path?: string
  headers?: {
    ['user-agent']?: string
    ['x-forwarded-for']?: string | string[]
  }
}

type PasswordLoginBody = {
  unifiedCode?: unknown
  password?: unknown
}

type EmailCodeLoginBody = {
  email?: unknown
  code?: unknown
}

type SendEmailCodeBody = {
  email?: unknown
}

function getString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function getRequestMeta(req: RequestLike): ClientRequestMeta {
  const forwardedFor = req.headers?.['x-forwarded-for']
  const forwardedIp = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor

  return {
    ipAddress: forwardedIp?.split(',')[0]?.trim() || req.ip,
    userAgent: req.headers?.['user-agent'],
    requestPath: req.path,
  }
}

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Post('login/password')
  loginWithPassword(@Body() body: PasswordLoginBody, @Req() req: RequestLike) {
    return this.auth.loginWithPassword(getString(body.unifiedCode), getString(body.password), getRequestMeta(req))
  }

  @Post('login/email-code')
  loginWithEmailCode(@Body() body: EmailCodeLoginBody, @Req() req: RequestLike) {
    return this.auth.loginWithEmailCode(getString(body.email), getString(body.code), getRequestMeta(req))
  }

  @Post('email-code')
  sendEmailLoginCode(@Body() body: SendEmailCodeBody, @Req() req: RequestLike) {
    return this.auth.sendEmailLoginCode(getString(body.email), getRequestMeta(req))
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedRequestUser) {
    return user
  }
}
