import { Body, Controller, Get, Inject, Param, Patch, Post, Req, UseGuards } from '@nestjs/common'
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators'
import { AuthenticatedRequestUser, ClientRequestMeta } from '../auth/auth.types'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { PermissionsGuard } from '../auth/permissions.guard'
import {
  ResetUserPasswordBody,
  UpdateUserPermissionBody,
  UpdateUserRoleBody,
  UpdateUserStatusBody,
} from './users.types'
import {
  normalizeResetUserPasswordBody,
  normalizeUpdateUserPermissionBody,
  normalizeUpdateUserRoleBody,
  normalizeUpdateUserStatusBody,
} from './users.validation'
import { UsersService } from './users.service'

type RequestLike = {
  ip?: string
  path?: string
  headers?: {
    ['user-agent']?: string
    ['x-forwarded-for']?: string | string[]
  }
}

function getRequestMeta(req: RequestLike): ClientRequestMeta {
  const forwardedFor = req.headers?.['x-forwarded-for']
  const forwardedIp = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor

  return {
    ipAddress: forwardedIp?.split(',')[0]?.trim() || req.ip,
    requestPath: req.path,
    userAgent: req.headers?.['user-agent'],
  }
}

@Controller('users/manage')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('user:manage')
export class UsersController {
  constructor(@Inject(UsersService) private readonly users: UsersService) {}

  @Get()
  listManagedUsers() {
    return this.users.listManagedUsers()
  }

  @Get('options')
  listUserManagementOptions() {
    return this.users.listUserManagementOptions()
  }

  @Get(':id')
  getManagedUserDetail(@Param('id') id: string) {
    return this.users.getManagedUserDetail(id)
  }

  @Patch(':id/role')
  updateUserRole(
    @Param('id') id: string,
    @Body() body: UpdateUserRoleBody,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: RequestLike,
  ) {
    const input = normalizeUpdateUserRoleBody(body)
    return this.users.updateUserRole(id, input, user, getRequestMeta(req))
  }

  @Patch(':id/status')
  updateUserStatus(
    @Param('id') id: string,
    @Body() body: UpdateUserStatusBody,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: RequestLike,
  ) {
    const input = normalizeUpdateUserStatusBody(body)
    return this.users.updateUserStatus(id, input, user, getRequestMeta(req))
  }

  @Patch(':id/permissions')
  updateUserPermissionOverride(
    @Param('id') id: string,
    @Body() body: UpdateUserPermissionBody,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: RequestLike,
  ) {
    const input = normalizeUpdateUserPermissionBody(body)
    return this.users.updateUserPermissionOverride(id, input, user, getRequestMeta(req))
  }

  @Post(':id/reset-password')
  resetUserPassword(
    @Param('id') id: string,
    @Body() body: ResetUserPasswordBody,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: RequestLike,
  ) {
    const input = normalizeResetUserPasswordBody(body)
    return this.users.resetUserPassword(id, input, user, getRequestMeta(req))
  }
}
