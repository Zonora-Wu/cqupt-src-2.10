import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { AuditAction, LearningResourceKind } from '@prisma/client'
import { AuthenticatedRequestUser, ClientRequestMeta } from '../auth/auth.types'
import { PrismaService } from '../prisma/prisma.service'
import { NormalizedLearningResourceInput } from './learning.types'

type UploadedImageFile = {
  buffer?: Buffer
  mimetype?: string
  originalname?: string
  size?: number
}

@Injectable()
export class LearningService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listVisibleResources() {
    const resources = await this.prisma.learningResource.findMany({
      where: {
        active: true,
        deletedAt: null,
      },
      orderBy: [{ kind: 'asc' }, { category: 'asc' }, { updatedAt: 'desc' }],
      take: 200,
    })

    return {
      items: resources.map(summarizeResource),
      stats: summarizeStats(resources),
    }
  }

  async clickResource(id: string) {
    const resource = await this.prisma.learningResource.findFirst({
      where: {
        active: true,
        deletedAt: null,
        id,
      },
    })

    if (!resource) {
      throw new NotFoundException('资源不存在或已下架')
    }

    const updated = await this.prisma.learningResource.update({
      where: { id: resource.id },
      data: {
        downloadCount: {
          increment: 1,
        },
      },
    })

    return {
      downloadCount: updated.downloadCount,
      id: updated.id,
      url: updated.externalUrl,
    }
  }

  async listManageResources() {
    const resources = await this.prisma.learningResource.findMany({
      where: {
        deletedAt: null,
      },
      orderBy: [{ active: 'desc' }, { updatedAt: 'desc' }],
      take: 300,
    })

    return {
      items: resources.map(summarizeResource),
      stats: summarizeStats(resources),
    }
  }

  uploadCoverImage(file: UploadedImageFile) {
    const allowedMime = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!file.mimetype || !allowedMime.includes(file.mimetype)) {
      throw new BadRequestException('仅支持 JPG、PNG、WebP、GIF 格式的图片')
    }

    if (!file.buffer || !file.size) {
      throw new BadRequestException('文件内容为空')
    }

    if (file.size > 2 * 1024 * 1024) {
      throw new BadRequestException('图片大小不能超过 2MB')
    }

    const base64 = file.buffer.toString('base64')
    const coverUrl = `data:${file.mimetype};base64,${base64}`

    return { coverUrl }
  }

  async createResource(
    input: NormalizedLearningResourceInput,
    user: AuthenticatedRequestUser,
    meta: ClientRequestMeta,
  ) {
    const resource = await this.prisma.$transaction(async (tx) => {
      const created = await tx.learningResource.create({
        data: {
          active: input.active,
          category: input.category,
          coverUrl: input.coverUrl,
          description: input.description,
          externalUrl: input.externalUrl,
          kind: input.kind,
          title: input.title,
        },
      })

      await tx.auditLog.create({
        data: {
          action: AuditAction.MANAGE_LEARNING_RESOURCE,
          actorId: user.id,
          ipAddress: meta.ipAddress,
          metadata: {
            action: 'create',
            active: input.active,
            category: input.category,
            coverUrl: input.coverUrl,
            kind: input.kind,
            title: input.title,
          },
          requestPath: meta.requestPath,
          result: 'success',
          targetId: created.id,
          targetType: 'LearningResource',
          userAgent: meta.userAgent,
        },
      })

      return created
    })

    return summarizeResource(resource)
  }

  async updateResource(
    id: string,
    input: NormalizedLearningResourceInput,
    user: AuthenticatedRequestUser,
    meta: ClientRequestMeta,
  ) {
    await this.assertResourceExists(id)

    const resource = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.learningResource.update({
        where: { id },
        data: {
          active: input.active,
          category: input.category,
          coverUrl: input.coverUrl,
          description: input.description,
          externalUrl: input.externalUrl,
          kind: input.kind,
          title: input.title,
        },
      })

      await tx.auditLog.create({
        data: {
          action: AuditAction.MANAGE_LEARNING_RESOURCE,
          actorId: user.id,
          ipAddress: meta.ipAddress,
          metadata: {
            action: 'update',
            active: input.active,
            category: input.category,
            coverUrl: input.coverUrl,
            kind: input.kind,
            title: input.title,
          },
          requestPath: meta.requestPath,
          result: 'success',
          targetId: updated.id,
          targetType: 'LearningResource',
          userAgent: meta.userAgent,
        },
      })

      return updated
    })

    return summarizeResource(resource)
  }

  async setResourceActive(
    id: string,
    active: boolean,
    user: AuthenticatedRequestUser,
    meta: ClientRequestMeta,
  ) {
    await this.assertResourceExists(id)

    const resource = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.learningResource.update({
        where: { id },
        data: { active },
      })

      await tx.auditLog.create({
        data: {
          action: AuditAction.MANAGE_LEARNING_RESOURCE,
          actorId: user.id,
          ipAddress: meta.ipAddress,
          metadata: {
            action: active ? 'enable' : 'disable',
            title: updated.title,
          },
          requestPath: meta.requestPath,
          result: 'success',
          targetId: updated.id,
          targetType: 'LearningResource',
          userAgent: meta.userAgent,
        },
      })

      return updated
    })

    return summarizeResource(resource)
  }

  async deleteResource(id: string, user: AuthenticatedRequestUser, meta: ClientRequestMeta) {
    const existing = await this.assertResourceExists(id)

    if (existing.deletedAt) {
      throw new BadRequestException('资源已删除')
    }

    const deleted = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.learningResource.update({
        where: { id },
        data: {
          active: false,
          deletedAt: new Date(),
        },
      })

      await tx.auditLog.create({
        data: {
          action: AuditAction.MANAGE_LEARNING_RESOURCE,
          actorId: user.id,
          ipAddress: meta.ipAddress,
          metadata: {
            action: 'delete',
            title: updated.title,
          },
          requestPath: meta.requestPath,
          result: 'success',
          targetId: updated.id,
          targetType: 'LearningResource',
          userAgent: meta.userAgent,
        },
      })

      return updated
    })

    return summarizeResource(deleted)
  }

  private async assertResourceExists(id: string) {
    const resource = await this.prisma.learningResource.findFirst({
      where: {
        deletedAt: null,
        id,
      },
    })

    if (!resource) {
      throw new NotFoundException('资源不存在')
    }

    return resource
  }
}

function summarizeResource(resource: {
  active: boolean
  category: string
  coverUrl: string | null
  createdAt: Date
  description: string | null
  downloadCount: number
  externalUrl: string
  id: string
  kind: LearningResourceKind
  title: string
  updatedAt: Date
}) {
  return {
    active: resource.active,
    category: resource.category,
    coverUrl: resource.coverUrl ?? '',
    createdAt: resource.createdAt,
    description: resource.description ?? '',
    downloadCount: resource.downloadCount,
    externalUrl: resource.externalUrl,
    id: resource.id,
    kind: resource.kind,
    kindLabel: resource.kind === LearningResourceKind.RANGE ? '靶场资源' : '工具资料',
    status: resource.active ? '已上架' : '已下架',
    title: resource.title,
    updatedAt: resource.updatedAt,
  }
}

function summarizeStats(
  resources: Array<{
    active: boolean
    kind: LearningResourceKind
  }>,
) {
  return {
    active: resources.filter((item) => item.active).length,
    range: resources.filter((item) => item.kind === LearningResourceKind.RANGE).length,
    resource: resources.filter((item) => item.kind === LearningResourceKind.RESOURCE).length,
    total: resources.length,
  }
}
