import { Body, Controller, Delete, Get, Inject, Param, Post, Put, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { MalwareScanInterceptor } from '../../common/security/malware-scan.interceptor'
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators'
import { AuthenticatedRequestUser, ClientRequestMeta } from '../auth/auth.types'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { PermissionsGuard } from '../auth/permissions.guard'
import { SecurityExamService } from './security-exam.service'
import { normalizeAiGenerateBody, normalizeQuestionBody, normalizeQuestionListBody, normalizeSubmitExamBody } from './security-exam.validation'

type RequestLike = { ip?: string; path?: string; headers?: { ['user-agent']?: string; ['x-forwarded-for']?: string | string[] } }
type UploadedFileLike = { buffer?: Buffer; mimetype?: string; originalname?: string; size?: number }

function getRequestMeta(req: RequestLike): ClientRequestMeta {
  const forwardedFor = req.headers?.['x-forwarded-for']
  const forwardedIp = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor
  return { ipAddress: forwardedIp?.split(',')[0]?.trim() || req.ip, requestPath: req.path, userAgent: req.headers?.['user-agent'] }
}

@Controller('security-exam')
@UseGuards(JwtAuthGuard)
export class SecurityExamController {
  constructor(@Inject(SecurityExamService) private readonly securityExam: SecurityExamService) {}

  @Get('paper')
  getPaper() {
    return this.securityExam.getExamPaper()
  }

  @Post('submit')
  submit(@Body() body: Record<string, unknown>, @CurrentUser() user: AuthenticatedRequestUser, @Req() req: RequestLike) {
    return this.securityExam.submitExam(user, normalizeSubmitExamBody(body), getRequestMeta(req))
  }
}

@Controller('system-settings/security-exam')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SecurityExamAdminController {
  constructor(@Inject(SecurityExamService) private readonly securityExam: SecurityExamService) {}

  @Get('settings')
  @RequirePermissions('system:manage')
  getSettings() {
    return this.securityExam.getSettings()
  }

  @Post('settings')
  @RequirePermissions('system:manage')
  updateSettings(@Body() body: { enabled?: unknown; threshold?: unknown }, @CurrentUser() user: AuthenticatedRequestUser, @Req() req: RequestLike) {
    return this.securityExam.updateSettings({ enabled: body.enabled === true || body.enabled === 'true', threshold: Number(body.threshold ?? 80) }, user, getRequestMeta(req))
  }

  @Get('questions')
  @RequirePermissions('system:manage')
  listQuestions() {
    return this.securityExam.listQuestions()
  }

  @Post('questions')
  @RequirePermissions('system:manage')
  createQuestions(@Body() body: Record<string, unknown>, @CurrentUser() user: AuthenticatedRequestUser, @Req() req: RequestLike) {
    return this.securityExam.createQuestions(normalizeQuestionListBody(body), user, getRequestMeta(req), 'ADMIN')
  }

  @Post('questions/:id/active')
  @RequirePermissions('system:manage')
  setActive(@Param('id') id: string, @Body() body: { active?: unknown }, @CurrentUser() user: AuthenticatedRequestUser, @Req() req: RequestLike) {
    return this.securityExam.setQuestionActive(id, body.active === true || body.active === 'true', user, getRequestMeta(req))
  }

  @Put('questions/:id')
  @RequirePermissions('system:manage')
  updateQuestion(@Param('id') id: string, @Body() body: Record<string, unknown>, @CurrentUser() user: AuthenticatedRequestUser, @Req() req: RequestLike) {
    return this.securityExam.updateQuestion(id, normalizeQuestionBody(body), user, getRequestMeta(req))
  }

  @Delete('questions/:id')
  @RequirePermissions('system:manage')
  deleteQuestion(@Param('id') id: string, @CurrentUser() user: AuthenticatedRequestUser, @Req() req: RequestLike) {
    return this.securityExam.deleteQuestion(id, user, getRequestMeta(req))
  }

  @Post('questions/:id/replace')
  @RequirePermissions('system:manage')
  replaceQuestion(@Param('id') id: string, @Body() body: Record<string, unknown>, @CurrentUser() user: AuthenticatedRequestUser, @Req() req: RequestLike) {
    return this.securityExam.replaceQuestion(id, normalizeQuestionBody(body), user, getRequestMeta(req))
  }

  @Post('ai-generate')
  @RequirePermissions('system:manage')
  generate(@Body() body: Record<string, unknown>, @CurrentUser() user: AuthenticatedRequestUser, @Req() req: RequestLike) {
    return this.securityExam.generateQuestionsWithAi(normalizeAiGenerateBody(body), user, getRequestMeta(req))
  }

  @Post('import')
  @RequirePermissions('system:manage')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }), MalwareScanInterceptor)
  importFile(@UploadedFile() file: UploadedFileLike | undefined, @CurrentUser() user: AuthenticatedRequestUser, @Req() req: RequestLike) {
    return this.securityExam.importQuestionsFromFile(file, user, getRequestMeta(req))
  }

  @Post('knowledge-generate')
  @RequirePermissions('system:manage')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }), MalwareScanInterceptor)
  generateFromKnowledgeFile(@UploadedFile() file: UploadedFileLike | undefined, @CurrentUser() user: AuthenticatedRequestUser, @Req() req: RequestLike) {
    return this.securityExam.generateQuestionsFromKnowledgeFile(file, user, getRequestMeta(req))
  }
}
