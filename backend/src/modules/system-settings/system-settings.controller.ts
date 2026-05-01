import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators'
import { AuthenticatedRequestUser, ClientRequestMeta } from '../auth/auth.types'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { PermissionsGuard } from '../auth/permissions.guard'
import { SystemSettingsService } from './system-settings.service'
import { UploadedSettingsFile } from './system-settings.types'

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
    userAgent: req.headers?.['user-agent'],
    requestPath: req.path,
  }
}

@Controller('system-settings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SystemSettingsController {
  constructor(@Inject(SystemSettingsService) private readonly settings: SystemSettingsService) {}

  @Get('certificate-template/active')
  @RequirePermissions('system:manage')
  getActiveCertificateTemplate() {
    return this.settings.getActiveCertificateTemplate()
  }

  @Post('certificate-template/background')
  @RequirePermissions('system:manage')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  uploadCertificateTemplateBackground(
    @UploadedFile() file: UploadedSettingsFile | undefined,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: RequestLike,
  ) {
    return this.settings.uploadCertificateTemplateBackground(file, user, getRequestMeta(req))
  }

  @Post('certificate-template/seal')
  @RequirePermissions('system:manage')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  uploadCertificateSeal(
    @UploadedFile() file: UploadedSettingsFile | undefined,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: RequestLike,
  ) {
    return this.settings.uploadCertificateSeal(file, user, getRequestMeta(req))
  }

  @Get('registration-mode')
  getRegistrationMode() {
    return this.settings.getRegistrationMode()
  }

  @Post('registration-mode')
  @RequirePermissions('system:manage')
  setRegistrationMode(
    @Body() body: { open?: unknown },
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: RequestLike,
  ) {
    const open = body.open === true || body.open === 'true'
    return this.settings.setRegistrationMode(open, user, getRequestMeta(req))
  }

  @Get('pending-registrations')
  @RequirePermissions('system:manage')
  listPendingRegistrations() {
    return this.settings.listPendingRegistrations()
  }

  @Post('pending-registrations/:id/approve')
  @RequirePermissions('system:manage')
  approveRegistration(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: RequestLike,
  ) {
    return this.settings.approveRegistration(id, user, getRequestMeta(req))
  }

  @Post('pending-registrations/:id/reject')
  @RequirePermissions('system:manage')
  rejectRegistration(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: RequestLike,
  ) {
    return this.settings.rejectRegistration(id, user, getRequestMeta(req))
  }
}
