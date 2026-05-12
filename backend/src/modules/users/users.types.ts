import { RoleCode, UserStatus } from '@prisma/client'

export type UpdateUserRoleBody = {
  reason?: unknown
  role?: unknown
}

export type UpdateUserStatusBody = {
  reason?: unknown
  status?: unknown
}

export type UpdateUserPermissionBody = {
  enabled?: unknown
  permissionCode?: unknown
  reason?: unknown
}

export type ResetUserPasswordBody = {
  newPassword?: unknown
  reason?: unknown
}

export type UpdateUserAiQuotaBody = {
  dailyLimit?: unknown
  enabled?: unknown
  monthlyLimit?: unknown
  reason?: unknown
  weeklyLimit?: unknown
}

export type NormalizedUpdateUserRoleInput = {
  reason: string
  role: RoleCode
}

export type NormalizedUpdateUserStatusInput = {
  reason: string
  status: UserStatus
}

export type NormalizedUpdateUserPermissionInput = {
  enabled: boolean
  permissionCode: string
  reason: string
}

export type NormalizedResetUserPasswordInput = {
  newPassword?: string
  reason: string
}

export type NormalizedUpdateUserAiQuotaInput = {
  dailyLimit: number
  enabled: boolean
  monthlyLimit: number
  reason: string
  weeklyLimit: number
}
