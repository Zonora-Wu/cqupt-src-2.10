import { Inject, Injectable } from '@nestjs/common'
import { AnnouncementRange, AnnouncementStatus, AuditAction, PointDirection, RoleCode } from '@prisma/client'
import { AuthenticatedRequestUser } from '../auth/auth.types'
import { PrismaService } from '../prisma/prisma.service'

export type NotificationMessage = {
  id: string
  content: string
  createdAt: string
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
    const [auditMessages, pointMessages, systemMessages, announcementMessages] = await Promise.all([
      this.getAuditNotifications(user.id),
      this.getPointNotifications(user.id),
      this.getSystemNotifications(user.id),
      this.getAnnouncementNotifications(user.role),
    ])

    const channels: NotificationChannel[] = [
      { iconType: 'shield', id: 'audit', messages: auditMessages, title: '漏洞审核通知' },
      { iconType: 'award', id: 'points', messages: pointMessages, title: '积分变动' },
      { iconType: 'megaphone', id: 'announcement', messages: announcementMessages, title: '平台公告' },
      { iconType: 'bell', id: 'system', messages: systemMessages, title: '系统通知' },
    ]

    return { channels }
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
