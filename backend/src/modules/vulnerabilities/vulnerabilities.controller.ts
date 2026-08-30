import { BadRequestException, Body, Controller, Delete, Get, Inject, Param, Post, Put, Req, UseGuards } from '@nestjs/common'
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { PermissionsGuard } from '../auth/permissions.guard'
import { AuthenticatedRequestUser, ClientRequestMeta } from '../auth/auth.types'
import { normalizeCreateVulnerabilityBody, normalizeRetestBody, normalizeReviewVulnerabilityBody } from './vulnerability.validation'
import { CreateVulnerabilityBody, RetestBody, ReviewVulnerabilityBody } from './vulnerability.types'
import { VulnerabilitiesService } from './vulnerabilities.service'
import { UpdateVulnerabilityDraftBody, VulnerabilityDraftsService } from './vulnerability-drafts.service'
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
  constructor(
    @Inject(VulnerabilitiesService) private readonly vulnerabilities: VulnerabilitiesService,
    @Inject(VulnerabilityDraftsService) private readonly drafts: VulnerabilityDraftsService,
  ) {}

  @Get('drafts')
  @RequirePermissions('vulnerability:create')
  listDrafts(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.drafts.list(user)
  }

  @Post('drafts')
  @RequirePermissions('vulnerability:create')
  createDraft(@Body() body: { name?: unknown }, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.drafts.create(user, body)
  }

  @Get('drafts/:draftId')
  @RequirePermissions('vulnerability:create')
  getDraft(@Param('draftId') draftId: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.drafts.get(draftId, user)
  }

  @Put('drafts/:draftId')
  @RequirePermissions('vulnerability:create')
  updateDraft(
    @Param('draftId') draftId: string,
    @Body() body: UpdateVulnerabilityDraftBody,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.drafts.update(draftId, body, user)
  }

  @Delete('drafts/:draftId')
  @RequirePermissions('vulnerability:create')
  deleteDraft(@Param('draftId') draftId: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.drafts.remove(draftId, user)
  }

  @Post('drafts/:draftId/submit')
  @RequirePermissions('vulnerability:create')
  submitDraft(
    @Param('draftId') draftId: string,
    @Body() body: { version?: unknown },
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: RequestLike,
  ) {
    if (!Number.isInteger(body.version) || Number(body.version) < 1) throw new BadRequestException('草稿版本不正确')
    return this.vulnerabilities.submitDraft(user, draftId, Number(body.version), getRequestMeta(req))
  }

  @Get('my')
  @RequirePermissions('vulnerability:read_own')
  listMyReports(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.vulnerabilities.listMyReports(user)
  }

  @Get('my/:reportId')
  @RequirePermissions('vulnerability:read_own')
  getMyVulnerabilityDetail(
    @Param('reportId') reportId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.vulnerabilities.getMyVulnerabilityDetail(reportId, user)
  }

  @Post('my/:reportId/supplement')
  @RequirePermissions('vulnerability:read_own')
  supplementVulnerability(
    @Param('reportId') reportId: string,
    @Body() body: { note?: unknown },
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: RequestLike,
  ) {
    if (typeof body.note !== 'string' || body.note.trim().length < 5) {
      throw new BadRequestException('请填写补充说明（至少5字）')
    }
    return this.vulnerabilities.supplementVulnerability(reportId, body.note.trim(), user, getRequestMeta(req))
  }

  @Get('retest-queue')
  @RequirePermissions('vulnerability:review')
  listRetestQueue(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.vulnerabilities.listRetestQueue(user)
  }

  @Get('review-queue')
  @RequirePermissions('vulnerability:review')
  listReviewQueue(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.vulnerabilities.listReviewQueue(user)
  }

  @Get('manage')
  @RequirePermissions('vulnerability:manage')
  listAllVulnerabilities(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.vulnerabilities.listAllVulnerabilities(user)
  }

  @Get(':reportId')
  @RequirePermissions('vulnerability:read_all')
  getVulnerabilityById(@Param('reportId') reportId: string) {
    return this.vulnerabilities.getVulnerabilityById(reportId)
  }

  @Post(':reportId/retest')
  @RequirePermissions('vulnerability:review')
  retestReport(
    @Param('reportId') reportId: string,
    @Body() body: RetestBody,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: RequestLike,
  ) {
    const input = normalizeRetestBody(body)
    return this.vulnerabilities.retestReport(reportId, input, user, getRequestMeta(req))
  }

  @Post(':reportId/mark-fixing')
  @RequirePermissions('vulnerability:review')
  markFixing(
    @Param('reportId') reportId: string,
    @Body() body: { note?: unknown },
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: RequestLike,
  ) {
    if (typeof body.note !== 'string') {
      throw new BadRequestException('note 字段格式错误')
    }
    return this.vulnerabilities.markFixing(reportId, body.note.trim(), user, getRequestMeta(req))
  }

  @Post(':reportId/review')
  @RequirePermissions('vulnerability:review')
  reviewReport(
    @Param('reportId') reportId: string,
    @Body() body: ReviewVulnerabilityBody,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: RequestLike,
  ) {
    const input = normalizeReviewVulnerabilityBody(body)
    return this.vulnerabilities.reviewReport(reportId, input, user, getRequestMeta(req))
  }

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
