import { Controller, Get, Inject, Post, Req, UseGuards } from '@nestjs/common'
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { PermissionsGuard } from '../auth/permissions.guard'
import { AuthenticatedRequestUser } from '../auth/auth.types'
import { DashboardService } from './dashboard.service'

type RequestLike = {
  headers?: Record<string, string | string[] | undefined>
  ip?: string
  socket?: { remoteAddress?: string }
}

@Controller('dashboard')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DashboardController {
  constructor(@Inject(DashboardService) private readonly dashboard: DashboardService) {}

  @Get('user')
  @RequirePermissions('vulnerability:read_own')
  getUserDashboard(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.dashboard.getUserDashboard(user)
  }

  @Post('user/ai-insight/run')
  @RequirePermissions('vulnerability:read_own')
  refreshUserDashboardAiInsight(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() request: RequestLike,
  ) {
    return this.dashboard.refreshUserDashboardAiInsight(user, getRequestMeta(request))
  }

  @Get('auditor')
  @RequirePermissions('vulnerability:review')
  getAuditorDashboard() {
    return this.dashboard.getAuditorDashboard()
  }

  @Get('admin')
  @RequirePermissions('vulnerability:manage')
  getAdminDashboard() {
    return this.dashboard.getAdminDashboard()
  }

  @Post('admin/ai-insight/run')
  @RequirePermissions('vulnerability:manage')
  refreshAdminDashboardAiInsight(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() request: RequestLike,
  ) {
    return this.dashboard.refreshAdminDashboardAiInsight(user, getRequestMeta(request))
  }
}

function getRequestMeta(request: RequestLike) {
  const forwardedFor = readHeader(request, 'x-forwarded-for')
  const ipAddress = forwardedFor.split(',')[0]?.trim() || request.ip || request.socket?.remoteAddress
  return {
    ipAddress,
    userAgent: readHeader(request, 'user-agent'),
  }
}

function readHeader(request: RequestLike, name: string) {
  const value = request.headers?.[name]
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}
