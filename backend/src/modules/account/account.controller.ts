import { BadRequestException, Body, Controller, Get, Inject, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { MalwareScanInterceptor } from '../../common/security/malware-scan.interceptor'
import { CurrentUser } from '../auth/auth.decorators'
import { AuthenticatedRequestUser, ClientRequestMeta } from '../auth/auth.types'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { AccountService } from './account.service'
import {
  normalizeChangeEmailBody,
  normalizeChangePasswordBody,
  normalizeChangePasswordWithOldBody,
  normalizeSendCurrentEmailCodeBody,
  normalizeUpdateProfileBasicsBody,
} from './account.validation'

type UploadedImageFile = {
  buffer?: Buffer
  mimetype?: string
  originalname?: string
  size?: number
}

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

  @Post('profile/basics')
  updateProfileBasics(@Body() body: Record<string, unknown>, @CurrentUser() user: AuthenticatedRequestUser, @Req() req: RequestLike) {
    return this.account.updateProfileBasics(user, normalizeUpdateProfileBasicsBody(body), getRequestMeta(req))
  }

  @Post('password/change')
  changePassword(@Body() body: Record<string, unknown>, @CurrentUser() user: AuthenticatedRequestUser, @Req() req: RequestLike) {
    return this.account.changePassword(user, normalizeChangePasswordBody(body), getRequestMeta(req))
  }

  @Post('password/change-with-old')
  changePasswordWithOld(@Body() body: Record<string, unknown>, @CurrentUser() user: AuthenticatedRequestUser, @Req() req: RequestLike) {
    return this.account.changePasswordWithOld(user, normalizeChangePasswordWithOldBody(body), getRequestMeta(req))
  }

  @Post('email/identity-code')
  sendCurrentEmailCode(@Body() body: Record<string, unknown>, @CurrentUser() user: AuthenticatedRequestUser, @Req() req: RequestLike) {
    return this.account.sendCurrentEmailCode(user, normalizeSendCurrentEmailCodeBody(body), getRequestMeta(req))
  }

  @Post('email/change')
  changeEmail(@Body() body: Record<string, unknown>, @CurrentUser() user: AuthenticatedRequestUser, @Req() req: RequestLike) {
    return this.account.changeEmail(user, normalizeChangeEmailBody(body), getRequestMeta(req))
  }

  @Get('audit-logs')
  getMyAuditLogs(@CurrentUser() user: AuthenticatedRequestUser, @Query() query: Record<string, unknown>) {
    return this.account.getMyAuditLogs(user.id, query)
  }

  @Post('avatar')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 }, storage: undefined }), MalwareScanInterceptor)
  uploadAvatar(
    @UploadedFile() file: UploadedImageFile | undefined,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    if (!file) throw new BadRequestException('请选择图片文件')
    return this.account.uploadAvatar(user.id, file)
  }
}
