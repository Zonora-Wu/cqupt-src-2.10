import { Body, Controller, Get, Inject, Param, Post, Query, Req, UseGuards } from '@nestjs/common'
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators'
import { AuthenticatedRequestUser, ClientRequestMeta } from '../auth/auth.types'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { PermissionsGuard } from '../auth/permissions.guard'
import { AiKnowledgeMaintenanceWorker } from './ai-knowledge-maintenance.worker'
import { AiKnowledgeService } from './ai-knowledge.service'
import {
  normalizeCreateKnowledgeBody,
  normalizeKnowledgeFeedbackBody,
  normalizeKnowledgeListQuery,
  normalizeKnowledgeReviewBody,
  normalizeMaintenanceListQuery,
  normalizeMaintenanceResolveBody,
  normalizeRevisionCreateBody,
  normalizeRevisionRestoreBody,
} from './ai-knowledge.validation'

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

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('ai/knowledge')
export class AiKnowledgeController {
  constructor(
    @Inject(AiKnowledgeService) private readonly knowledge: AiKnowledgeService,
    @Inject(AiKnowledgeMaintenanceWorker) private readonly maintenanceWorker: AiKnowledgeMaintenanceWorker,
  ) {}

  @Get()
  @RequirePermissions('ai:manage_skills')
  list(@Query() query: Record<string, unknown>) {
    return this.knowledge.listKnowledge(normalizeKnowledgeListQuery(query))
  }

  @Get('stats')
  @RequirePermissions('ai:manage_skills')
  stats() {
    return this.knowledge.getStats()
  }


  @Post()
  @RequirePermissions('ai:manage_skills')
  create(@Body() body: Record<string, unknown>, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.knowledge.createKnowledge(normalizeCreateKnowledgeBody(body), user.id)
  }


  @Post(':id/review')
  @RequirePermissions('ai:manage_skills')
  reviewKnowledge(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.knowledge.reviewKnowledge(id, normalizeKnowledgeReviewBody(body), user.id)
  }

  @Post(':id/feedback')
  feedback(@Param('id') id: string, @Body() body: Record<string, unknown>, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.knowledge.addFeedback(id, normalizeKnowledgeFeedbackBody(body), user.id, user.role)
  }

  @Get(':id/revisions')
  @RequirePermissions('ai:manage_skills')
  listRevisions(@Param('id') id: string) {
    return this.knowledge.listRevisions(id)
  }

  @Post(':id/revisions')
  @RequirePermissions('ai:manage_skills')
  createRevision(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: RequestLike,
  ) {
    return this.knowledge.createRevision(id, normalizeRevisionCreateBody(body), user.id, getRequestMeta(req))
  }

  @Post(':id/restore')
  @RequirePermissions('ai:manage_skills')
  restoreRevision(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: RequestLike,
  ) {
    return this.knowledge.restoreRevision(id, normalizeRevisionRestoreBody(body), user.id, getRequestMeta(req))
  }

  // ─── Maintenance task endpoints ─────────────────────────────────

  @Get('maintenance/tasks')
  @RequirePermissions('ai:manage_skills')
  listMaintenanceTasks(@Query() query: Record<string, unknown>) {
    return this.knowledge.listMaintenanceTasks(normalizeMaintenanceListQuery(query))
  }

  @Post('maintenance/tasks/:id/resolve')
  @RequirePermissions('ai:manage_skills')
  resolveMaintenanceTask(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: RequestLike,
  ) {
    return this.knowledge.resolveMaintenanceTask(id, normalizeMaintenanceResolveBody(body), user.id, getRequestMeta(req))
  }

  @Post('maintenance/tasks/:id/dismiss')
  @RequirePermissions('ai:manage_skills')
  dismissMaintenanceTask(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: RequestLike,
  ) {
    return this.knowledge.dismissMaintenanceTask(id, normalizeMaintenanceResolveBody(body), user.id, getRequestMeta(req))
  }

  @Post('maintenance/run')
  @RequirePermissions('ai:manage_skills')
  runMaintenance() {
    return this.maintenanceWorker.runMaintenanceScan()
  }
}
