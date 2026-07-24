import { Body, Controller, Delete, Get, Inject, MessageEvent, Param, Patch, Post, Put, Sse, UseGuards } from '@nestjs/common'
import { interval, map, mergeMap, startWith, takeWhile } from 'rxjs'
import { AiAgentRunStatus } from '@prisma/client'
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators'
import { AuthenticatedRequestUser } from '../auth/auth.types'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { PermissionsGuard } from '../auth/permissions.guard'
import { AiModelService } from './ai-model.service'
import { AiRuntimeControlService } from './ai-runtime-control.service'

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AiModelController {
  constructor(
    @Inject(AiModelService) private readonly models: AiModelService,
    @Inject(AiRuntimeControlService) private readonly runtime: AiRuntimeControlService,
  ) {}

  @Get('ai/providers')
  providers() { return this.models.listProviders() }

  @Get('ai/user-credentials')
  @RequirePermissions('ai:use_student')
  credentials(@CurrentUser() user: AuthenticatedRequestUser) { return this.models.listCredentials(user.id) }

  @Post('ai/user-credentials')
  @RequirePermissions('ai:use_student')
  createCredential(@Body() body: Record<string, unknown>, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.models.createCredential(body, user)
  }

  @Post('ai/user-credentials/:id/test')
  @RequirePermissions('ai:use_student')
  testCredential(@Param('id') id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.models.testCredential(id, user.id)
  }

  @Patch('ai/user-credentials/:id')
  @RequirePermissions('ai:use_student')
  updateCredential(@Param('id') id: string, @Body('enabled') enabled: unknown, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.models.setCredentialStatus(id, enabled, user.id)
  }

  @Delete('ai/user-credentials/:id')
  @RequirePermissions('ai:use_student')
  deleteCredential(@Param('id') id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.models.deleteCredential(id, user.id)
  }

  @Get('ai/user-models')
  @RequirePermissions('ai:use_student')
  userModels(@CurrentUser() user: AuthenticatedRequestUser) { return this.models.listModels(user.id) }

  @Post('ai/user-models')
  @RequirePermissions('ai:use_student')
  createModel(@Body() body: Record<string, unknown>, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.models.createModel(body, user.id)
  }

  @Post('ai/user-models/:id/default')
  @RequirePermissions('ai:use_student')
  defaultModel(@Param('id') id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.models.setDefaultModel(id, user.id)
  }

  @Post('ai/user-models/platform-default')
  @RequirePermissions('ai:use_student')
  platformDefaultModel(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.models.setPlatformDefault(user.id)
  }

  @Delete('ai/user-models/:id')
  @RequirePermissions('ai:use_student')
  deleteModel(@Param('id') id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.models.deleteModel(id, user.id)
  }

  @Get('system-settings/ai-model-policy')
  @RequirePermissions('system:manage')
  policy() { return this.models.getPolicy() }

  @Put('system-settings/ai-model-policy')
  @RequirePermissions('system:manage')
  updatePolicy(@Body('userMode') userMode: unknown, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.models.updatePolicy(userMode, user)
  }

  @Get('system-settings/platform-ai')
  @RequirePermissions('system:manage')
  platformAi() { return this.models.getPlatformConfig() }

  @Put('system-settings/platform-ai')
  @RequirePermissions('system:manage')
  savePlatformAi(@Body() body: Record<string, unknown>) { return this.models.savePlatformRoute(body) }

  @Delete('system-settings/platform-ai/:id')
  @RequirePermissions('system:manage')
  deletePlatformAi(@Param('id') id: string) { return this.models.deletePlatformRoute(id) }

  @Get('ai/runs/:id')
  run(@Param('id') id: string, @CurrentUser() user: AuthenticatedRequestUser) { return this.runtime.get(id, user.id) }

  @Post('ai/runs/:id/cancel')
  cancelRun(@Param('id') id: string, @CurrentUser() user: AuthenticatedRequestUser) { return this.runtime.cancel(id, user.id) }

  @Sse('ai/runs/:id/events')
  runEvents(@Param('id') id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return interval(750).pipe(
      startWith(0),
      mergeMap(() => this.runtime.get(id, user.id)),
      takeWhile((run) => run.status === AiAgentRunStatus.RUNNING, true),
      map((run): MessageEvent => ({ data: run, type: 'run.snapshot' })),
    )
  }
}
