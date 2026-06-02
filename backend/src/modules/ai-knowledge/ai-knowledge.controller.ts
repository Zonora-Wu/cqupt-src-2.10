import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from '@nestjs/common'
import { AiKnowledgeJobStatus } from '@prisma/client'
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators'
import { AuthenticatedRequestUser } from '../auth/auth.types'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { PermissionsGuard } from '../auth/permissions.guard'
import { AiKnowledgeMaintenanceWorker } from './ai-knowledge-maintenance.worker'
import { AiKnowledgeService } from './ai-knowledge.service'
import {
  normalizeCreateKnowledgeBody,
  normalizeConversationListQuery,
  normalizeConversationReviewBody,
  normalizeKnowledgeFeedbackBody,
  normalizeKnowledgeListQuery,
  normalizeKnowledgeReviewBody,
  normalizeMaintenanceResolveBody,
  normalizeSkillCandidateBody,
  normalizeSkillCandidateReviewBody,
} from './ai-knowledge.validation'

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

  @Get('capture-jobs')
  @RequirePermissions('ai:manage_skills')
  captureJobs(@Query() query: Record<string, unknown>) {
    const page = positiveInt(query.page, 1)
    const pageSize = Math.min(positiveInt(query.pageSize, 20), 100)
    const status = typeof query.status === 'string' && Object.values(AiKnowledgeJobStatus).includes(query.status as AiKnowledgeJobStatus)
      ? (query.status as AiKnowledgeJobStatus)
      : undefined
    return this.knowledge.listCaptureJobs({ page, pageSize, status })
  }

  @Get('conversations')
  @RequirePermissions('ai:manage_skills')
  conversations(@Query() query: Record<string, unknown>) {
    return this.knowledge.listConversations(normalizeConversationListQuery(query))
  }

  @Post('conversations/:id/summarize')
  @RequirePermissions('ai:manage_skills')
  summarizeConversation(@Param('id') id: string) {
    return this.knowledge.summarizeConversation(id)
  }

  @Post('conversations/:id/review')
  @RequirePermissions('ai:manage_skills')
  reviewConversation(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.knowledge.reviewConversation(id, normalizeConversationReviewBody(body), user.id)
  }

  @Post()
  @RequirePermissions('ai:manage_skills')
  create(@Body() body: Record<string, unknown>, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.knowledge.createKnowledge(normalizeCreateKnowledgeBody(body), user.id)
  }

  @Post('process-captures')
  @RequirePermissions('ai:manage_skills')
  processCaptures() {
    return this.knowledge.processPendingCaptures()
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

  @Get('skill-candidates')
  @RequirePermissions('ai:manage_skills')
  listSkillCandidates() {
    return this.knowledge.listSkillCandidates()
  }

  @Post('skill-candidates')
  @RequirePermissions('ai:manage_skills')
  createSkillCandidate(@Body() body: Record<string, unknown>) {
    return this.knowledge.createSkillCandidate(normalizeSkillCandidateBody(body))
  }

  @Post('skill-candidates/:id/install')
  @RequirePermissions('ai:manage_skills')
  installSkillCandidate(@Param('id') id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.knowledge.installSkillCandidate(id, user.id)
  }

  @Post('skill-candidates/:id/review')
  @RequirePermissions('ai:manage_skills')
  reviewSkillCandidate(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.knowledge.reviewSkillCandidate(id, normalizeSkillCandidateReviewBody(body), user.id)
  }

  // ─── Maintenance task endpoints ─────────────────────────────────

  @Get('maintenance/tasks')
  @RequirePermissions('ai:manage_skills')
  listMaintenanceTasks(@Query() query: Record<string, unknown>) {
    const page = positiveInt(query.page, 1)
    const pageSize = Math.min(positiveInt(query.pageSize, 20), 100)
    return this.knowledge.listMaintenanceTasks({
      knowledgeId: typeof query.knowledgeId === 'string' ? query.knowledgeId : undefined,
      page,
      pageSize,
      priority: typeof query.priority === 'string' ? query.priority : undefined,
      status: typeof query.status === 'string' ? query.status : undefined,
      taskType: typeof query.taskType === 'string' ? query.taskType : undefined,
    })
  }

  @Post('maintenance/tasks/:id/resolve')
  @RequirePermissions('ai:manage_skills')
  resolveMaintenanceTask(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.knowledge.resolveMaintenanceTask(id, normalizeMaintenanceResolveBody(body))
  }

  @Post('maintenance/tasks/:id/dismiss')
  @RequirePermissions('ai:manage_skills')
  dismissMaintenanceTask(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.knowledge.dismissMaintenanceTask(id, normalizeMaintenanceResolveBody(body))
  }

  @Post('maintenance/run')
  @RequirePermissions('ai:manage_skills')
  runMaintenance() {
    return this.maintenanceWorker.runMaintenanceScan()
  }
}

function positiveInt(value: unknown, fallback: number) {
  if (value === undefined || value === null || value === '') return fallback
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}
