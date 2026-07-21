import { Inject, Injectable, Logger } from '@nestjs/common'
import { AuditAction, Prisma, RoleCode } from '@prisma/client'
import { ChatRealtimePublisher } from '../chat/chat-realtime.publisher'
import { EmailService } from '../email/email.service'
import { PrismaService } from '../prisma/prisma.service'

export type NotificationMenuScope =
  | 'admin-certificates'
  | 'admin-vulnerabilities'
  | 'auditor-certificates'
  | 'auditor-retest'
  | 'auditor-review'
  | 'user-certificates'
  | 'user-vulnerabilities'

export type CreateNotificationInput = {
  channelId: string
  channelTitle: string
  content: string
  emailRequired?: boolean
  entityId?: string
  entityType?: 'Certificate' | 'SecurityEvent' | 'VulnerabilityReport'
  eventKey: string
  iconType: 'award' | 'bell' | 'megaphone' | 'shield'
  menuScope?: NotificationMenuScope
  recipientId: string
  route?: string
}

@Injectable()
export class NotificationDeliveryService {
  private readonly logger = new Logger(NotificationDeliveryService.name)

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EmailService) private readonly email: EmailService,
    @Inject(ChatRealtimePublisher) private readonly realtime: ChatRealtimePublisher,
  ) {}

  async create(tx: Prisma.TransactionClient, input: CreateNotificationInput) {
    const notification = await tx.platformNotification.upsert({
      where: { eventKey: input.eventKey },
      update: {},
      create: {
        channelId: input.channelId,
        channelTitle: input.channelTitle,
        content: input.content,
        emailRequired: input.emailRequired ?? false,
        emailStatus: input.emailRequired ? 'PENDING' : 'NOT_REQUIRED',
        entityId: input.entityId,
        entityType: input.entityType,
        eventKey: input.eventKey,
        iconType: input.iconType,
        menuScope: input.menuScope,
        recipientId: input.recipientId,
        route: input.route,
      },
      select: { id: true },
    })
    return notification.id
  }

  async createForRoles(
    tx: Prisma.TransactionClient,
    roles: RoleCode[],
    input: Omit<CreateNotificationInput, 'eventKey' | 'recipientId'> & { eventKeyPrefix: string },
  ) {
    const users = await tx.user.findMany({
      where: { deletedAt: null, role: { code: { in: roles } }, status: 'ACTIVE' },
      select: { id: true },
    })
    return Promise.all(users.map((recipient) => this.create(tx, {
      ...input,
      eventKey: `${input.eventKeyPrefix}:${recipient.id}`,
      recipientId: recipient.id,
    })))
  }

  async dispatchAfterCommit(ids: string[]) {
    try {
      const uniqueIds = [...new Set(ids)]
      if (uniqueIds.length === 0) return
      const notifications = await this.prisma.platformNotification.findMany({
        where: { id: { in: uniqueIds } },
        include: { recipient: { select: { email: true } } },
      })

      await Promise.all(notifications.map(async (notification) => {
        this.realtime.toUser(notification.recipientId, 'notification.created', {
          id: notification.id,
          menuScope: notification.menuScope,
        })
        if (!notification.emailRequired || notification.emailStatus !== 'PENDING') return
        await this.attemptEmail(notification)
      }))
    } catch (error) {
      this.logger.error(`post-commit notification dispatch failed: ${sanitizeDeliveryError(error)}`)
    }
  }

  private async attemptEmail(notification: {
    channelTitle: string
    content: string
    emailStatus: string
    id: string
    recipient: { email: string }
    recipientId: string
  }) {
    const claimed = await this.prisma.platformNotification.updateMany({
      where: { emailStatus: 'PENDING', id: notification.id },
      data: { emailAttemptedAt: new Date(), emailStatus: 'SENDING' },
    })
    if (claimed.count !== 1) return

    try {
      await this.email.sendPlatformNotification({
        body: `${notification.content}\n\n具体内容可能包含敏感信息，请登录平台后查看。此邮件由系统自动发送，请勿直接回复。`,
        subject: `CQUPT-SRC ${notification.channelTitle}`,
        to: notification.recipient.email,
      })
      await this.prisma.$transaction([
        this.prisma.platformNotification.update({
          where: { id: notification.id },
          data: { emailError: null, emailStatus: 'SENT' },
        }),
        this.prisma.auditLog.create({
          data: {
            action: AuditAction.NOTIFICATION_DELIVERY,
            metadata: { channel: notification.channelTitle, delivery: 'email' },
            result: 'success',
            targetId: notification.id,
            targetType: 'PlatformNotification',
          },
        }),
      ])
    } catch (error) {
      const message = sanitizeDeliveryError(error)
      this.logger.warn(`notification email failed: ${notification.id}: ${message}`)
      await this.prisma.$transaction([
        this.prisma.platformNotification.update({
          where: { id: notification.id },
          data: { emailError: message, emailStatus: 'FAILED' },
        }),
        this.prisma.auditLog.create({
          data: {
            action: AuditAction.NOTIFICATION_DELIVERY,
            metadata: { delivery: 'email', error: message },
            result: 'failed',
            targetId: notification.id,
            targetType: 'PlatformNotification',
          },
        }),
      ])
    }
  }
}

function sanitizeDeliveryError(error: unknown) {
  const raw = error instanceof Error ? error.message : 'unknown delivery error'
  return raw
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '***@***')
    .replace(/(pass(word)?|authorization|token|secret)\s*[:=]\s*\S+/gi, '$1=***')
    .slice(0, 500)
}
