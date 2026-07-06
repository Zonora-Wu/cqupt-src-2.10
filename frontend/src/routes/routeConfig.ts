import type { AuthUser } from '../services/auth'

export type Role = AuthUser['role']
export type NavItem = {
  label: string
  path: string
}

export const publicPagePaths = {
  home: '/',
  rules: '/rules',
  announcements: '/announcements',
  certificates: '/certificates',
  about: '/about',
} as const

export type PublicPage = keyof typeof publicPagePaths

export const userNavItems: NavItem[] = [
  { label: '首页', path: '/user' },
  { label: '提交漏洞', path: '/user/submit' },
  { label: '我的漏洞', path: '/user/vulnerabilities' },
  { label: '我的证书', path: '/user/certificates' },
  { label: '积分商城', path: '/user/mall' },
  { label: '排行榜', path: '/user/leaderboard' },
  { label: '学习中心', path: '/user/learning' },
  { label: 'AI助手', path: '/user/ai' },
  { label: '平台公告', path: '/user/announcements' },
]

export const userUtilityPaths: Record<string, string> = {
  安全答题: '/user/security-exam',
  通知: '/user/notifications',
  个人中心: '/user/profile',
  账号安全: '/user/account-security',
  系统设置: '/user/settings',
}

export const adminNavItems: NavItem[] = [
  { label: '首页', path: '/admin' },
  { label: '漏洞管理', path: '/admin/vulnerabilities' },
  { label: '证书管理', path: '/admin/certificates' },
  { label: '用户管理', path: '/admin/users' },
  { label: '公告管理', path: '/admin/announcements' },
  { label: '学习管理', path: '/admin/learning' },
  { label: '积分商城', path: '/admin/mall' },
  { label: '审计日志', path: '/admin/audit-logs' },
  { label: 'AI 知识库', path: '/admin/ai-knowledge' },
  { label: '系统设置', path: '/admin/settings' },
]

export const adminUtilityPaths: Record<string, string> = {
  通知: '/admin/notifications',
  个人中心: '/admin/profile',
  账号安全: '/admin/account-security',
  系统设置: '/admin/settings',
}

export const auditorNavItems: NavItem[] = [
  { label: '首页', path: '/auditor' },
  { label: '漏洞审核', path: '/auditor/review' },
  { label: '复测归档', path: '/auditor/retest' },
  { label: '证书管理', path: '/auditor/certificates' },
  { label: 'AI 辅助', path: '/auditor/ai' },
  { label: '审核记录', path: '/auditor/history' },
  { label: '公告管理', path: '/auditor/announcements' },
]

export const auditorUtilityPaths: Record<string, string> = {
  通知: '/auditor/notifications',
  个人中心: '/auditor/profile',
  账号安全: '/auditor/profile',
  系统设置: '/auditor/profile',
}

export const defaultPathByRole: Record<Role, string> = {
  admin: '/admin',
  auditor: '/auditor',
  student: '/user',
}

export function getDefaultPathForRole(role: Role) {
  return defaultPathByRole[role]
}

export function getPublicPageFromPath(pathname: string): PublicPage {
  const entry = Object.entries(publicPagePaths).find(([, path]) => path === pathname)
  return (entry?.[0] as PublicPage | undefined) ?? 'home'
}

export function getLabelFromPath(pathname: string, items: NavItem[], utilityPaths: Record<string, string>) {
  const exact = items.find((item) => item.path === pathname)
  if (exact) return exact.label

  const utility = Object.entries(utilityPaths).find(([, path]) => path === pathname)
  return utility?.[0] ?? '首页'
}

export function getPathFromLabel(label: string, items: NavItem[], utilityPaths: Record<string, string>) {
  return items.find((item) => item.label === label)?.path ?? utilityPaths[label]
}

export function isKnownWorkspacePath(pathname: string, items: NavItem[], utilityPaths: Record<string, string>) {
  return items.some((item) => item.path === pathname) || Object.values(utilityPaths).includes(pathname)
}
