import { BadRequestException, Body, Controller, Delete, Get, Header, Inject, Param, Patch, Post, Req, Res, UseGuards } from '@nestjs/common'
import type { Response } from 'express'
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators'
import { AuthenticatedRequestUser, ClientRequestMeta } from '../auth/auth.types'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { PermissionsGuard } from '../auth/permissions.guard'
import { ChatService } from './chat.service'
import { CleanupBody, RestrictUserBody, SensitiveWordBody } from './chat.types'
import { normalizeRestrictionBody, normalizeSensitiveWordBody } from './chat.validation'

type RequestLike = { ip?: string; path?: string; headers?: { ['user-agent']?: string; ['x-forwarded-for']?: string | string[] } }
function meta(req: RequestLike): ClientRequestMeta { const forwarded = req.headers?.['x-forwarded-for']; const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded; return { ipAddress: ip?.split(',')[0]?.trim() || req.ip, requestPath: req.path, userAgent: req.headers?.['user-agent'] } }
function before(value: unknown) { if (typeof value !== 'string') throw new BadRequestException('清理日期格式不正确'); const date = new Date(value); if (Number.isNaN(date.getTime()) || date >= new Date()) throw new BadRequestException('清理日期必须早于当前时间'); return date }

@Controller('chat/admin')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('chat:manage')
export class ChatAdminController {
  constructor(@Inject(ChatService) private readonly chat: ChatService) {}

  @Get('conversations')
  conversations(@CurrentUser() user: AuthenticatedRequestUser) { return this.chat.listAdminConversations(user) }

  @Get('conversations/:id/messages')
  messages(@Param('id') id: string, @CurrentUser() user: AuthenticatedRequestUser) { return this.chat.listMessages(id, user, undefined, 100) }

  @Post('restrictions')
  restrict(@Body() body: RestrictUserBody, @CurrentUser() user: AuthenticatedRequestUser, @Req() req: RequestLike) { return this.chat.restrictUser(normalizeRestrictionBody(body), user, meta(req)) }

  @Delete('restrictions/:userId')
  lift(@Param('userId') userId: string, @CurrentUser() user: AuthenticatedRequestUser, @Req() req: RequestLike) { return this.chat.liftRestriction(userId, user, meta(req)) }

  @Get('sensitive-words')
  words(@CurrentUser() user: AuthenticatedRequestUser) { return this.chat.listSensitiveWords(user) }

  @Post('sensitive-words')
  addWord(@Body() body: SensitiveWordBody, @CurrentUser() user: AuthenticatedRequestUser, @Req() req: RequestLike) { const input = normalizeSensitiveWordBody(body); return this.chat.createSensitiveWord(input.term!, input.active, user, meta(req)) }

  @Patch('sensitive-words/:id')
  updateWord(@Param('id') id: string, @Body() body: SensitiveWordBody, @CurrentUser() user: AuthenticatedRequestUser, @Req() req: RequestLike) { return this.chat.updateSensitiveWord(id, normalizeSensitiveWordBody(body, true), user, meta(req)) }

  @Delete('sensitive-words/:id')
  deleteWord(@Param('id') id: string, @CurrentUser() user: AuthenticatedRequestUser, @Req() req: RequestLike) { return this.chat.deleteSensitiveWord(id, user, meta(req)) }

  @Get('storage')
  storage(@CurrentUser() user: AuthenticatedRequestUser) { return this.chat.getStorage(user) }

  @Post('cleanup/preview')
  preview(@Body() body: CleanupBody, @CurrentUser() user: AuthenticatedRequestUser) { return this.chat.previewCleanup(before(body.before), user) }

  @Post('cleanup')
  cleanup(@Body() body: CleanupBody, @CurrentUser() user: AuthenticatedRequestUser, @Req() req: RequestLike) { if (typeof body.confirmationToken !== 'string') throw new BadRequestException('缺少清理确认'); return this.chat.cleanup(before(body.before), body.confirmationToken, user, meta(req)) }

  @Post('export')
  @Header('Content-Type', 'application/x-ndjson; charset=utf-8')
  async export(@Body() body: CleanupBody, @CurrentUser() user: AuthenticatedRequestUser, @Req() req: RequestLike, @Res() res: Response) {
    const cutoff = before(body.before)
    res.setHeader('Content-Disposition', `attachment; filename="chat-backup-before-${cutoff.toISOString().slice(0, 10)}.jsonl"`)
    res.write(`${JSON.stringify({ exportedAt: new Date().toISOString(), before: cutoff.toISOString(), format: 'cqupt-src-chat-jsonl-v1' })}\n`)
    for await (const message of this.chat.exportMessages(cutoff, user, meta(req))) res.write(`${JSON.stringify({ id: message.id, conversationId: message.conversationId, conversationTitle: message.conversation.title, content: message.content, createdAt: message.createdAt.toISOString(), sender: { id: message.sender.id, name: message.sender.name, role: message.sender.role.code } })}\n`)
    res.end()
  }
}
