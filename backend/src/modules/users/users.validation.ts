import { BadRequestException } from '@nestjs/common'
import { RoleCode, UserStatus } from '@prisma/client'
import {
  ResetUserPasswordBody,
  UpdateUserAiQuotaBody,
  UpdateUserPermissionBody,
  UpdateUserRoleBody,
  UpdateUserStatusBody,
} from './users.types'

export function normalizeUpdateUserRoleBody(body: UpdateUserRoleBody) {
  return {
    reason: normalizeReason(body.reason, '管理员调整用户角色'),
    role: normalizeRole(body.role),
  }
}

export function normalizeUpdateUserStatusBody(body: UpdateUserStatusBody) {
  return {
    reason: normalizeReason(body.reason, '管理员调整账号状态'),
    status: normalizeStatus(body.status),
  }
}

export function normalizeUpdateUserPermissionBody(body: UpdateUserPermissionBody) {
  return {
    enabled: normalizeBoolean(body.enabled),
    permissionCode: requireText(body.permissionCode, '权限点', 3, 80),
    reason: normalizeReason(body.reason, '管理员调整用户权限覆盖'),
  }
}

export function normalizeResetUserPasswordBody(body: ResetUserPasswordBody) {
  return {
    newPassword: normalizeOptionalPassword(body.newPassword),
    reason: normalizeReason(body.reason, '管理员重置用户密码'),
  }
}

export function normalizeUpdateUserAiQuotaBody(body: UpdateUserAiQuotaBody) {
  return {
    enabled: body.enabled === undefined ? true : normalizeBoolean(body.enabled),
    monthlyLimit: normalizeTokenLimit(body.monthlyLimit),
    reason: normalizeReason(body.reason, '管理员调整用户 AI token 额度'),
  }
}

function normalizeOptionalPassword(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string') {
    throw new BadRequestException('密码格式不正确')
  }
  const pwd = value.trim()
  if (pwd.length < 8) throw new BadRequestException('密码至少需要 8 个字符')
  if (pwd.length > 128) throw new BadRequestException('密码不能超过 128 个字符')
  const categories = [
    /[A-Za-z]/.test(pwd),
    /\d/.test(pwd),
    /[^A-Za-z0-9]/.test(pwd),
  ].filter(Boolean).length
  if (categories < 2) throw new BadRequestException('密码需包含字母、数字、符号中至少两类')
  return pwd
}

function normalizeRole(value: unknown) {
  if (typeof value !== 'string') {
    throw new BadRequestException('用户角色格式不正确')
  }

  const role = value.trim()
  if (role === RoleCode.STUDENT || role === '学生') return RoleCode.STUDENT
  if (role === RoleCode.AUDITOR || role === '审核员') return RoleCode.AUDITOR
  if (role === RoleCode.ADMIN || role === '管理员') return RoleCode.ADMIN

  throw new BadRequestException('用户角色不正确')
}

function normalizeStatus(value: unknown) {
  if (typeof value !== 'string') {
    throw new BadRequestException('账号状态格式不正确')
  }

  const status = value.trim()
  if (status === UserStatus.ACTIVE || status === '正常') return UserStatus.ACTIVE
  if (status === UserStatus.PENDING || status === '待准入') return UserStatus.PENDING
  if (status === UserStatus.DISABLED || status === '已禁用') return UserStatus.DISABLED
  if (status === UserStatus.LOCKED || status === '已锁定') return UserStatus.LOCKED

  throw new BadRequestException('账号状态不正确')
}

function normalizeBoolean(value: unknown) {
  if (typeof value !== 'boolean') {
    throw new BadRequestException('权限开关格式不正确')
  }

  return value
}

function normalizeTokenLimit(value: unknown) {
  const numberValue = Number(value)
  if (!Number.isInteger(numberValue) || numberValue < 0 || numberValue > 100_000_000) {
    throw new BadRequestException('AI token 额度必须是 0 到 100000000 之间的整数')
  }

  return numberValue
}

function normalizeReason(value: unknown, defaultValue: string) {
  if (value === undefined || value === null || value === '') return defaultValue
  if (typeof value !== 'string') {
    throw new BadRequestException('操作原因格式不正确')
  }

  const reason = value.trim()
  if (reason.length > 500) {
    throw new BadRequestException('操作原因不能超过 500 个字符')
  }

  return reason || defaultValue
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
