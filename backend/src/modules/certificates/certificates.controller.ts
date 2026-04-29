import { Body, Controller, Get, Inject, Param, Post, Req, Res, UseGuards } from '@nestjs/common'
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators'
import { AuthenticatedRequestUser, ClientRequestMeta } from '../auth/auth.types'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { PermissionsGuard } from '../auth/permissions.guard'
import { CertificatesService } from './certificates.service'
import { IssueCertificateBody, RevokeCertificateBody } from './certificate.types'
import { normalizeIssueCertificateBody, normalizeRevokeCertificateBody } from './certificate.validation'

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

@Controller('certificates')
export class CertificatesController {
  constructor(@Inject(CertificatesService) private readonly certificates: CertificatesService) {}

  @Get('manage')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('vulnerability:manage')
  listManageCertificates() {
    return this.certificates.listManageCertificates()
  }

  @Get('my')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('certificate:read')
  listMyCertificates(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.certificates.listMyCertificates(user)
  }

  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('certificate:issue')
  issueCertificate(
    @Body() body: IssueCertificateBody,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: RequestLike,
  ) {
    const input = normalizeIssueCertificateBody(body)
    return this.certificates.issueCertificate(input, user, getRequestMeta(req))
  }

  @Post(':certificateId/revoke')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('certificate:revoke')
  revokeCertificate(
    @Param('certificateId') certificateId: string,
    @Body() body: RevokeCertificateBody,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: RequestLike,
  ) {
    const input = normalizeRevokeCertificateBody(body)
    return this.certificates.revokeCertificate(certificateId, input, user, getRequestMeta(req))
  }

  @Get(':certificateId/preview')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('certificate:read')
  async previewCertificatePdf(
    @Param('certificateId') certificateId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: RequestLike,
    @Res() res: ResponseLike,
  ) {
    const preview = await this.certificates.previewCertificatePdf(certificateId, user, getRequestMeta(req))

    res.setHeader('Content-Type', preview.contentType)
    res.setHeader('Content-Length', preview.body.length)
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(preview.fileName)}`)
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.send(preview.body)
  }

  @Get('public/:certificateNo')
  publicVerify(@Param('certificateNo') certificateNo: string) {
    return this.certificates.publicVerify(certificateNo)
  }
}
