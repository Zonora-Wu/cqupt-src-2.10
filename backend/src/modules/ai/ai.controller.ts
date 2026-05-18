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
import { CurrentUser } from '../auth/auth.decorators'
import { AuthenticatedRequestUser, ClientRequestMeta } from '../auth/auth.types'
import { UploadedPdfFile } from '../attachments/attachment.types'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { PermissionsGuard } from '../auth/permissions.guard'
import { AiChatBody } from './ai.types'
import { AiReportDraftService } from './ai.report-draft.service'
import { AiService } from './ai.service'
import { normalizeAiChatBody } from './ai.validation'

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

  @Post('report-drafts')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  extractReportDrafts(@UploadedFile() file: UploadedPdfFile | undefined) {
    return this.reportDrafts.extractVulnerabilityDrafts(file)
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
