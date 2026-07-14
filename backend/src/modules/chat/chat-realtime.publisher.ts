import { Injectable } from '@nestjs/common'
import type { Server } from 'socket.io'

@Injectable()
export class ChatRealtimePublisher {
  private server: Server | null = null

  bind(server: Server) {
    this.server = server
  }

  toConversation(conversationId: string, event: string, payload: unknown) {
    this.server?.to(`conversation:${conversationId}`).emit(event, payload)
  }

  toUser(userId: string, event: string, payload: unknown) {
    this.server?.to(`user:${userId}`).emit(event, payload)
  }

  toAdmins(event: string, payload: unknown) {
    this.server?.to('admin:chat').emit(event, payload)
  }

  toGlobal(event: string, payload: unknown) {
    this.server?.to('global').emit(event, payload)
  }
}
