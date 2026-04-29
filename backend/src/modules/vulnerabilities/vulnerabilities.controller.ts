import { Body, Controller, Inject, Post, Req, UseGuards } from '@nestjs/common'
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { PermissionsGuard } from '../auth/permissions.guard'
import { AuthenticatedRequestUser, ClientRequestMeta } from '../auth/auth.types'
import { normalizeCreateVulnerabilityBody } from './vulnerability.validation'
import { CreateVulnerabilityBody } from './vulnerability.types'
import { VulnerabilitiesService } from './vulnerabilities.service'

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

@Controller('vulnerabilities')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class VulnerabilitiesController {
  constructor(@Inject(VulnerabilitiesService) private readonly vulnerabilities: VulnerabilitiesService) {}

  @Post()
  @RequirePermissions('vulnerability:create')
  createSubmittedReport(
    @Body() body: CreateVulnerabilityBody,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: RequestLike,
  ) {
    const input = normalizeCreateVulnerabilityBody(body)
    return this.vulnerabilities.createSubmittedReport(user, input, getRequestMeta(req))
  }
}
