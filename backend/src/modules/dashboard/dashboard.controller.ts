import { Controller, Get, Inject, UseGuards } from '@nestjs/common'
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { PermissionsGuard } from '../auth/permissions.guard'
import { AuthenticatedRequestUser } from '../auth/auth.types'
import { DashboardService } from './dashboard.service'

@Controller('dashboard')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DashboardController {
  constructor(@Inject(DashboardService) private readonly dashboard: DashboardService) {}

  @Get('user')
  @RequirePermissions('vulnerability:read_own')
  getUserDashboard(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.dashboard.getUserDashboard(user)
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
}
