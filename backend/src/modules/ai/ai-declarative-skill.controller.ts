import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators'
import { AuthenticatedRequestUser } from '../auth/auth.types'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { PermissionsGuard } from '../auth/permissions.guard'
import { AiDeclarativeSkillService } from './ai-declarative-skill.service'

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AiDeclarativeSkillController {
  constructor(@Inject(AiDeclarativeSkillService) private readonly skills: AiDeclarativeSkillService) {}

  @Get('ai/skills')
  list(@CurrentUser() user: AuthenticatedRequestUser) { return this.skills.list(user) }

  @Post('ai/skills')
  create(@Body() body: Record<string, unknown>, @CurrentUser() user: AuthenticatedRequestUser) { return this.skills.create(body, user) }

  @Post('ai/skills/upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  upload(@UploadedFile() file: { buffer?: Buffer; originalname?: string; size?: number } | undefined, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.skills.upload(file, user)
  }

  @Patch('ai/skills/:id')
  update(@Param('id') id: string, @Body() body: Record<string, unknown>, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.skills.update(id, body, user)
  }

  @Delete('ai/skills/:id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedRequestUser) { return this.skills.remove(id, user) }

  @Post('ai/skills/:id/submit')
  submit(@Param('id') id: string, @CurrentUser() user: AuthenticatedRequestUser) { return this.skills.submit(id, user) }

  @Post('ai/skills/:id/activate')
  activate(@Param('id') id: string, @CurrentUser() user: AuthenticatedRequestUser) { return this.skills.setActive(id, true, user) }

  @Post('ai/skills/:id/deactivate')
  deactivate(@Param('id') id: string, @CurrentUser() user: AuthenticatedRequestUser) { return this.skills.setActive(id, false, user) }

  @Post('ai/skills/:id/pin/:sessionId')
  pin(@Param('id') id: string, @Param('sessionId') sessionId: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.skills.pin(id, sessionId, user)
  }

  @Delete('ai/skills/:id/pin/:sessionId')
  unpin(@Param('id') id: string, @Param('sessionId') sessionId: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.skills.unpin(id, sessionId, user)
  }

  @Get('admin/ai-skill-reviews')
  @RequirePermissions('ai:manage_skills')
  reviews() { return this.skills.listReviews() }

  @Post('admin/ai-skill-reviews/:id/:decision')
  @RequirePermissions('ai:manage_skills')
  review(
    @Param('id') id: string,
    @Param('decision') decision: 'approve' | 'reject' | 'request-changes',
    @Body('note') note: unknown,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    const mapped = decision === 'approve' ? 'APPROVE' : decision === 'reject' ? 'REJECT' : 'REQUEST_CHANGES'
    return this.skills.review(id, mapped, note, user)
  }
}
