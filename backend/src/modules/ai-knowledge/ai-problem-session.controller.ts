import { BadRequestException, Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from '@nestjs/common'
import { AiProblemSessionStatus } from '@prisma/client'
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators'
import { AuthenticatedRequestUser } from '../auth/auth.types'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { PermissionsGuard } from '../auth/permissions.guard'
import { AiProblemSessionService } from './ai-problem-session.service'

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('ai/problem-sessions')
export class AiProblemSessionController {
  constructor(@Inject(AiProblemSessionService) private readonly sessions: AiProblemSessionService) {}

  @Post()
  create(@Body() body: Record<string, unknown>, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.sessions.create(
      {
        initialQuestion: typeof body.initialQuestion === 'string' ? body.initialQuestion : undefined,
        mode: normalizeMode(body.mode),
      },
      user,
    )
  }

  @Get('active')
  active(@Query() query: Record<string, unknown>, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.sessions.getActive(user, normalizeMode(query.mode))
  }

  @Get('history')
  history(@Query() query: Record<string, unknown>, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.sessions.getHistory(user, positiveInt(query.limit, 30))
  }

  @Get('review-queue')
  @RequirePermissions('ai:manage_skills')
  reviewQueue(@Query() query: Record<string, unknown>) {
    return this.sessions.listReviewQueue({
      page: positiveInt(query.page, 1),
      pageSize: Math.min(positiveInt(query.pageSize, 20), 100),
      status: normalizeProblemSessionStatus(query.status),
    })
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.sessions.getById(id, user)
  }

  @Post(':id/heartbeat')
  heartbeat(@Param('id') id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.sessions.heartbeat(id, user)
  }

  @Post(':id/leave')
  leave(@Param('id') id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.sessions.leave(id, user)
  }

  @Post(':id/resolve')
  resolve(@Param('id') id: string, @Body() body: Record<string, unknown>, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.sessions.resolve(id, { note: typeof body.note === 'string' ? body.note : undefined }, user)
  }

  @Post(':id/summarize')
  @RequirePermissions('ai:manage_skills')
  summarize(@Param('id') id: string) {
    return this.sessions.summarizeResolvedSession(id)
  }

  @Post(':id/review')
  @RequirePermissions('ai:manage_skills')
  review(@Param('id') id: string, @Body() body: Record<string, unknown>, @CurrentUser() user: AuthenticatedRequestUser) {
    const status = body.status
    if (status !== 'APPROVED_TO_KB' && status !== 'SKILL_CANDIDATE' && status !== 'DISCARDED') {
      throw new BadRequestException('问题会话审核状态不正确')
    }
    return this.sessions.reviewResolvedSession(id, { note: typeof body.note === 'string' ? body.note : undefined, status }, user.id)
  }

  @Post(':id/discard')
  discard(@Param('id') id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.sessions.discard(id, user)
  }

  @Post(':id/turns/:turnId/feedback')
  feedback(
    @Param('id') id: string,
    @Param('turnId') turnId: string,
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.sessions.submitTurnFeedback(id, turnId, normalizeTurnFeedbackBody(body), user)
  }
}

function normalizeMode(value: unknown) {
  if (value === 'auditor' || value === 'admin') return value
  return 'student'
}

function positiveInt(value: unknown, fallback: number) {
  if (value === undefined || value === null || value === '') return fallback
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function normalizeProblemSessionStatus(value: unknown) {
  if (typeof value !== 'string' || value === '' || value === 'ALL') return undefined
  return Object.values(AiProblemSessionStatus).includes(value as AiProblemSessionStatus) ? value as AiProblemSessionStatus : undefined
}

function normalizeTurnFeedbackBody(body: Record<string, unknown>) {
  const rating = body.rating
  if (rating !== 'UP' && rating !== 'DOWN' && rating !== 'REPORT' && rating !== 'CLEARED') {
    throw new BadRequestException('反馈值必须是 UP、DOWN、REPORT 或 CLEARED')
  }
  const normalizedRating = rating as 'UP' | 'DOWN' | 'REPORT' | 'CLEARED'
  return {
    rating: normalizedRating,
    reasonCode: optionalText(body.reasonCode, 80),
    reasonText: optionalText(body.reasonText, 500),
  }
}

function optionalText(value: unknown, maxLength: number) {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string') throw new BadRequestException('反馈原因格式不正确')
  const text = value.trim()
  if (!text) return undefined
  return text.slice(0, maxLength)
}
