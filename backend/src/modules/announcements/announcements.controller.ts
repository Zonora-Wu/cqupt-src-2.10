import { Body, Controller, Get, Inject, Param, Patch, Post, Req, UseGuards } from '@nestjs/common'
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators'
import { AuthenticatedRequestUser, ClientRequestMeta } from '../auth/auth.types'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { PermissionsGuard } from '../auth/permissions.guard'
import { AnnouncementBody } from './announcement.types'
import { normalizeAnnouncementBody } from './announcement.validation'
import { AnnouncementsService } from './announcements.service'

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
    userAgent: req.headers?.['user-agent'],
    requestPath: req.path,
  }
}

@Controller('announcements')
export class AnnouncementsController {
  constructor(@Inject(AnnouncementsService) private readonly announcements: AnnouncementsService) {}

  @Get('public')
  listPublicAnnouncements() {
    return this.announcements.listPublicAnnouncements()
  }

  @Get('public/:id')
  getPublicAnnouncement(@Param('id') id: string) {
    return this.announcements.getPublicAnnouncement(id)
  }

  @Get('visible')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  listVisibleAnnouncements(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.announcements.listVisibleAnnouncements(user)
  }

  @Get('visible/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  getVisibleAnnouncement(@Param('id') id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.announcements.getVisibleAnnouncement(id, user)
  }

  @Get('manage')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('announcement:manage')
  listManageAnnouncements() {
    return this.announcements.listManageAnnouncements()
  }

  @Get('manage/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('announcement:manage')
  getManageAnnouncement(@Param('id') id: string) {
    return this.announcements.getManageAnnouncement(id)
  }

  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('announcement:manage')
  createAnnouncement(
    @Body() body: AnnouncementBody,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: RequestLike,
  ) {
    const input = normalizeAnnouncementBody(body)
    return this.announcements.createAnnouncement(input, user, getRequestMeta(req))
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('announcement:manage')
  updateAnnouncement(
    @Param('id') id: string,
    @Body() body: AnnouncementBody,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: RequestLike,
  ) {
    const input = normalizeAnnouncementBody(body)
    return this.announcements.updateAnnouncement(id, input, user, getRequestMeta(req))
  }

  @Post(':id/publish')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('announcement:manage')
  publishAnnouncement(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: RequestLike,
  ) {
    return this.announcements.publishAnnouncement(id, user, getRequestMeta(req))
  }

  @Post(':id/offline')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('announcement:manage')
  offlineAnnouncement(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: RequestLike,
  ) {
    return this.announcements.offlineAnnouncement(id, user, getRequestMeta(req))
  }
}

