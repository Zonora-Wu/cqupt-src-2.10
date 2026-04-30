import { BadRequestException } from '@nestjs/common'
import { MallProductStatus } from '@prisma/client'
import {
  MallHandleRedemptionBody,
  MallProductBody,
  MallRedemptionBody,
  NormalizedMallProductInput,
} from './points-mall.types'

export function normalizeMallProductBody(body: MallProductBody): NormalizedMallProductInput {
  return {
    category: requireText(body.category, '商品分类', 2, 40),
    description: requireText(body.description, '商品说明', 5, 1000),
    imageUrl: normalizeOptionalUrl(body.imageUrl),
    name: requireText(body.name, '商品名称', 2, 80),
    perUserLimit: normalizeInteger(body.perUserLimit, '每人限兑数量', 1, 99, 1),
    pickupInstructions: normalizeOptionalText(body.pickupInstructions, 1000),
    pickupLocation: normalizeOptionalText(body.pickupLocation, 120) || '蓝山工作室',
    pointsCost: normalizeInteger(body.pointsCost, '兑换积分', 1, 100000, undefined),
    sortOrder: normalizeInteger(body.sortOrder, '排序权重', -999999, 999999, 0),
    status: normalizeProductStatus(body.status),
    stock: normalizeInteger(body.stock, '库存数量', 0, 100000, undefined),
  }
}

export function normalizeRedemptionBody(body: MallRedemptionBody) {
  return {
    productId: requireText(body.productId, '商品 ID', 5, 120),
  }
}

export function normalizeHandleRedemptionBody(body: MallHandleRedemptionBody) {
  return {
    note: normalizeOptionalText(body.note, 1000),
  }
}

function requireText(value: unknown, label: string, minLength: number, maxLength: number) {
  if (typeof value !== 'string') {
    throw new BadRequestException(`${label}格式不正确`)
  }

  const text = value.trim()
  if (text.length < minLength) {
    throw new BadRequestException(`${label}至少需要 ${minLength} 个字符`)
  }

  if (text.length > maxLength) {
    throw new BadRequestException(`${label}不能超过 ${maxLength} 个字符`)
  }

  return text
}

function normalizeOptionalText(value: unknown, maxLength: number) {
  if (value === undefined || value === null || value === '') return ''
  if (typeof value !== 'string') {
    throw new BadRequestException('文本格式不正确')
  }

  const text = value.trim()
  if (text.length > maxLength) {
    throw new BadRequestException(`文本不能超过 ${maxLength} 个字符`)
  }

  return text
}

function normalizeInteger(
  value: unknown,
  label: string,
  min: number,
  max: number,
  defaultValue: number | undefined,
) {
  if (value === undefined || value === null || value === '') {
    if (defaultValue !== undefined) return defaultValue
    throw new BadRequestException(`${label}不能为空`)
  }

  const numberValue = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(numberValue)) {
    throw new BadRequestException(`${label}必须是整数`)
  }

  if (numberValue < min || numberValue > max) {
    throw new BadRequestException(`${label}必须在 ${min} 到 ${max} 之间`)
  }

  return numberValue
}

function normalizeProductStatus(value: unknown) {
  if (value === undefined || value === null || value === '') return MallProductStatus.DRAFT
  if (typeof value !== 'string') {
    throw new BadRequestException('商品状态格式不正确')
  }

  const status = value.trim()
  if (status === MallProductStatus.DRAFT || status === '草稿') return MallProductStatus.DRAFT
  if (status === MallProductStatus.ACTIVE || status === '已上架') return MallProductStatus.ACTIVE
  if (status === MallProductStatus.INACTIVE || status === '已下架') return MallProductStatus.INACTIVE

  throw new BadRequestException('商品状态不正确')
}

function normalizeOptionalUrl(value: unknown) {
  const text = normalizeOptionalText(value, 1000)
  if (!text) return null

  try {
    const parsed = new URL(text)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('invalid protocol')
    }
    return parsed.toString()
  } catch {
    throw new BadRequestException('商品图片 URL 必须是 http:// 或 https:// 开头的有效地址')
  }
}
