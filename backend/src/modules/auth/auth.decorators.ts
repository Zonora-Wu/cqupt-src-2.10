import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common'
import { AuthenticatedRequest, AuthenticatedRequestUser } from './auth.types'

export const REQUIRED_PERMISSIONS_KEY = 'required_permissions'

export function RequirePermissions(...permissions: string[]) {
  return SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions)
}

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
  return request.auth as AuthenticatedRequestUser | undefined
})
