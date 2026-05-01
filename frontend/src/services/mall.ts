import { apiRequest } from './apiClient'

export type MallProductStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE'
export type MallRedemptionStatus = 'PENDING_PICKUP' | 'COMPLETED' | 'CANCELED' | 'EXPIRED'

export type PointSummary = {
  adjusted: number
  balance: number
  earned: number
  pendingRedemptions: number
  spent: number
}

export type PointLedgerItem = {
  balanceAfter: number
  createdAt: string
  direction: 'IN' | 'OUT' | 'ADJUST'
  directionLabel: string
  id: string
  note: string | null
  points: number
  reason: string
}

export type MallProductItem = {
  canRedeem?: boolean
  category: string
  createdAt: string
  description: string
  id: string
  imageUrl: string
  name: string
  perUserLimit: number
  pickupInstructions: string
  pickupLocation: string
  pointsCost: number
  sortOrder: number
  status: MallProductStatus
  statusLabel: '草稿' | '已上架' | '已下架'
  stock: number
  updatedAt: string
}

export type MallProductPayload = {
  category: string
  description: string
  imageUrl: string
  name: string
  perUserLimit: number
  pickupInstructions: string
  pickupLocation: string
  pointsCost: number
  sortOrder: number
  status: MallProductStatus
  stock: number
}

export type MallRedemptionItem = {
  canceledAt: string | null
  completedAt: string | null
  expiresAt: string | null
  id: string
  note: string
  pickupCode: string
  pointsCost: number
  product: MallProductItem
  requestedAt: string
  status: MallRedemptionStatus
  statusLabel: '待领取' | '已领取' | '已取消' | '已过期'
}

export type ManagedMallRedemptionItem = MallRedemptionItem & {
  user: {
    email: string
    name: string
    unifiedCode: string
  }
}

export function getPointSummary() {
  return request<PointSummary>('/points/summary', { method: 'GET' })
}

export function listPointLedger() {
  return request<{ items: PointLedgerItem[] }>('/points/ledger', { method: 'GET' })
}

export function listMallProducts() {
  return request<{ items: MallProductItem[]; stats: { active: number; total: number } }>('/mall/products', {
    method: 'GET',
  })
}

export function createRedemption(productId: string) {
  return request<MallRedemptionItem>('/mall/redemptions', {
    body: { productId },
    method: 'POST',
  })
}

export function listMyRedemptions() {
  return request<{ items: MallRedemptionItem[] }>('/mall/redemptions/my', { method: 'GET' })
}

export function listManagedMallProducts() {
  return request<{ items: MallProductItem[]; stats: { active: number; total: number } }>('/mall/manage/products', {
    method: 'GET',
  })
}

export function createMallProduct(payload: MallProductPayload) {
  return request<MallProductItem>('/mall/manage/products', {
    body: payload,
    method: 'POST',
  })
}

export function updateMallProduct(id: string, payload: MallProductPayload) {
  return request<MallProductItem>(`/mall/manage/products/${id}`, {
    body: payload,
    method: 'PATCH',
  })
}

export function activateMallProduct(id: string) {
  return request<MallProductItem>(`/mall/manage/products/${id}/activate`, { method: 'POST' })
}

export function deactivateMallProduct(id: string) {
  return request<MallProductItem>(`/mall/manage/products/${id}/deactivate`, { method: 'POST' })
}

export function deleteMallProduct(id: string) {
  return request<MallProductItem>(`/mall/manage/products/${id}`, { method: 'DELETE' })
}

export function listManagedRedemptions() {
  return request<{ items: ManagedMallRedemptionItem[] }>('/mall/manage/redemptions', { method: 'GET' })
}

export function completeRedemption(id: string, note = '') {
  return request<MallRedemptionItem>(`/mall/manage/redemptions/${id}/complete`, {
    body: { note },
    method: 'POST',
  })
}

export function cancelRedemption(id: string, note = '') {
  return request<MallRedemptionItem>(`/mall/manage/redemptions/${id}/cancel`, {
    body: { note },
    method: 'POST',
  })
}

async function request<T>(
  path: string,
  options: {
    body?: unknown
    method: 'DELETE' | 'GET' | 'PATCH' | 'POST'
  },
) {
  return apiRequest<T>(path, {
    ...options,
    auth: true,
    unauthenticatedMessage: '请先登录后再访问积分商城',
  })
}
