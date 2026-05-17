import { Module } from '@nestjs/common'
import { AnnouncementsModule } from '../announcements/announcements.module'
import { AuditLogsModule } from '../audit-logs/audit-logs.module'
import { AuthModule } from '../auth/auth.module'
import { DashboardModule } from '../dashboard/dashboard.module'
import { LearningModule } from '../learning/learning.module'
import { PointsMallModule } from '../points-mall/points-mall.module'
import { RbacModule } from '../rbac/rbac.module'
import { VulnerabilitiesModule } from '../vulnerabilities/vulnerabilities.module'
import { AiController } from './ai.controller'
import { AiService } from './ai.service'
import { AiToolsService } from './ai.tools.service'

@Module({
  controllers: [AiController],
  imports: [
    AnnouncementsModule,
    AuditLogsModule,
    AuthModule,
    DashboardModule,
    LearningModule,
    PointsMallModule,
    RbacModule,
    VulnerabilitiesModule,
  ],
  providers: [AiService, AiToolsService],
})
export class AiModule {}
