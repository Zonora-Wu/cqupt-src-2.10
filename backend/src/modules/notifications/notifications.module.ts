import { forwardRef, Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { RbacModule } from '../rbac/rbac.module'
import { ChatModule } from '../chat/chat.module'
import { EmailModule } from '../email/email.module'
import { NotificationDeliveryService } from './notification-delivery.service'
import { NotificationsController } from './notifications.controller'
import { NotificationsService } from './notifications.service'

@Module({
  controllers: [NotificationsController],
  imports: [forwardRef(() => AuthModule), RbacModule, ChatModule, EmailModule],
  providers: [NotificationsService, NotificationDeliveryService],
  exports: [NotificationDeliveryService, NotificationsService],
})
export class NotificationsModule {}
