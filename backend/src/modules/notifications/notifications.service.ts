import { Inject, Injectable } from '@nestjs/common'
import { AnnouncementRange, AnnouncementStatus, AuditAction, PointDirection, RoleCode, UserStatus, VulnerabilityStatus } from '@prisma/client'
import { AuthenticatedRequestUser } from '../auth/auth.types'
import { PrismaService } from '../prisma/prisma.service'

export type NotificationMessage = {
  id: string
  content: string
  createdAt: string
  entityId?: string | null
  entityType?: string | null
  readAt?: string | null
  route?: string | null
}

export type NotificationChannel = {
  iconType: 'award' | 'bell' | 'megaphone' | 'shield'
  id: string
  messages: NotificationMessage[]
  title: string
}

@Injectable()
export class NotificationsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getNotifications(user: AuthenticatedRequestUser) {
    const [persistent, auditMessages, pointMessages, systemMessages, announcementMessages] = await Promise.all([
      this.prisma.platformNotification.findMany({
        where: { recipientId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      this.getAuditNotifications(user.id),
      this.getPointNotifications(user.id),
      this.getSystemNotifications(user.id),
      this.getAnnouncementNotifications(user.role),
    ])

    const persistentEntityIds = new Set(persistent.map((item) => item.entityId).filter(Boolean))
    const channels: NotificationChannel[] = [
      { iconType: 'shield', id: 'audit', messages: auditMessages.filter((item) => !item.entityId || !persistentEntityIds.has(item.entityId)), title: '漏洞审核通知' },
      { iconType: 'award', id: 'points', messages: pointMessages, title: '积分变动' },
      { iconType: 'megaphone', id: 'announcement', messages: announcementMessages, title: '平台公告' },
      { iconType: 'bell', id: 'system', messages: systemMessages, title: '系统通知' },
    ]

    if (user.role === RoleCode.ADMIN) {
      const [pendingRegMessages, pendingVulnMessages] = await Promise.all([
        this.getAdminPendingRegistrationNotifications(),
        this.getAdminPendingVulnerabilityNotifications(),
      ])
      channels.unshift(
        { iconType: 'bell', id: 'pending-registration', messages: pendingRegMessages, title: '待审核注册申请' },
        { iconType: 'shield', id: 'pending-vuln', messages: pendingVulnMessages.filter((item) => !item.entityId || !persistentEntityIds.has(item.entityId)), title: '待处理漏洞报告' },
      )
    }

    if (user.role === RoleCode.AUDITOR) {
      const [pendingReviewMessages, pendingRetestMessages] = await Promise.all([
        this.getAuditorPendingReviewNotifications(),
        this.getAuditorPendingRetestNotifications(),
      ])
      channels.unshift(
        { iconType: 'shield', id: 'pending-review', messages: pendingReviewMessages.filter((item) => !item.entityId || !persistentEntityIds.has(item.entityId)), title: '待初审漏洞' },
        { iconType: 'bell', id: 'pending-retest', messages: pendingRetestMessages.filter((item) => !item.entityId || !persistentEntityIds.has(item.entityId)), title: '待复测漏洞' },
      )
    }

    for (const notification of persistent) {
      let channel = channels.find((item) => item.id === notification.channelId)
      if (!channel) {
        channel = {
          iconType: normalizeIconType(notification.iconType),
          id: notification.channelId,
          messages: [],
          title: notification.channelTitle,
        }
        channels.unshift(channel)
      }
      channel.messages.push({
        content: notification.content,
        createdAt: notification.createdAt.toISOString(),
        entityId: notification.entityId,
        entityType: notification.entityType,
        id: notification.id,
        readAt: notification.readAt?.toISOString() ?? null,
        route: notification.route,
      })
    }
    for (const channel of channels) {
      channel.messages.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    }

    const unreadRows = persistent.filter((item) => !item.readAt)
    const menu: Record<string, number> = {}
    for (const item of unreadRows) {
      if (item.menuScope) menu[item.menuScope] = (menu[item.menuScope] ?? 0) + 1
    }
    return { channels, unread: { bell: unreadRows.length, menu } }
  }

  async markRead(userId: string, notificationId: string) {
    await this.prisma.platformNotification.updateMany({
      where: { id: notificationId, recipientId: userId, readAt: null },
      data: { readAt: new Date() },
    })
    return { success: true }
  }

  async markChannelRead(userId: string, channelId: string) {
    await this.prisma.platformNotification.updateMany({
      where: { channelId, recipientId: userId, readAt: null },
      data: { readAt: new Date() },
    })
    return { success: true }
  }

  async markEntityRead(userId: string, entityType: string, entityId: string) {
    await this.prisma.platformNotification.updateMany({
      where: { entityId, entityType, recipientId: userId, readAt: null },
      data: { readAt: new Date() },
    })
    return { success: true }
  }

  private async getAuditNotifications(userId: string) {
    const events = await this.prisma.vulnerabilityEvent.findMany({
      where: {
        action: { not: 'SUBMIT_VULNERABILITY' },
        report: { submitterId: userId },
      },
      include: {
        report: { select: { reportNo: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    return events.map((event) => ({
      content: formatAuditMessage(event.action, event.report.title, event.note),
      createdAt: event.createdAt.toISOString(),
      entityId: event.reportId,
      entityType: 'VulnerabilityReport',
      id: event.id,
    }))
  }

  private async getPointNotifications(userId: string) {
    const entries = await this.prisma.pointLedgerEntry.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    return entries.map((entry) => ({
      content: formatPointMessage(entry.direction, entry.points, entry.balanceAfter, entry.reason),
      createdAt: entry.createdAt.toISOString(),
      id: entry.id,
    }))
  }

  private async getSystemNotifications(userId: string) {
    const logs = await this.prisma.auditLog.findMany({
      where: {
        action: {
          in: [
            AuditAction.LOGIN,
            AuditAction.MANAGE_USER,
            AuditAction.CHANGE_USER_PERMISSION,
          ],
        },
        OR: [
          { actorId: userId, action: AuditAction.LOGIN },
          { targetId: userId, targetType: 'User' },
        ],
        result: 'success',
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return logs.map((log) => ({
      content: formatSystemMessage(log.action, log.metadata, log.ipAddress),
      createdAt: log.createdAt.toISOString(),
      id: log.id,
    }))
  }

  private async getAnnouncementNotifications(role: RoleCode) {
    const announcements = await this.prisma.announcement.findMany({
      where: {
        deletedAt: null,
        range: { in: visibleRangesForRole(role) },
        status: AnnouncementStatus.PUBLISHED,
      },
      orderBy: [{ pinned: 'desc' }, { publishedAt: 'desc' }],
      take: 50,
    })

    return announcements.map((a) => ({
      content: `【${a.category}】${a.title}：${a.summary}`,
      createdAt: (a.publishedAt ?? a.createdAt).toISOString(),
      id: a.id,
    }))
  }

  private async getAdminPendingRegistrationNotifications() {
    const users = await this.prisma.user.findMany({
      where: { pendingRegistrationApproval: true, status: UserStatus.PENDING },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, name: true, college: true, identityText: true, createdAt: true },
    })

    return users.map((u) => ({
      content: `新注册申请：${u.name}（${u.college ?? '未知学院'} · ${u.identityText ?? ''}）待审核，请前往「系统设置 → 待审核注册申请」处理。`,
      createdAt: u.createdAt.toISOString(),
      id: `pending-reg-${u.id}`,
    }))
  }

  private async getAdminPendingVulnerabilityNotifications() {
    const reports = await this.prisma.vulnerabilityReport.findMany({
      where: { status: { in: [VulnerabilityStatus.SUBMITTED, VulnerabilityStatus.PENDING_REVIEW] } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, reportNo: true, title: true, status: true, createdAt: true },
    })

    return reports.map((r) => ({
      content: `漏洞报告「${r.title}」（${r.reportNo}）已提交，请及时跟进审核。`,
      createdAt: r.createdAt.toISOString(),
      entityId: r.id,
      entityType: 'VulnerabilityReport',
      id: `pending-vuln-${r.id}`,
    }))
  }

  private async getAuditorPendingReviewNotifications() {
    const reports = await this.prisma.vulnerabilityReport.findMany({
      where: { status: { in: [VulnerabilityStatus.SUBMITTED, VulnerabilityStatus.PENDING_REVIEW] } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, reportNo: true, title: true, status: true, createdAt: true },
    })

    return reports.map((r) => ({
      content: `漏洞报告「${r.title}」（${r.reportNo}）待审核，请及时处理。`,
      createdAt: r.createdAt.toISOString(),
      entityId: r.id,
      entityType: 'VulnerabilityReport',
      id: `review-${r.id}`,
    }))
  }

  private async getAuditorPendingRetestNotifications() {
    const reports = await this.prisma.vulnerabilityReport.findMany({
      where: { status: VulnerabilityStatus.PENDING_RETEST },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: { id: true, reportNo: true, title: true, updatedAt: true },
    })

    return reports.map((r) => ({
      content: `漏洞报告「${r.title}」（${r.reportNo}）已标记待复测，请前往「复测归档」完成验证。`,
      createdAt: r.updatedAt.toISOString(),
      entityId: r.id,
      entityType: 'VulnerabilityReport',
      id: `retest-${r.id}`,
    }))
  }
}

function normalizeIconType(value: string): NotificationChannel['iconType'] {
  return value === 'award' || value === 'megaphone' || value === 'shield' ? value : 'bell'
}

function formatAuditMessage(action: string, reportTitle: string, note: string | null): string {
  const actionLabelMap: Record<string, string> = {
    ARCHIVE: '已归档',
    ASSIGN_REVIEWER: '已分派审核员',
    CLOSE: '已关闭',
    RETEST_FAIL: '复测未通过',
    RETEST_PASS: '复测通过',
    REVIEW_CONFIRM: '审核通过',
    REVIEW_NEEDS_SUPPLEMENT: '需要补充材料',
    REVIEW_REJECT: '审核驳回',
  }

  const label = actionLabelMap[action] ?? action
  const base = `你的漏洞报告「${reportTitle}」${label}。`
  if (note && note.trim()) {
    return `${base}审核备注：${note.trim()}`
  }

  return base
}

function formatPointMessage(
  direction: PointDirection,
  points: number,
  balanceAfter: number,
  reason: string,
): string {
  if (direction === PointDirection.IN) {
    return `积分增加 +${points}，当前余额 ${balanceAfter}。原因：${reason}`
  }

  if (direction === PointDirection.OUT) {
    return `积分扣除 -${points}，当前余额 ${balanceAfter}。原因：${reason}`
  }

  // ADJUST
  return `积分调整，当前余额 ${balanceAfter}。原因：${reason}`
}

function formatSystemMessage(action: AuditAction, metadata: unknown, ipAddress: string | null): string {
  if (action === AuditAction.LOGIN) {
    return `账号登录成功。IP：${ipAddress ?? '未知'}。如非本人操作，请立即修改密码并联系管理员。`
  }

  if (action === AuditAction.MANAGE_USER) {
    const meta = metadata as Record<string, unknown> | null
    const reason = typeof meta?.reason === 'string' ? meta.reason : ''
    return reason ? `账号状态或信息已被管理员变更。备注：${reason}` : '账号状态或信息已被管理员变更。'
  }

  if (action === AuditAction.CHANGE_USER_PERMISSION) {
    const meta = metadata as Record<string, unknown> | null
    const reason = typeof meta?.reason === 'string' ? meta.reason : ''
    return reason ? `账号权限已被管理员调整。备注：${reason}` : '账号权限已被管理员调整。'
  }

  return '系统通知'
}

function visibleRangesForRole(role: RoleCode): AnnouncementRange[] {
  if (role === RoleCode.ADMIN) return [AnnouncementRange.ALL, AnnouncementRange.ADMINS]
  if (role === RoleCode.AUDITOR) return [AnnouncementRange.ALL, AnnouncementRange.AUDITORS]
  return [AnnouncementRange.ALL, AnnouncementRange.STUDENTS]
}
