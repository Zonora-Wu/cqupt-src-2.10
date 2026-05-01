import { apiRequest } from './apiClient'

export type RoleCode = 'STUDENT' | 'AUDITOR' | 'ADMIN'
export type UserStatusCode = 'ACTIVE' | 'PENDING' | 'DISABLED' | 'LOCKED'

export type ManagedUserItem = {
  accessStatus: '未答题' | '答题通过' | '已签责任书' | '未通过'
  accountStatus: '正常' | '待准入' | '已禁用' | '已锁定'
  authorizationLevel: string
  certificates: number
  college: string
  createdAt: string
  email: string
  emailVerified: boolean
  grade: string
  id: string
  identityText: string
  lastIp: string
  lastLogin: string | null
  name: string
  points: number
  responsibilitySigned: boolean
  responsibilitySignedAt: string | null
  responsibilityVersion: string
  role: RoleCode
  roleLabel: string
  securityExamPassed: boolean
  securityExamScore: number | null
  securityExamTime: string | null
  status: UserStatusCode
  studentNo: string
  submissions: number
  unifiedCode: string
  updatedAt: string
  validReports: number
}

export type ManagedUserDetail = ManagedUserItem & {
  auditEvents: Array<{
    action: string
    createdAt: string
    metadata: unknown
    result: string
    targetType: string
  }>
  permissionOverrides: Array<{
    code: string
    enabled: boolean
    name: string
    reason: string
    updatedAt: string
  }>
}

export type UserManagementOptions = {
  colleges: string[]
  permissions: Array<{ code: string; name: string }>
  roles: Array<{ code: RoleCode; description: string; label: string }>
  statuses: Array<{ code: UserStatusCode; label: string }>
}

export type ManagedUsersResponse = {
  items: ManagedUserItem[]
  stats: {
    active: number
    admins: number
    auditors: number
    disabled: number
    locked: number
    pending: number
    students: number
    total: number
  }
}

export function listManagedUsers() {
  return request<ManagedUsersResponse>('/users/manage', { method: 'GET' })
}

export function getManagedUserDetail(id: string) {
  return request<ManagedUserDetail>(`/users/manage/${id}`, { method: 'GET' })
}

export function getUserManagementOptions() {
  return request<UserManagementOptions>('/users/manage/options', { method: 'GET' })
}

export function updateManagedUserRole(id: string, role: RoleCode, reason: string) {
  return request<ManagedUserItem>(`/users/manage/${id}/role`, {
    body: { reason, role },
    method: 'PATCH',
  })
}

export function updateManagedUserStatus(id: string, status: UserStatusCode, reason: string) {
  return request<ManagedUserItem>(`/users/manage/${id}/status`, {
    body: { reason, status },
    method: 'PATCH',
  })
}

export function updateManagedUserPermission(
  id: string,
  permissionCode: string,
  enabled: boolean,
  reason: string,
) {
  return request<{ code: string; enabled: boolean; name: string; reason: string; updatedAt: string }>(
    `/users/manage/${id}/permissions`,
    {
      body: { enabled, permissionCode, reason },
      method: 'PATCH',
    },
  )
}

export function resetManagedUserPassword(id: string, reason: string) {
  return request<{ message: string; temporaryPassword?: string }>(`/users/manage/${id}/reset-password`, {
    body: { reason },
    method: 'POST',
  })
}

async function request<T>(
  path: string,
  options: {
    body?: unknown
    method: 'GET' | 'PATCH' | 'POST'
  },
) {
  return apiRequest<T>(path, {
    ...options,
    auth: true,
    unauthenticatedMessage: '请先登录后再访问用户管理',
  })
}
