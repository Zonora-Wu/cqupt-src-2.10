import { forwardRef, Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { RbacModule } from '../rbac/rbac.module'
import { ChatAdminController } from './chat-admin.controller'
import { ChatController } from './chat.controller'
import { ChatRealtimeGateway } from './chat-realtime.gateway'
import { ChatRealtimePublisher } from './chat-realtime.publisher'
import { ChatService } from './chat.service'

@Module({
  imports: [forwardRef(() => AuthModule), RbacModule],
  controllers: [ChatController, ChatAdminController],
  providers: [ChatService, ChatRealtimeGateway, ChatRealtimePublisher],
  exports: [ChatService, ChatRealtimePublisher],
})
export class ChatModule {}
