import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common'
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators'
import { AuthenticatedRequestUser, ClientRequestMeta } from '../auth/auth.types'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { PermissionsGuard } from '../auth/permissions.guard'
import { ChatService } from './chat.service'
import { CreateDirectConversationBody, CreateGroupConversationBody, ManageConversationBody, ManageMembersBody, ReadConversationBody, SendMessageBody } from './chat.types'
import { normalizeBefore, normalizeCursor, normalizeDirectBody, normalizeGroupBody, normalizeManageConversationBody, normalizeMembersBody, normalizeMessageBody, normalizeReadBody } from './chat.validation'

type RequestLike = { ip?: string; path?: string; headers?: { ['user-agent']?: string; ['x-forwarded-for']?: string | string[] } }
function meta(req: RequestLike): ClientRequestMeta {
  const forwarded = req.headers?.['x-forwarded-for']
  const ipAddress = Array.isArray(forwarded) ? forwarded[0] : forwarded
  return { ipAddress: ipAddress?.split(',')[0]?.trim() || req.ip, requestPath: req.path, userAgent: req.headers?.['user-agent'] }
}

@Controller('chat')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('chat:use')
export class ChatController {
  constructor(@Inject(ChatService) private readonly chat: ChatService) {}

  @Get('bootstrap')
  bootstrap(@CurrentUser() user: AuthenticatedRequestUser) { return this.chat.bootstrap(user) }

  @Get('contacts/staff')
  staff() { return this.chat.listStaffContacts() }

  @Get('contacts/search')
  search(@Query('unifiedCode') unifiedCode: string, @CurrentUser() user: AuthenticatedRequestUser, @Req() req: RequestLike) { return this.chat.searchContact(unifiedCode ?? '', user, meta(req).ipAddress) }

  @Get('conversations')
  conversations(@CurrentUser() user: AuthenticatedRequestUser) { return this.chat.listConversations(user) }

  @Post('conversations/direct')
  direct(@Body() body: CreateDirectConversationBody, @CurrentUser() user: AuthenticatedRequestUser) { return this.chat.createDirect(normalizeDirectBody(body).targetUserId, user) }

  @Post('conversations/group')
  group(@Body() body: CreateGroupConversationBody, @CurrentUser() user: AuthenticatedRequestUser, @Req() req: RequestLike) {
    const input = normalizeGroupBody(body)
    return this.chat.createGroup(input.title, input.memberIds, user, meta(req))
  }

  @Get('conversations/:id/messages')
  messages(@Param('id') id: string, @Query('before') before: string | undefined, @Query('limit') limit: string | undefined, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.chat.listMessages(id, user, normalizeBefore(before), normalizeCursor(limit))
  }

  @Post('conversations/:id/messages')
  send(@Param('id') id: string, @Body() body: SendMessageBody, @CurrentUser() user: AuthenticatedRequestUser, @Req() req: RequestLike) { return this.chat.sendMessage(id, normalizeMessageBody(body), user, meta(req)) }

  @Post('conversations/:id/read')
  read(@Param('id') id: string, @Body() body: ReadConversationBody, @CurrentUser() user: AuthenticatedRequestUser) { return this.chat.markRead(id, normalizeReadBody(body).messageId, user) }

  @Patch('conversations/:id')
  rename(@Param('id') id: string, @Body() body: ManageConversationBody, @CurrentUser() user: AuthenticatedRequestUser, @Req() req: RequestLike) { return this.chat.updateConversation(id, normalizeManageConversationBody(body, true), user, meta(req)) }

  @Post('conversations/:id/members')
  addMembers(@Param('id') id: string, @Body() body: ManageMembersBody, @CurrentUser() user: AuthenticatedRequestUser, @Req() req: RequestLike) { return this.chat.addMembers(id, normalizeMembersBody(body).userIds, user, meta(req)) }

  @Delete('conversations/:id/members/:userId')
  removeMember(@Param('id') id: string, @Param('userId') userId: string, @CurrentUser() user: AuthenticatedRequestUser, @Req() req: RequestLike) { return this.chat.removeMember(id, userId, user, meta(req)) }

  @Post('conversations/:id/close')
  close(@Param('id') id: string, @Body() body: ManageConversationBody, @CurrentUser() user: AuthenticatedRequestUser, @Req() req: RequestLike) { return this.chat.setConversationStatus(id, false, normalizeManageConversationBody(body).reason, user, meta(req)) }

  @Post('conversations/:id/reopen')
  reopen(@Param('id') id: string, @Body() body: ManageConversationBody, @CurrentUser() user: AuthenticatedRequestUser, @Req() req: RequestLike) { return this.chat.setConversationStatus(id, true, normalizeManageConversationBody(body).reason, user, meta(req)) }

  @Post('conversations/:id/dissolve')
  dissolve(@Param('id') id: string, @Body() body: ManageConversationBody, @CurrentUser() user: AuthenticatedRequestUser, @Req() req: RequestLike) { return this.chat.dissolveGroup(id, normalizeManageConversationBody(body).reason, user, meta(req)) }
}
