import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import {
  AuditAction,
  MallProduct,
  MallProductStatus,
  MallRedemption,
  MallRedemptionStatus,
  PointDirection,
  Prisma,
  RoleCode,
  UserStatus,
  VulnerabilityStatus,
} from '@prisma/client'
import { AuthenticatedRequestUser, ClientRequestMeta } from '../auth/auth.types'
import { PrismaService } from '../prisma/prisma.service'
import {
  NormalizedMallProductInput,
  productStatusLabelMap,
  redemptionStatusLabelMap,
} from './points-mall.types'
import { getLeaderboardRangeStart, rankLeaderboard } from './leaderboard.utils'

type UploadedImageFile = {
  buffer?: Buffer
  mimetype?: string
  originalname?: string
  size?: number
}

@Injectable()
export class PointsMallService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getPointSummary(user: AuthenticatedRequestUser) {
    const entries = await this.prisma.pointLedgerEntry.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })
    const pendingRedemptions = await this.prisma.mallRedemption.count({
      where: {
        status: MallRedemptionStatus.PENDING_PICKUP,
        userId: user.id,
      },
    })

    const balance = entries[0]?.balanceAfter ?? 0
    const earned = entries.filter((entry) => entry.direction === PointDirection.IN).reduce((total, entry) => total + entry.points, 0)
    const spent = entries.filter((entry) => entry.direction === PointDirection.OUT).reduce((total, entry) => total + entry.points, 0)
    const adjusted = entries.filter((entry) => entry.direction === PointDirection.ADJUST).reduce((total, entry) => total + entry.points, 0)

    return {
      adjusted,
      balance,
      earned,
      pendingRedemptions,
      spent,
    }
  }

  async listMyPointLedger(user: AuthenticatedRequestUser) {
    const entries = await this.prisma.pointLedgerEntry.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        balanceAfter: true,
        createdAt: true,
        direction: true,
        id: true,
        note: true,
        points: true,
        reason: true,
      },
      take: 100,
    })

    return {
      items: entries.map((entry) => ({
        ...entry,
        directionLabel: formatPointDirection(entry.direction),
      })),
    }
  }

  async listVisibleProducts(user: AuthenticatedRequestUser) {
    const products = await this.prisma.mallProduct.findMany({
      where: {
        deletedAt: null,
        status: MallProductStatus.ACTIVE,
      },
      orderBy: [{ sortOrder: 'desc' }, { updatedAt: 'desc' }],
      take: 200,
    })
    const balance = await getCurrentPointBalance(this.prisma, user.id)

    return {
      items: products.map((product) => summarizeProduct(product, balance)),
      stats: summarizeProductStats(products),
    }
  }

  async listMyRedemptions(user: AuthenticatedRequestUser) {
    const redemptions = await this.prisma.mallRedemption.findMany({
      where: { userId: user.id },
      include: { product: true },
      orderBy: { requestedAt: 'desc' },
      take: 100,
    })

    return {
      items: redemptions.map(summarizeRedemption),
    }
  }

  async createRedemption(productId: string, user: AuthenticatedRequestUser) {
    return this.prisma.$transaction(
      async (tx) => {
        const product = await tx.mallProduct.findFirst({
          where: {
            deletedAt: null,
            id: productId,
            status: MallProductStatus.ACTIVE,
          },
        })

        if (!product) {
          throw new NotFoundException('商品不存在或已下架')
        }

        if (product.stock <= 0) {
          throw new BadRequestException('商品库存不足')
        }

        const redeemedCount = await tx.mallRedemption.count({
          where: {
            productId: product.id,
            status: {
              in: [MallRedemptionStatus.PENDING_PICKUP, MallRedemptionStatus.COMPLETED],
            },
            userId: user.id,
          },
        })

        if (product.perUserLimit > 0 && redeemedCount >= product.perUserLimit) {
          throw new BadRequestException('已达到该商品每人限兑数量')
        }

        const currentBalance = await getCurrentPointBalance(tx, user.id)
        if (currentBalance < product.pointsCost) {
          throw new BadRequestException('积分不足')
        }

        await tx.mallProduct.update({
          where: { id: product.id },
          data: {
            stock: {
              decrement: 1,
            },
          },
        })

        const redemption = await tx.mallRedemption.create({
          data: {
            expiresAt: addDays(new Date(), 30),
            note: `请前往${product.pickupLocation ?? '蓝山工作室'}线下领取。`,
            pickupCode: await generatePickupCode(tx),
            pointsCost: product.pointsCost,
            productId: product.id,
            status: MallRedemptionStatus.PENDING_PICKUP,
            userId: user.id,
          },
          include: { product: true },
        })

        await tx.pointLedgerEntry.create({
          data: {
            balanceAfter: currentBalance - product.pointsCost,
            direction: PointDirection.OUT,
            note: `兑换商品：${product.name}`,
            points: product.pointsCost,
            reason: '积分商城兑换',
            redemptionId: redemption.id,
            userId: user.id,
          },
        })

        await tx.mallRedemptionEvent.create({
          data: {
            redemptionId: redemption.id,
            toStatus: MallRedemptionStatus.PENDING_PICKUP,
            note: '用户提交兑换申请，等待线下领取。',
            actorId: user.id,
          },
        })

        return summarizeRedemption(redemption)
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    )
  }

  async listManageProducts() {
    const products = await this.prisma.mallProduct.findMany({
      where: { deletedAt: null },
      orderBy: [{ sortOrder: 'desc' }, { updatedAt: 'desc' }],
      take: 300,
    })

    return {
      items: products.map((product) => summarizeProduct(product)),
      stats: summarizeProductStats(products),
    }
  }

  async createProduct(input: NormalizedMallProductInput, user: AuthenticatedRequestUser, meta: ClientRequestMeta) {
    const product = await this.prisma.$transaction(async (tx) => {
      const created = await tx.mallProduct.create({
        data: {
          ...input,
          createdById: user.id,
        },
      })

      await createMallAudit(tx, user, meta, created.id, 'create', {
        name: created.name,
        status: created.status,
      })

      return created
    })

    return summarizeProduct(product)
  }

  async updateProduct(
    id: string,
    input: NormalizedMallProductInput,
    user: AuthenticatedRequestUser,
    meta: ClientRequestMeta,
  ) {
    await this.assertProductExists(id)

    const product = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.mallProduct.update({
        where: { id },
        data: input,
      })

      await createMallAudit(tx, user, meta, updated.id, 'update', {
        name: updated.name,
        status: updated.status,
      })

      return updated
    })

    return summarizeProduct(product)
  }

  async setProductStatus(
    id: string,
    status: MallProductStatus,
    user: AuthenticatedRequestUser,
    meta: ClientRequestMeta,
  ) {
    const existing = await this.assertProductExists(id)

    if (status === MallProductStatus.ACTIVE && existing.stock <= 0) {
      throw new BadRequestException('库存为 0 的商品不能上架')
    }

    const product = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.mallProduct.update({
        where: { id },
        data: { status },
      })

      await createMallAudit(tx, user, meta, updated.id, status === MallProductStatus.ACTIVE ? 'activate' : 'deactivate', {
        name: updated.name,
        status,
      })

      return updated
    })

    return summarizeProduct(product)
  }

  uploadProductImage(file: UploadedImageFile) {
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
    const imageUrl = `data:${file.mimetype};base64,${base64}`

    return { imageUrl }
  }

  async deleteProduct(id: string, user: AuthenticatedRequestUser, meta: ClientRequestMeta) {
    const existing = await this.assertProductExists(id)
    const activeRedemptions = await this.prisma.mallRedemption.count({
      where: {
        productId: existing.id,
        status: MallRedemptionStatus.PENDING_PICKUP,
      },
    })

    if (activeRedemptions > 0) {
      throw new BadRequestException('该商品仍有待领取兑换记录，不能删除')
    }

    const product = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.mallProduct.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          status: MallProductStatus.INACTIVE,
        },
      })

      await createMallAudit(tx, user, meta, updated.id, 'delete', {
        name: updated.name,
      })

      return updated
    })

    return summarizeProduct(product)
  }

  async listManageRedemptions() {
    const redemptions = await this.prisma.mallRedemption.findMany({
      include: {
        product: true,
        user: {
          select: {
            email: true,
            name: true,
            unifiedCode: true,
          },
        },
      },
      orderBy: { requestedAt: 'desc' },
      take: 300,
    })

    return {
      items: redemptions.map(summarizeManagedRedemption),
    }
  }

  async completeRedemption(id: string, note: string, user: AuthenticatedRequestUser, meta: ClientRequestMeta) {
    return this.transitionRedemption(id, MallRedemptionStatus.COMPLETED, note || '已在蓝山工作室线下领取。', user, meta)
  }

  async cancelRedemption(id: string, note: string, user: AuthenticatedRequestUser, meta: ClientRequestMeta) {
    return this.prisma.$transaction(
      async (tx) => {
        const redemption = await tx.mallRedemption.findUnique({
          where: { id },
          include: { product: true },
        })

        if (!redemption) {
          throw new NotFoundException('兑换记录不存在')
        }

        if (redemption.status !== MallRedemptionStatus.PENDING_PICKUP) {
          throw new BadRequestException('只有待领取兑换记录可以取消')
        }

        const currentBalance = await getCurrentPointBalance(tx, redemption.userId)

        const updated = await tx.mallRedemption.update({
          where: { id },
          data: {
            canceledAt: new Date(),
            handlerId: user.id,
            note: note || '管理员取消兑换并返还积分。',
            status: MallRedemptionStatus.CANCELED,
          },
          include: { product: true },
        })

        await tx.mallProduct.update({
          where: { id: redemption.productId },
          data: {
            stock: {
              increment: 1,
            },
          },
        })

        await tx.pointLedgerEntry.create({
          data: {
            balanceAfter: currentBalance + redemption.pointsCost,
            direction: PointDirection.IN,
            note: `取消兑换返还：${redemption.product.name}`,
            operatorId: user.id,
            points: redemption.pointsCost,
            reason: '兑换取消返还',
            redemptionId: redemption.id,
            userId: redemption.userId,
          },
        })

        await tx.mallRedemptionEvent.create({
          data: {
            actorId: user.id,
            fromStatus: MallRedemptionStatus.PENDING_PICKUP,
            note: note || '管理员取消兑换并返还积分。',
            redemptionId: redemption.id,
            toStatus: MallRedemptionStatus.CANCELED,
          },
        })

        await createMallAudit(tx, user, meta, redemption.id, 'cancel_redemption', {
          pickupCode: redemption.pickupCode,
          productName: redemption.product.name,
        })

        return summarizeRedemption(updated)
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    )
  }

  private async transitionRedemption(
    id: string,
    nextStatus: MallRedemptionStatus,
    note: string,
    user: AuthenticatedRequestUser,
    meta: ClientRequestMeta,
  ) {
    const redemption = await this.prisma.mallRedemption.findUnique({
      where: { id },
      include: { product: true },
    })

    if (!redemption) {
      throw new NotFoundException('兑换记录不存在')
    }

    if (redemption.status !== MallRedemptionStatus.PENDING_PICKUP) {
      throw new BadRequestException('只有待领取兑换记录可以确认领取')
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.mallRedemption.update({
        where: { id },
        data: {
          completedAt: new Date(),
          handlerId: user.id,
          note,
          status: nextStatus,
        },
        include: { product: true },
      })

      await tx.mallRedemptionEvent.create({
        data: {
          actorId: user.id,
          fromStatus: redemption.status,
          note,
          redemptionId: redemption.id,
          toStatus: nextStatus,
        },
      })

      await createMallAudit(tx, user, meta, redemption.id, 'complete_redemption', {
        pickupCode: redemption.pickupCode,
        productName: redemption.product.name,
      })

      return next
    })

    return summarizeRedemption(updated)
  }

  private async assertProductExists(id: string) {
    const product = await this.prisma.mallProduct.findFirst({
      where: {
        deletedAt: null,
        id,
      },
    })

    if (!product) {
      throw new NotFoundException('商品不存在')
    }

    return product
  }

  async getLeaderboard(scope: 'all' | 'month' | 'week', currentUserId: string) {
    const rangeStart = getLeaderboardRangeStart(scope)
    const validStatuses = [
      VulnerabilityStatus.CONFIRMED,
      VulnerabilityStatus.FIXING,
      VulnerabilityStatus.PENDING_RETEST,
      VulnerabilityStatus.ARCHIVED,
      VulnerabilityStatus.CERTIFIED,
    ]
    const [entries, currentUser] = await Promise.all([
      this.prisma.pointLedgerEntry.findMany({
        where: {
          direction: PointDirection.IN,
          reportId: { not: null },
          ...(rangeStart ? { createdAt: { gte: rangeStart } } : {}),
          report: {
            is: {
              deletedAt: null,
              status: { in: validStatuses },
            },
          },
          user: {
            deletedAt: null,
            role: { code: RoleCode.STUDENT },
            status: UserStatus.ACTIVE,
          },
        },
        orderBy: { createdAt: 'asc' },
        select: {
          createdAt: true,
          points: true,
          report: { select: { finalSeverity: true, id: true, selfSeverity: true } },
          user: { select: { avatarUrl: true, id: true, name: true } },
        },
      }),
      this.prisma.user.findFirst({
        where: {
          id: currentUserId,
          deletedAt: null,
          role: { code: RoleCode.STUDENT },
          status: UserStatus.ACTIVE,
        },
        select: { avatarUrl: true, id: true, name: true },
      }),
    ])

    const aggregates = new Map<string, {
      achievedAt: Date
      avatarUrl: string | null
      highSeverityReportIds: Set<string>
      id: string
      name: string
      reportIds: Set<string>
      score: number
    }>()

    for (const entry of entries) {
      if (!entry.report) continue
      const aggregate = aggregates.get(entry.user.id) ?? {
        achievedAt: entry.createdAt,
        avatarUrl: entry.user.avatarUrl,
        highSeverityReportIds: new Set<string>(),
        id: entry.user.id,
        name: entry.user.name,
        reportIds: new Set<string>(),
        score: 0,
      }
      aggregate.score += entry.points
      aggregate.achievedAt = entry.createdAt
      aggregate.reportIds.add(entry.report.id)
      const severity = entry.report.finalSeverity ?? entry.report.selfSeverity
      if (severity === 'HIGH' || severity === 'CRITICAL') {
        aggregate.highSeverityReportIds.add(entry.report.id)
      }
      aggregates.set(entry.user.id, aggregate)
    }

    const ranked = rankLeaderboard(
      [...aggregates.values()]
        .filter((user) => user.score > 0)
        .map((user) => ({
          achievedAt: user.achievedAt,
          avatarUrl: user.avatarUrl,
          highSeverityReports: user.highSeverityReportIds.size,
          id: user.id,
          name: maskName(user.name),
          reports: user.reportIds.size,
          score: user.score,
        })),
    )
    const currentRank = ranked.find((entry) => entry.id === currentUserId)
    const me = currentRank ?? (currentUser ? {
      avatarUrl: currentUser.avatarUrl,
      id: currentUser.id,
      name: maskName(currentUser.name),
      rank: null,
      reports: 0,
      score: 0,
    } : null)

    return {
      items: ranked.slice(0, 100).map((entry) => ({
        avatarUrl: entry.avatarUrl,
        id: entry.id,
        isCurrent: entry.id === currentUserId,
        name: entry.name,
        rank: entry.rank,
        reports: entry.reports,
        score: entry.score,
      })),
      me: me ? {
        avatarUrl: me.avatarUrl,
        id: me.id,
        isCurrent: true,
        name: me.name,
        rank: me.rank,
        reports: me.reports,
        score: me.score,
      } : null,
    }
  }
}

function summarizeProduct(product: MallProduct, userBalance?: number) {
  return {
    canRedeem: userBalance === undefined ? undefined : product.status === MallProductStatus.ACTIVE && product.stock > 0 && userBalance >= product.pointsCost,
    category: product.category,
    createdAt: product.createdAt,
    description: product.description ?? '',
    id: product.id,
    imageUrl: product.imageUrl ?? '',
    name: product.name,
    perUserLimit: product.perUserLimit,
    pickupInstructions: product.pickupInstructions ?? '',
    pickupLocation: product.pickupLocation ?? '蓝山工作室',
    pointsCost: product.pointsCost,
    sortOrder: product.sortOrder,
    status: product.status,
    statusLabel: productStatusLabelMap[product.status],
    stock: product.stock,
    updatedAt: product.updatedAt,
  }
}

function summarizeProductStats(products: MallProduct[]) {
  return {
    active: products.filter((product) => product.status === MallProductStatus.ACTIVE).length,
    total: products.length,
  }
}

function summarizeRedemption(redemption: MallRedemption & { product: MallProduct }) {
  return {
    canceledAt: redemption.canceledAt,
    completedAt: redemption.completedAt,
    expiresAt: redemption.expiresAt,
    id: redemption.id,
    note: redemption.note ?? '',
    pickupCode: redemption.pickupCode,
    pointsCost: redemption.pointsCost,
    product: summarizeProduct(redemption.product),
    requestedAt: redemption.requestedAt,
    status: redemption.status,
    statusLabel: redemptionStatusLabelMap[redemption.status],
  }
}

function summarizeManagedRedemption(
  redemption: MallRedemption & {
    product: MallProduct
    user: {
      email: string
      name: string
      unifiedCode: string
    }
  },
) {
  return {
    ...summarizeRedemption(redemption),
    user: redemption.user,
  }
}

async function getCurrentPointBalance(
  tx: Pick<Prisma.TransactionClient, 'pointLedgerEntry'> | Pick<PrismaService, 'pointLedgerEntry'>,
  userId: string,
) {
  const latestEntry = await tx.pointLedgerEntry.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { balanceAfter: true },
  })

  return latestEntry?.balanceAfter ?? 0
}

async function generatePickupCode(tx: Pick<Prisma.TransactionClient, 'mallRedemption'>) {
  for (let index = 0; index < 8; index += 1) {
    const code = `SRC-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
    const exists = await tx.mallRedemption.findUnique({ where: { pickupCode: code } })
    if (!exists) return code
  }

  throw new BadRequestException('领取码生成失败，请稍后重试')
}

async function createMallAudit(
  tx: Pick<Prisma.TransactionClient, 'auditLog'>,
  user: AuthenticatedRequestUser,
  meta: ClientRequestMeta,
  targetId: string,
  action: string,
  metadata: Record<string, unknown>,
) {
  await tx.auditLog.create({
    data: {
      action: AuditAction.MANAGE_MALL,
      actorId: user.id,
      ipAddress: meta.ipAddress,
      metadata: {
        action,
        ...metadata,
      },
      requestPath: meta.requestPath,
      result: 'success',
      targetId,
      targetType: 'Mall',
      userAgent: meta.userAgent,
    },
  })
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function formatPointDirection(direction: PointDirection) {
  if (direction === PointDirection.IN) return '收入'
  if (direction === PointDirection.OUT) return '支出'
  return '调整'
}

/** 展示脱敏后的用户名：保留首字+「同学」，防止隐私泄露 */
function maskName(name: string) {
  if (!name) return '同学'
  return `${name.charAt(0)}同学`
}
