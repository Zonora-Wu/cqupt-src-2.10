import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { PrismaModule } from '../prisma/prisma.module'
import { RbacModule } from '../rbac/rbac.module'
import { AuditLogsController } from './audit-logs.controller'
import { AuditLogsService } from './audit-logs.service'

@Module({
  controllers: [AuditLogsController],
  imports: [PrismaModule, AuthModule, RbacModule],
  providers: [AuditLogsService],
})
export class AuditLogsModule {}
