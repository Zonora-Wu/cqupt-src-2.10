import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { AnnouncementRange, AnnouncementStatus, AuditAction, RoleCode } from '@prisma/client'
import { AuthenticatedRequestUser, ClientRequestMeta } from '../auth/auth.types'
import { PrismaService } from '../prisma/prisma.service'
import { NormalizedAnnouncementInput } from './announcement.types'

@Injectable()
export class AnnouncementsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listPublicAnnouncements() {
    const announcements = await this.prisma.announcement.findMany({
      where: {
        deletedAt: null,
        range: AnnouncementRange.ALL,
        status: AnnouncementStatus.PUBLISHED,
      },
      include: announcementInclude,
      orderBy: [{ pinned: 'desc' }, { publishedAt: 'desc' }, { updatedAt: 'desc' }],
      take: 100,
    })

    return {
      items: announcements.map(summarizeAnnouncement),
    }
  }

  async getPublicAnnouncement(id: string) {
    const announcement = await this.prisma.announcement.findFirst({
      where: {
        deletedAt: null,
        id,
        range: AnnouncementRange.ALL,
        status: AnnouncementStatus.PUBLISHED,
      },
      include: announcementInclude,
    })

    if (!announcement) {
      throw new NotFoundException('公告不存在或未公开')
    }

    return summarizeAnnouncement(announcement)
  }

  async listVisibleAnnouncements(user: AuthenticatedRequestUser) {
    const announcements = await this.prisma.announcement.findMany({
      where: {
        deletedAt: null,
        range: {
          in: visibleRangesForRole(user.role),
        },
        status: AnnouncementStatus.PUBLISHED,
      },
      include: announcementInclude,
      orderBy: [{ pinned: 'desc' }, { publishedAt: 'desc' }, { updatedAt: 'desc' }],
      take: 100,
    })

    return {
      items: announcements.map(summarizeAnnouncement),
    }
  }

  async getVisibleAnnouncement(id: string, user: AuthenticatedRequestUser) {
    const announcement = await this.prisma.announcement.findFirst({
      where: {
        deletedAt: null,
        id,
        range: {
          in: visibleRangesForRole(user.role),
        },
        status: AnnouncementStatus.PUBLISHED,
      },
      include: announcementInclude,
    })

    if (!announcement) {
      throw new NotFoundException('公告不存在或无权查看')
    }

    return summarizeAnnouncement(announcement)
  }

  async listManageAnnouncements() {
    const announcements = await this.prisma.announcement.findMany({
      where: {
        deletedAt: null,
      },
      include: announcementInclude,
      orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
      take: 200,
    })

    return {
      items: announcements.map(summarizeAnnouncement),
      stats: {
        draft: announcements.filter((item) => item.status === AnnouncementStatus.DRAFT).length,
        offline: announcements.filter((item) => item.status === AnnouncementStatus.OFFLINE).length,
        published: announcements.filter((item) => item.status === AnnouncementStatus.PUBLISHED).length,
        total: announcements.length,
      },
    }
  }

  async getManageAnnouncement(id: string) {
    const announcement = await this.prisma.announcement.findFirst({
      where: {
        deletedAt: null,
        id,
      },
      include: announcementInclude,
    })

    if (!announcement) {
      throw new NotFoundException('公告不存在')
    }

    return summarizeAnnouncement(announcement)
  }

  async createAnnouncement(
    input: NormalizedAnnouncementInput,
    user: AuthenticatedRequestUser,
    meta: ClientRequestMeta,
  ) {
    const created = await this.prisma.$transaction(async (tx) => {
      const announcement = await tx.announcement.create({
        data: {
          authorId: user.id,
          category: input.category,
          content: input.content,
          pinned: input.pinned,
          range: input.range,
          status: AnnouncementStatus.DRAFT,
          summary: input.summary,
          title: input.title,
        },
        include: announcementInclude,
      })

      await tx.auditLog.create({
        data: {
          action: AuditAction.PUBLISH_ANNOUNCEMENT,
          actorId: user.id,
          ipAddress: meta.ipAddress,
          metadata: {
            action: 'create_draft',
            range: input.range,
            title: input.title,
          },
          requestPath: meta.requestPath,
          result: 'success',
          targetId: announcement.id,
          targetType: 'Announcement',
          userAgent: meta.userAgent,
        },
      })

      return announcement
    })

    return summarizeAnnouncement(created)
  }

  async updateAnnouncement(
    id: string,
    input: NormalizedAnnouncementInput,
    user: AuthenticatedRequestUser,
    meta: ClientRequestMeta,
  ) {
    await this.assertAnnouncementExists(id)

    const updated = await this.prisma.$transaction(async (tx) => {
      const announcement = await tx.announcement.update({
        where: { id },
        data: {
          category: input.category,
          content: input.content,
          pinned: input.pinned,
          range: input.range,
          summary: input.summary,
          title: input.title,
        },
        include: announcementInclude,
      })

      await tx.auditLog.create({
        data: {
          action: AuditAction.PUBLISH_ANNOUNCEMENT,
          actorId: user.id,
          ipAddress: meta.ipAddress,
          metadata: {
            action: 'update',
            range: input.range,
            status: announcement.status,
            title: input.title,
          },
          requestPath: meta.requestPath,
          result: 'success',
          targetId: announcement.id,
          targetType: 'Announcement',
          userAgent: meta.userAgent,
        },
      })

      return announcement
    })

    return summarizeAnnouncement(updated)
  }

  async publishAnnouncement(id: string, user: AuthenticatedRequestUser, meta: ClientRequestMeta) {
    const existing = await this.assertAnnouncementExists(id)
    if (existing.status === AnnouncementStatus.PUBLISHED) {
      throw new BadRequestException('公告已经发布')
    }

    const publishedAt = new Date()
    const updated = await this.prisma.$transaction(async (tx) => {
      const announcement = await tx.announcement.update({
        where: { id },
        data: {
          offlineAt: null,
          publishedAt,
          status: AnnouncementStatus.PUBLISHED,
        },
        include: announcementInclude,
      })

      await tx.auditLog.create({
        data: {
          action: AuditAction.PUBLISH_ANNOUNCEMENT,
          actorId: user.id,
          ipAddress: meta.ipAddress,
          metadata: {
            action: 'publish',
            range: announcement.range,
            title: announcement.title,
          },
          requestPath: meta.requestPath,
          result: 'success',
          targetId: announcement.id,
          targetType: 'Announcement',
          userAgent: meta.userAgent,
        },
      })

      return announcement
    })

    return summarizeAnnouncement(updated)
  }

  async offlineAnnouncement(id: string, user: AuthenticatedRequestUser, meta: ClientRequestMeta) {
    const existing = await this.assertAnnouncementExists(id)
    if (existing.status === AnnouncementStatus.OFFLINE) {
      throw new BadRequestException('公告已经下线')
    }

    const offlineAt = new Date()
    const updated = await this.prisma.$transaction(async (tx) => {
      const announcement = await tx.announcement.update({
        where: { id },
        data: {
          offlineAt,
          status: AnnouncementStatus.OFFLINE,
        },
        include: announcementInclude,
      })

      await tx.auditLog.create({
        data: {
          action: AuditAction.PUBLISH_ANNOUNCEMENT,
          actorId: user.id,
          ipAddress: meta.ipAddress,
          metadata: {
            action: 'offline',
            range: announcement.range,
            title: announcement.title,
          },
          requestPath: meta.requestPath,
          result: 'success',
          targetId: announcement.id,
          targetType: 'Announcement',
          userAgent: meta.userAgent,
        },
      })

      return announcement
    })

    return summarizeAnnouncement(updated)
  }

  private async assertAnnouncementExists(id: string) {
    const announcement = await this.prisma.announcement.findFirst({
      where: {
        deletedAt: null,
        id,
      },
    })

    if (!announcement) {
      throw new NotFoundException('公告不存在')
    }

    return announcement
  }
}

const announcementInclude = {
  author: {
    select: {
      name: true,
      unifiedCode: true,
    },
  },
} as const

function visibleRangesForRole(role: RoleCode) {
  if (role === RoleCode.ADMIN) {
    return [AnnouncementRange.ALL, AnnouncementRange.ADMINS]
  }

  if (role === RoleCode.AUDITOR) {
    return [AnnouncementRange.ALL, AnnouncementRange.AUDITORS]
  }

  return [AnnouncementRange.ALL, AnnouncementRange.STUDENTS]
}

function summarizeAnnouncement(announcement: {
  author: { name: string; unifiedCode: string }
  category: string
  content: string
  createdAt: Date
  id: string
  offlineAt: Date | null
  pinned: boolean
  publishedAt: Date | null
  range: AnnouncementRange
  status: AnnouncementStatus
  summary: string
  title: string
  updatedAt: Date
}) {
  return {
    author: announcement.author.name,
    category: announcement.category,
    content: announcement.content,
    createdAt: announcement.createdAt,
    id: announcement.id,
    offlineAt: announcement.offlineAt,
    pinned: announcement.pinned,
    publishedAt: announcement.publishedAt,
    range: formatRange(announcement.range),
    rangeCode: announcement.range,
    readCount: 0,
    status: formatStatus(announcement.status),
    statusCode: announcement.status,
    summary: announcement.summary,
    title: announcement.title,
    updatedAt: announcement.updatedAt,
  }
}

function formatStatus(status: AnnouncementStatus) {
  const labelMap: Record<AnnouncementStatus, string> = {
    DRAFT: '草稿',
    OFFLINE: '已下架',
    PUBLISHED: '已发布',
  }

  return labelMap[status]
}

function formatRange(range: AnnouncementRange) {
  const labelMap: Record<AnnouncementRange, string> = {
    ADMINS: '管理员',
    ALL: '全体用户',
    AUDITORS: '审核员',
    STUDENTS: '学生用户',
  }

  return labelMap[range]
}

