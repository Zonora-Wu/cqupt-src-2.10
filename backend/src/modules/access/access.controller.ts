import { Body, Controller, Get, Inject, Post, Req, UseGuards } from '@nestjs/common'
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators'
import { AuthenticatedRequestUser, ClientRequestMeta } from '../auth/auth.types'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { PermissionsGuard } from '../auth/permissions.guard'
import { AccessPolicyService } from './access-policy.service'
import {
  normalizeSignResponsibilityAgreementBody,
  normalizePublishResponsibilityAgreementBody,
  normalizeSubmitSecurityExamBody,
} from './access.validation'

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

@Controller('access')
@UseGuards(JwtAuthGuard)
export class AccessController {
  constructor(@Inject(AccessPolicyService) private readonly accessPolicy: AccessPolicyService) {}

  @Get('status')
  getStatus(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.accessPolicy.getAccessStatus(user)
  }

  @Get('responsibility-agreement/current')
  getCurrentResponsibilityAgreement() {
    return this.accessPolicy.getCurrentResponsibilityAgreement()
  }

  @Post('responsibility-agreement/sign')
  signCurrentResponsibilityAgreement(
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: RequestLike,
  ) {
    return this.accessPolicy.signCurrentResponsibilityAgreement(
      user,
      normalizeSignResponsibilityAgreementBody(body),
      getRequestMeta(req),
    )
  }

  @Get('responsibility-agreement/admin/current')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('system:manage')
  getCurrentResponsibilityAgreementForAdmin() {
    return this.accessPolicy.getCurrentResponsibilityAgreement()
  }

  @Post('responsibility-agreement/admin/publish')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('system:manage')
  publishResponsibilityAgreement(
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: RequestLike,
  ) {
    return this.accessPolicy.publishResponsibilityAgreement(
      user,
      normalizePublishResponsibilityAgreementBody(body),
      getRequestMeta(req),
    )
  }

  @Post('security-exam/submit')
  submitSecurityExam(
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: RequestLike,
  ) {
    return this.accessPolicy.submitSecurityExam(user, normalizeSubmitSecurityExamBody(body), getRequestMeta(req))
  }
}
