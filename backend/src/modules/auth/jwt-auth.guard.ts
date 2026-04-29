import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { UserStatus } from '@prisma/client'
import { verifyJwt } from '../../common/crypto/jwt'
import { PrismaService } from '../prisma/prisma.service'
import { RbacService } from '../rbac/rbac.service'
import { AuthenticatedRequest } from './auth.types'

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(RbacService)
    private readonly rbac: RbacService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const token = getBearerToken(request)

    if (!token) {
      throw new UnauthorizedException('请先登录')
    }

    const payload = verifyJwt(token, process.env.JWT_ACCESS_SECRET ?? '')
    if (!payload || payload.type !== 'access') {
      throw new UnauthorizedException('登录状态已失效，请重新登录')
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { role: true },
    })

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('账号当前不可用')
    }

    const permissions = await this.rbac.getUserPermissionCodes(user.id)

    request.auth = {
      email: user.email,
      id: user.id,
      name: user.name,
      permissions,
      role: user.role.code,
      status: user.status,
      tokenType: 'access',
      unifiedCode: user.unifiedCode,
    }

    return true
  }
}

function getBearerToken(request: AuthenticatedRequest) {
  const authorization = request.headers?.authorization ?? request.headers?.Authorization
  if (!authorization) {
    return null
  }

  const [scheme, token] = authorization.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null
  }

  return token
}
