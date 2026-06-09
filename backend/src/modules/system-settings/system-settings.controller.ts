import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { Response } from 'express'
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

  @Put('certificate-template/layout')
  @RequirePermissions('system:manage')
  updateCertificateTemplateLayout(
    @Body() body: { layoutJson?: unknown },
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: RequestLike,
  ) {
    return this.settings.updateCertificateTemplateLayout(body.layoutJson, user, getRequestMeta(req))
  }

  @Get('certificate-template/background-preview')
  @RequirePermissions('system:manage')
  async previewCertificateTemplateBackground(@Res() res: Response) {
    const preview = await this.settings.previewCertificateTemplateBackground()
    res.setHeader('Content-Type', preview.contentType)
    res.setHeader('Content-Length', preview.body.length)
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(preview.fileName)}`)
    res.setHeader('X-Certificate-Page-Width', String(preview.width))
    res.setHeader('X-Certificate-Page-Height', String(preview.height))
    res.setHeader('Access-Control-Expose-Headers', 'X-Certificate-Page-Width, X-Certificate-Page-Height, X-Certificate-Seal-Width, X-Certificate-Seal-Height')
    res.send(preview.body)
  }

  @Get('certificate-template/seal-preview')
  @RequirePermissions('system:manage')
  async previewCertificateSeal(@Res() res: Response) {
    const preview = await this.settings.previewCertificateSeal()
    res.setHeader('Content-Type', preview.contentType)
    res.setHeader('Content-Length', preview.body.length)
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(preview.fileName)}`)
    res.setHeader('X-Certificate-Seal-Width', String(preview.width))
    res.setHeader('X-Certificate-Seal-Height', String(preview.height))
    res.setHeader('Access-Control-Expose-Headers', 'X-Certificate-Page-Width, X-Certificate-Page-Height, X-Certificate-Seal-Width, X-Certificate-Seal-Height')
    res.send(preview.body)
  }

  @Post('certificate-template/preview')
  @RequirePermissions('system:manage')
  async previewCertificateTemplate(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: RequestLike,
    @Res() res: Response,
  ) {
    const preview = await this.settings.previewCertificateTemplate(user, getRequestMeta(req))
    res.setHeader('Content-Type', preview.contentType)
    res.setHeader('Content-Length', preview.body.length)
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(preview.fileName)}`)
    res.send(preview.body)
  }

  @Post('certificate-template/layout-preview')
  @RequirePermissions('system:manage')
  async previewCertificateTemplateLayout(
    @Body() body: { layoutJson?: unknown },
    @Res() res: Response,
  ) {
    const preview = await this.settings.previewCertificateTemplateLayout(body.layoutJson)
    res.setHeader('Content-Type', preview.contentType)
    res.setHeader('Content-Length', preview.body.length)
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(preview.fileName)}`)
    res.send(preview.body)
  }

  @Get('platform')
  @RequirePermissions('system:manage')
  getPlatformSettings() {
    return this.settings.getPlatformSettings()
  }

  @Get('ai-appearance')
  @RequirePermissions('system:manage')
  getAiAssistantAppearance() {
    return this.settings.getAiAssistantAppearance()
  }

  @Post('ai-appearance/avatar')
  @RequirePermissions('system:manage')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  uploadAiAssistantAvatar(
    @UploadedFile() file: UploadedSettingsFile | undefined,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: RequestLike,
  ) {
    return this.settings.uploadAiAssistantAvatar(file, user, getRequestMeta(req))
  }

  @Get('ai-quota')
  @RequirePermissions('system:manage')
  getAiQuotaSettings() {
    return this.settings.getAiQuotaSettings()
  }

  @Post('ai-quota')
  @RequirePermissions('system:manage')
  updateAiQuotaSettings(
    @Body() body: { defaultDailyTokens?: unknown; defaultMonthlyTokens?: unknown; defaultWeeklyTokens?: unknown; quotaPeriod?: unknown },
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: RequestLike,
  ) {
    return this.settings.updateAiQuotaSettings(
      {
        defaultDailyTokens: body.defaultDailyTokens as number,
        defaultMonthlyTokens: body.defaultMonthlyTokens as number,
        defaultWeeklyTokens: body.defaultWeeklyTokens as number,
        quotaPeriod: body.quotaPeriod as 'DAY' | 'WEEK' | 'MONTH',
      },
      user,
      getRequestMeta(req),
    )
  }

  @Get('ai-knowledge-usage')
  @RequirePermissions('system:manage')
  getAiKnowledgeUsagePolicySettings() {
    return this.settings.getAiKnowledgeUsagePolicySettings()
  }

  @Post('ai-knowledge-usage')
  @RequirePermissions('system:manage')
  updateAiKnowledgeUsagePolicySettings(
    @Body() body: {
      agentInjectEnabled?: unknown
      allowAttachmentKnowledgeInjection?: unknown
      auditCandidateHits?: unknown
      changeReason?: unknown
      directAnswerEnabled?: unknown
      directThresholdOverride?: unknown
      directTopKOverride?: unknown
      injectThresholdOverride?: unknown
      injectTopKOverride?: unknown
      knowledgeUsageStrength?: unknown
      requireSourceBadge?: unknown
      retrievalEnabled?: unknown
    },
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: RequestLike,
  ) {
    return this.settings.updateAiKnowledgeUsagePolicySettings(
      {
        agentInjectEnabled: body.agentInjectEnabled as boolean,
        allowAttachmentKnowledgeInjection: body.allowAttachmentKnowledgeInjection as boolean,
        auditCandidateHits: body.auditCandidateHits as boolean,
        changeReason: body.changeReason as string,
        directAnswerEnabled: body.directAnswerEnabled as boolean,
        directThresholdOverride: body.directThresholdOverride as number,
        directTopKOverride: body.directTopKOverride as number,
        injectThresholdOverride: body.injectThresholdOverride as number,
        injectTopKOverride: body.injectTopKOverride as number,
        knowledgeUsageStrength: body.knowledgeUsageStrength as number,
        requireSourceBadge: body.requireSourceBadge as boolean,
        retrievalEnabled: body.retrievalEnabled as boolean,
      },
      user,
      getRequestMeta(req),
    )
  }

  @Post('platform')
  @RequirePermissions('system:manage')
  updatePlatformSettings(
    @Body() body: { platformName?: unknown; schoolName?: unknown; orgName?: unknown; platformDomain?: unknown; publicCertVerify?: unknown },
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: RequestLike,
  ) {
    return this.settings.updatePlatformSettings(
      {
        platformName: typeof body.platformName === 'string' ? body.platformName : undefined,
        schoolName: typeof body.schoolName === 'string' ? body.schoolName : undefined,
        orgName: typeof body.orgName === 'string' ? body.orgName : undefined,
        platformDomain: typeof body.platformDomain === 'string' ? body.platformDomain : undefined,
        publicCertVerify: body.publicCertVerify !== undefined ? body.publicCertVerify === true || body.publicCertVerify === 'true' : undefined,
      },
      user,
      getRequestMeta(req),
    )
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
