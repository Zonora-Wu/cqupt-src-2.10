import { Inject, Logger, OnModuleDestroy, UseGuards } from '@nestjs/common'
import { ConnectedSocket, OnGatewayConnection, WebSocketGateway, WebSocketServer } from '@nestjs/websockets'
import { RoleCode, UserStatus } from '@prisma/client'
import type { Server, Socket } from 'socket.io'
import { verifyJwt } from '../../common/crypto/jwt'
import { PrismaService } from '../prisma/prisma.service'
import { ChatRealtimePublisher } from './chat-realtime.publisher'

@WebSocketGateway({ namespace: '/chat', cors: { credentials: true, origin: (process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173').split(',').map((item) => item.trim()) } })
@UseGuards()
export class ChatRealtimeGateway implements OnGatewayConnection, OnModuleDestroy {
  private readonly logger = new Logger(ChatRealtimeGateway.name)
  private readonly expiryTimers = new Map<string, ReturnType<typeof setTimeout>>()

  @WebSocketServer()
  server!: Server

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(ChatRealtimePublisher) private readonly publisher: ChatRealtimePublisher) {}

  afterInit(server: Server) {
    this.publisher.bind(server)
  }

  async handleConnection(@ConnectedSocket() socket: Socket) {
    try {
      const token = typeof socket.handshake.auth.token === 'string' ? socket.handshake.auth.token : ''
      const payload = verifyJwt(token, process.env.JWT_ACCESS_SECRET ?? '')
      if (!payload || payload.type !== 'access') return socket.disconnect(true)
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, include: { role: true } })
      if (!user || user.status !== UserStatus.ACTIVE) return socket.disconnect(true)
      const restriction = await this.prisma.chatUserRestriction.findFirst({ where: { userId: user.id, liftedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } })
      if (restriction) return socket.disconnect(true)
      socket.data.userId = user.id
      await socket.join(`user:${user.id}`)
      await socket.join('global')
      if (user.role.code === RoleCode.ADMIN) await socket.join('admin:chat')
      const memberships = await this.prisma.chatConversationMember.findMany({ where: { userId: user.id, removedAt: null }, select: { conversationId: true } })
      await Promise.all(memberships.map((member) => socket.join(`conversation:${member.conversationId}`)))
      const delay = Math.max(1_000, payload.exp * 1000 - Date.now())
      this.expiryTimers.set(socket.id, setTimeout(() => socket.disconnect(true), delay))
    } catch (error) {
      this.logger.warn(`chat socket rejected: ${error instanceof Error ? error.message : 'unknown'}`)
      socket.disconnect(true)
    }
  }

  handleDisconnect(@ConnectedSocket() socket: Socket) {
    const timer = this.expiryTimers.get(socket.id)
    if (timer) clearTimeout(timer)
    this.expiryTimers.delete(socket.id)
  }

  onModuleDestroy() {
    for (const timer of this.expiryTimers.values()) clearTimeout(timer)
    this.expiryTimers.clear()
  }
}
