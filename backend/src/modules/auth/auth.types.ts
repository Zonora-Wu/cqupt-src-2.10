import { RoleCode, UserStatus } from '@prisma/client'

export type AuthUserResponse = {
  id: string
  unifiedCode: string
  email: string
  name: string
  role: RoleCode
  status: UserStatus
  permissions: string[]
}

export type AuthenticatedRequestUser = AuthUserResponse & {
  tokenType: 'access'
}

export type AuthenticatedRequest = {
  auth?: AuthenticatedRequestUser
  headers?: {
    authorization?: string
    Authorization?: string
  }
}

export type LoginResponse = {
  accessToken: string
  refreshToken: string
  user: AuthUserResponse
}

export type ClientRequestMeta = {
  ipAddress?: string
  userAgent?: string
  requestPath?: string
}
