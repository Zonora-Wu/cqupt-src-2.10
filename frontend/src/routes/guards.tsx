import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import type { AuthUser } from '../services/auth'
import { getDefaultPathForRole, type Role } from './routeConfig'

export function RequireRole({
  allowedRole,
  children,
  user,
}: {
  allowedRole: Role
  children: ReactNode
  user: AuthUser | null
}) {
  const location = useLocation()

  if (!user) {
    return (
      <Navigate
        replace
        state={{ notice: '请先登录后访问该页面。' }}
        to="/"
      />
    )
  }

  if (user.role !== allowedRole) {
    return <Navigate replace to={getDefaultPathForRole(user.role)} />
  }

  if (location.pathname.endsWith('/') && location.pathname !== '/') {
    return <Navigate replace to={location.pathname.replace(/\/+$/, '')} />
  }

  return children
}

export function PublicOnly({
  children,
  user,
}: {
  children: ReactNode
  user: AuthUser | null
}) {
  if (user) {
    return <Navigate replace to={getDefaultPathForRole(user.role)} />
  }

  return children
}
