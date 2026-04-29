import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { REQUIRED_PERMISSIONS_KEY } from './auth.decorators'
import { AuthenticatedRequest } from './auth.types'

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    if (!request.auth) {
      throw new UnauthorizedException('请先登录')
    }

    const grantedPermissions = new Set(request.auth.permissions)
    const missingPermission = requiredPermissions.find((permission) => !grantedPermissions.has(permission))

    if (missingPermission) {
      throw new ForbiddenException(`缺少权限：${missingPermission}`)
    }

    return true
  }
}
