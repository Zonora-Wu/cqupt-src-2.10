import { Body, Controller, Get, Inject, Param, Post, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../auth/auth.decorators'
import { AuthenticatedRequestUser } from '../auth/auth.types'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { PermissionsGuard } from '../auth/permissions.guard'
import { NotificationsService } from './notifications.service'

@Controller('notifications')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class NotificationsController {
  constructor(@Inject(NotificationsService) private readonly notifications: NotificationsService) {}

  @Get()
  getNotifications(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.notifications.getNotifications(user)
  }

  @Post(':notificationId/read')
  markRead(@CurrentUser() user: AuthenticatedRequestUser, @Param('notificationId') notificationId: string) {
    return this.notifications.markRead(user.id, notificationId)
  }

  @Post('channels/:channelId/read')
  markChannelRead(@CurrentUser() user: AuthenticatedRequestUser, @Param('channelId') channelId: string) {
    return this.notifications.markChannelRead(user.id, channelId)
  }

  @Post('entities/read')
  markEntityRead(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() body: { entityId?: unknown; entityType?: unknown },
  ) {
    const entityId = typeof body.entityId === 'string' ? body.entityId.trim() : ''
    const entityType = typeof body.entityType === 'string' ? body.entityType.trim() : ''
    if (!entityId || !['Certificate', 'SecurityEvent', 'VulnerabilityReport'].includes(entityType)) {
      return { success: false }
    }
    return this.notifications.markEntityRead(user.id, entityType, entityId)
  }
}
