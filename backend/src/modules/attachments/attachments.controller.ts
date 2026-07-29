import {
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { SecurityRateLimitService } from '../../common/security/security-rate-limit.service'
import { CurrentUser } from '../auth/auth.decorators'
import { AuthenticatedRequestUser, ClientRequestMeta } from '../auth/auth.types'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { PermissionsGuard } from '../auth/permissions.guard'
import { AttachmentsService } from './attachments.service'
import { UploadedPdfFile } from './attachment.types'

type RequestLike = {
  ip?: string
  path?: string
  headers?: {
    ['user-agent']?: string
    ['x-forwarded-for']?: string | string[]
  }
}

type ResponseLike = {
  setHeader: (name: string, value: string | number) => void
  send: (body: Buffer) => void
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

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AttachmentsController {
  constructor(
    @Inject(AttachmentsService) private readonly attachments: AttachmentsService,
    @Inject(SecurityRateLimitService) private readonly rateLimit: SecurityRateLimitService,
  ) {}

  @Post('vulnerabilities/:reportId/attachments')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadVulnerabilityReportPdf(
    @Param('reportId') reportId: string,
    @UploadedFile() file: UploadedPdfFile | undefined,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: RequestLike,
  ) {
    await this.rateLimit.consume('attachment-upload-user', user.id, 20, 60 * 60_000)
    return this.attachments.uploadVulnerabilityReportPdf(reportId, file, user, getRequestMeta(req))
  }

  @Get('attachments/:attachmentId/preview')
  async previewPdf(
    @Param('attachmentId') attachmentId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: RequestLike,
    @Res() res: ResponseLike,
  ) {
    const preview = await this.attachments.getPreviewPdf(attachmentId, user, getRequestMeta(req))

    res.setHeader('Content-Type', preview.contentType)
    res.setHeader('Content-Length', preview.body.length)
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(preview.fileName)}`)
    res.setHeader('Cache-Control', 'private, no-store, max-age=0')
    res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'; object-src 'none'; frame-ancestors 'self'")
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.send(preview.body)
  }
}
