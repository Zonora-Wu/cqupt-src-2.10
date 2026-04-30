import { Controller, Get, Inject, Param, Query, UseGuards } from '@nestjs/common'
import { RequirePermissions } from '../auth/auth.decorators'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { PermissionsGuard } from '../auth/permissions.guard'
import { AuditLogsService } from './audit-logs.service'
import { normalizeAuditLogQuery } from './audit-logs.validation'

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('audit:read')
export class AuditLogsController {
  constructor(@Inject(AuditLogsService) private readonly auditLogs: AuditLogsService) {}

  @Get()
  listAuditLogs(@Query() query: Record<string, unknown>) {
    return this.auditLogs.listAuditLogs(normalizeAuditLogQuery(query))
  }

  @Get('stats')
  getAuditLogStats(@Query() query: Record<string, unknown>) {
    return this.auditLogs.getAuditLogStats(normalizeAuditLogQuery(query))
  }

  @Get('target/:targetType/:targetId')
  listTargetAuditLogs(
    @Param('targetType') targetType: string,
    @Param('targetId') targetId: string,
    @Query() query: Record<string, unknown>,
  ) {
    return this.auditLogs.listTargetAuditLogs(targetType, targetId, normalizeAuditLogQuery(query))
  }

  @Get(':id')
  getAuditLogDetail(@Param('id') id: string) {
    return this.auditLogs.getAuditLogDetail(id)
  }
}
