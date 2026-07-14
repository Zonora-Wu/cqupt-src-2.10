import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { RbacModule } from '../rbac/rbac.module'
import { ChatAdminController } from './chat-admin.controller'
import { ChatController } from './chat.controller'
import { ChatRateLimitService } from './chat-rate-limit.service'
import { ChatRealtimeGateway } from './chat-realtime.gateway'
import { ChatRealtimePublisher } from './chat-realtime.publisher'
import { ChatService } from './chat.service'

@Module({
  imports: [AuthModule, RbacModule],
  controllers: [ChatController, ChatAdminController],
  providers: [ChatService, ChatRateLimitService, ChatRealtimeGateway, ChatRealtimePublisher],
  exports: [ChatService],
})
export class ChatModule {}
