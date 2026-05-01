import { apiRequest } from './apiClient'

export type UserDashboardStats = {
  certCount: number
  confirmedCount: number
  currentPoints: number
  submitCount: number
}

export type AuditorDashboardStats = {
  pendingArchive: number
  pendingCerts: number
  pendingInitReview: number
  pendingRetest: number
}

export type AdminDashboardStats = {
  pendingAccessUsers: number
  pendingCerts: number
  pendingRedemptions: number
  pendingVulnerabilities: number
  totalActiveUsers: number
  totalVulnerabilities: number
}

export async function getUserDashboard() {
  return apiRequest<UserDashboardStats>('/dashboard/user', {
    auth: true,
    method: 'GET',
    unauthenticatedMessage: '请先登录',
  })
}

export async function getAuditorDashboard() {
  return apiRequest<AuditorDashboardStats>('/dashboard/auditor', {
    auth: true,
    method: 'GET',
    unauthenticatedMessage: '请先登录',
  })
}

export async function getAdminDashboard() {
  return apiRequest<AdminDashboardStats>('/dashboard/admin', {
    auth: true,
    method: 'GET',
    unauthenticatedMessage: '请先登录',
  })
}
