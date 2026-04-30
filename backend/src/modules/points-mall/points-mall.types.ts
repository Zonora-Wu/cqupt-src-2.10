import { MallProductStatus, MallRedemptionStatus } from '@prisma/client'

export type MallProductBody = {
  category?: unknown
  description?: unknown
  imageUrl?: unknown
  name?: unknown
  perUserLimit?: unknown
  pickupInstructions?: unknown
  pickupLocation?: unknown
  pointsCost?: unknown
  sortOrder?: unknown
  status?: unknown
  stock?: unknown
}

export type NormalizedMallProductInput = {
  category: string
  description: string
  imageUrl: string | null
  name: string
  perUserLimit: number
  pickupInstructions: string
  pickupLocation: string
  pointsCost: number
  sortOrder: number
  status: MallProductStatus
  stock: number
}

export type MallRedemptionBody = {
  productId?: unknown
}

export type MallHandleRedemptionBody = {
  note?: unknown
}

export type RedemptionStatusLabel = '待领取' | '已领取' | '已取消' | '已过期'

export const redemptionStatusLabelMap: Record<MallRedemptionStatus, RedemptionStatusLabel> = {
  CANCELED: '已取消',
  COMPLETED: '已领取',
  EXPIRED: '已过期',
  PENDING_PICKUP: '待领取',
}

export const productStatusLabelMap: Record<MallProductStatus, '草稿' | '已上架' | '已下架'> = {
  ACTIVE: '已上架',
  DRAFT: '草稿',
  INACTIVE: '已下架',
}
