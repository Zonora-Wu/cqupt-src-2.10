import { Body, Controller, Get, Inject, Post, Req, Res, UseGuards } from '@nestjs/common'
import type { Response } from 'express'
import { SecurityRateLimitService } from '../../common/security/security-rate-limit.service'
import { CurrentUser } from './auth.decorators'
import { JwtAuthGuard } from './jwt-auth.guard'
import { AuthService } from './auth.service'
import { AuthenticatedRequestUser, ClientRequestMeta } from './auth.types'
import { normalizeHumanVerificationInput } from '../human-verification/human-verification.validation'
import { normalizeEmail, normalizeEmailCode, normalizeRegisterBody, normalizeResetPasswordBody, normalizeUnifiedCode } from './auth.validation'

type RequestLike = {
  ip?: string
  path?: string
  headers?: {
    cookie?: string
    ['user-agent']?: string
    ['x-forwarded-for']?: string | string[]
  }
}

type PasswordLoginBody = {
  humanVerification?: unknown
  humanVerificationPayload?: unknown
  humanVerificationProvider?: unknown
  unifiedCode?: unknown
  password?: unknown
}

type EmailCodeLoginBody = {
  email?: unknown
  code?: unknown
}

type SendEmailCodeBody = {
  email?: unknown
  humanVerification?: unknown
  humanVerificationPayload?: unknown
  humanVerificationProvider?: unknown
}

type RegisterBody = Record<string, unknown>

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
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(SecurityRateLimitService) private readonly rateLimit: SecurityRateLimitService,
  ) {}

  @Post('login/password')
  async loginWithPassword(@Body() body: PasswordLoginBody, @Req() req: RequestLike, @Res({ passthrough: true }) res: Response) {
    const meta = getRequestMeta(req)
    const unifiedCode = normalizeUnifiedCode(body.unifiedCode)
    await this.rateLimit.consume('auth-password-ip', meta.ipAddress, 30, 10 * 60_000)
    await this.rateLimit.consume('auth-password-account', unifiedCode, 10, 10 * 60_000)
    const result = await this.auth.loginWithPassword(
      unifiedCode,
      getString(body.password),
      body.humanVerification || body.humanVerificationPayload ? normalizeHumanVerificationInput(body as Record<string, unknown>) : null,
      meta,
    )
    return setRefreshCookie(res, result)
  }

  @Post('login/email-code')
  async loginWithEmailCode(@Body() body: EmailCodeLoginBody, @Req() req: RequestLike, @Res({ passthrough: true }) res: Response) {
    const meta = getRequestMeta(req)
    await this.rateLimit.consume('auth-email-login-ip', meta.ipAddress, 20, 10 * 60_000)
    const result = await this.auth.loginWithEmailCode(normalizeEmail(body.email), normalizeEmailCode(body.code), meta)
    return setRefreshCookie(res, result)
  }

  @Post('email-code')
  async sendEmailLoginCode(@Body() body: SendEmailCodeBody, @Req() req: RequestLike) {
    const meta = getRequestMeta(req)
    await this.rateLimit.consume('auth-email-code-ip', meta.ipAddress, 8, 10 * 60_000)
    return this.auth.sendEmailLoginCode(
      normalizeEmail(body.email),
      normalizeHumanVerificationInput(body as Record<string, unknown>),
      meta,
    )
  }

  @Post('register/email-code')
  async sendRegisterEmailCode(@Body() body: SendEmailCodeBody, @Req() req: RequestLike) {
    const meta = getRequestMeta(req)
    await this.rateLimit.consume('auth-register-code-ip', meta.ipAddress, 8, 10 * 60_000)
    return this.auth.sendRegisterEmailCode(
      normalizeEmail(body.email),
      normalizeHumanVerificationInput(body as Record<string, unknown>),
      meta,
    )
  }

  @Post('password-reset/email-code')
  async sendPasswordResetCode(@Body() body: SendEmailCodeBody, @Req() req: RequestLike) {
    const meta = getRequestMeta(req)
    await this.rateLimit.consume('auth-reset-code-ip', meta.ipAddress, 6, 10 * 60_000)
    return this.auth.sendPasswordResetCode(
      normalizeEmail(body.email),
      normalizeHumanVerificationInput(body as Record<string, unknown>),
      meta,
    )
  }

  @Post('password-reset')
  async resetPassword(@Body() body: RegisterBody, @Req() req: RequestLike) {
    const meta = getRequestMeta(req)
    await this.rateLimit.consume('auth-reset-ip', meta.ipAddress, 10, 10 * 60_000)
    return this.auth.resetPassword(normalizeResetPasswordBody(body), meta)
  }

  @Post('register')
  async register(@Body() body: RegisterBody, @Req() req: RequestLike, @Res({ passthrough: true }) res: Response) {
    const meta = getRequestMeta(req)
    await this.rateLimit.consume('auth-register-ip', meta.ipAddress, 10, 60 * 60_000)
    const result = await this.auth.register(normalizeRegisterBody(body), meta)
    return 'refreshToken' in result ? setRefreshCookie(res, result) : result
  }

  @Post('refresh')
  async refresh(@Req() req: RequestLike, @Res({ passthrough: true }) res: Response) {
    const meta = getRequestMeta(req)
    await this.rateLimit.consume('auth-refresh-ip', meta.ipAddress, 60, 10 * 60_000)
    const result = await this.auth.refreshSession(readCookie(req.headers?.cookie, refreshCookieName()), meta)
    return setRefreshCookie(res, result)
  }

  @Post('logout')
  async logout(@Req() req: RequestLike, @Res({ passthrough: true }) res: Response) {
    await this.auth.logoutSession(readCookie(req.headers?.cookie, refreshCookieName()), getRequestMeta(req))
    clearRefreshCookie(res)
    return { success: true }
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedRequestUser) {
    return user
  }
}

function setRefreshCookie(res: Response, result: { accessToken: string; refreshToken: string; user: unknown }) {
  res.cookie(refreshCookieName(), result.refreshToken, refreshCookieOptions())
  const { refreshToken: _refreshToken, ...response } = result
  return response
}

function clearRefreshCookie(res: Response) {
  const { maxAge: _maxAge, ...options } = refreshCookieOptions()
  res.clearCookie(refreshCookieName(), options)
}

function refreshCookieName() {
  return process.env.REFRESH_TOKEN_COOKIE_NAME?.trim() || 'cqupt_src_refresh'
}

function refreshCookieOptions() {
  const maxAge = parseDurationMilliseconds(process.env.JWT_REFRESH_EXPIRES_IN, 7 * 24 * 60 * 60 * 1000)
  return {
    httpOnly: true,
    maxAge,
    path: `/${process.env.API_PREFIX ?? 'api'}/auth`,
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' as const : 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
  }
}

function readCookie(header: string | undefined, name: string) {
  if (!header) return ''
  for (const part of header.split(';')) {
    const separator = part.indexOf('=')
    if (separator < 0) continue
    if (part.slice(0, separator).trim() === name) return decodeURIComponent(part.slice(separator + 1).trim())
  }
  return ''
}

function parseDurationMilliseconds(value: string | undefined, fallback: number) {
  const match = value?.trim().match(/^(\d+)([smhd])$/)
  if (!match) return fallback
  const amount = Number(match[1])
  const factors = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }
  return amount * factors[match[2] as keyof typeof factors]
}
