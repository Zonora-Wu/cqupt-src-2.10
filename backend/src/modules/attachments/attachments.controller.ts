import {
  Controller,
  Body,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { MalwareScanInterceptor } from '../../common/security/malware-scan.interceptor'
import { SecurityRateLimitService } from '../../common/security/security-rate-limit.service'
import { CurrentUser } from '../auth/auth.decorators'
import { AuthenticatedRequestUser, ClientRequestMeta } from '../auth/auth.types'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { PermissionsGuard } from '../auth/permissions.guard'
import { AttachmentsService } from './attachments.service'
import { UploadedAttachmentFile, UploadedPdfFile } from './attachment.types'

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
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }), MalwareScanInterceptor)
  async uploadVulnerabilityReportPdf(
    @Param('reportId') reportId: string,
    @UploadedFile() file: UploadedPdfFile | undefined,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: RequestLike,
  ) {
    await this.rateLimit.consume('attachment-upload-user', user.id, 20, 60 * 60_000)
    return this.attachments.uploadVulnerabilityReportPdf(reportId, file, user, getRequestMeta(req))
  }

  @Post('vulnerabilities/drafts/:draftId/attachments')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }), MalwareScanInterceptor)
  async uploadDraftAttachment(
    @Param('draftId') draftId: string,
    @Body('kind') kind: unknown,
    @UploadedFile() file: UploadedAttachmentFile | undefined,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: RequestLike,
  ) {
    await this.rateLimit.consume('draft-attachment-upload-user', user.id, 60, 60 * 60_000)
    return this.attachments.uploadDraftAttachment(draftId, kind, file, user, getRequestMeta(req))
  }

  @Post('vulnerabilities/:reportId/supplements/:supplementId/attachments')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }), MalwareScanInterceptor)
  async uploadSupplementAttachment(
    @Param('reportId') reportId: string,
    @Param('supplementId') supplementId: string,
    @UploadedFile() file: UploadedAttachmentFile | undefined,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: RequestLike,
  ) {
    await this.rateLimit.consume('supplement-attachment-upload-user', user.id, 30, 60 * 60_000)
    return this.attachments.uploadSupplementAttachment(reportId, supplementId, file, user, getRequestMeta(req))
  }

  @Delete('vulnerabilities/drafts/attachments/:attachmentId')
  deleteDraftAttachment(
    @Param('attachmentId') attachmentId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.attachments.deleteDraftAttachment(attachmentId, user)
  }

  @Get('attachments/:attachmentId/content')
  async privateContent(
    @Param('attachmentId') attachmentId: string,
    @Query('thumbnail') thumbnail: string | undefined,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: RequestLike,
    @Res() res: ResponseLike,
  ) {
    const content = await this.attachments.getPrivateContent(attachmentId, thumbnail === 'true', user, getRequestMeta(req))
    res.setHeader('Content-Type', content.contentType)
    res.setHeader('Content-Length', content.body.length)
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(content.fileName)}`)
    res.setHeader('Cache-Control', 'private, max-age=300')
    res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'; img-src 'self'; frame-ancestors 'self'")
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.send(content.body)
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
