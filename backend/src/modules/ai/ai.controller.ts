import {
  BadRequestException,
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
import { UploadedPdfFile } from '../attachments/attachment.types'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { PermissionsGuard } from '../auth/permissions.guard'
import { AiChatBody } from './ai.types'
import { AiReportDraftService } from './ai.report-draft.service'
import { AiService } from './ai.service'
import { normalizeAiChatBody, normalizeAiRoutePreviewBody } from './ai.validation'

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

@Controller('ai')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AiController {
  constructor(
    @Inject(AiService) private readonly ai: AiService,
    @Inject(AiReportDraftService) private readonly reportDrafts: AiReportDraftService,
  ) {}

  @Get('health')
  health() {
    return this.ai.checkAgentHealth()
  }

  @Get('appearance')
  appearance() {
    return this.ai.getAppearance()
  }

  @Get('quota')
  quota(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.ai.getQuota(user.id)
  }

  @Get('skills')
  skills(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.ai.getSkillLibrary(user)
  }

  @Post('chat')
  chat(
    @Body() body: AiChatBody,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: RequestLike,
  ) {
    const input = normalizeAiChatBody(body)
    return this.ai.chat(input, user, getRequestMeta(req))
  }

  @Post('knowledge/route-preview')
  @RequirePermissions('ai:manage_skills')
  routePreview(
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: RequestLike,
  ) {
    return this.ai.routePreview(normalizeAiRoutePreviewBody(body), user, getRequestMeta(req))
  }

  @Post('report-drafts')
  @RequirePermissions('ai:use_student')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  extractReportDrafts(@UploadedFile() file: UploadedPdfFile | undefined) {
    return this.reportDrafts.extractVulnerabilityDrafts(file)
  }

  @Post('report-analysis')
  @RequirePermissions('ai:use_student')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async analyzeReport(
    @UploadedFile() file: UploadedPdfFile | undefined,
    @Body('draftId') draftId: string | undefined,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: RequestLike,
  ) {
    const normalizedDraftId = typeof draftId === 'string' ? draftId.trim() : ''
    if (!normalizedDraftId) throw new BadRequestException('请选择要分析的漏洞')
    const prepared = await this.reportDrafts.prepareVulnerabilityAnalysis(file, normalizedDraftId)
    return this.ai.analyzeVulnerabilityReport(prepared, user, getRequestMeta(req))
  }

  @Post('vulnerability-advice/:reportId')
  @RequirePermissions('ai:use_student')
  analyzeStoredVulnerabilityReport(
    @Param('reportId') reportId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: RequestLike,
  ) {
    return this.ai.analyzeStoredVulnerabilityReport(reportId, user, getRequestMeta(req))
  }

  @Post('attachments/text')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  extractAttachmentText(@UploadedFile() file: UploadedPdfFile | undefined) {
    return this.reportDrafts.extractAttachmentText(file)
  }

  @Post('actions/:actionId/confirm')
  confirmAction(
    @Param('actionId') actionId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    // 后续实现：验证 actionId → 执行对应业务逻辑（兑换/打开资源等）
    return {
      actionId,
      message: '待确认动作接口预留',
      status: 'not_implemented',
    }
  }
}
