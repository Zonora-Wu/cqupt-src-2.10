import { Module } from '@nestjs/common'
import { AiKnowledgeModule } from '../ai-knowledge/ai-knowledge.module'
import { AnnouncementsModule } from '../announcements/announcements.module'
import { AuditLogsModule } from '../audit-logs/audit-logs.module'
import { AuthModule } from '../auth/auth.module'
import { DashboardModule } from '../dashboard/dashboard.module'
import { LearningModule } from '../learning/learning.module'
import { PointsMallModule } from '../points-mall/points-mall.module'
import { RbacModule } from '../rbac/rbac.module'
import { VulnerabilitiesModule } from '../vulnerabilities/vulnerabilities.module'
import { AiController } from './ai.controller'
import { AiDataRequestService } from './ai.data-request.service'
import { AiReportDraftService } from './ai.report-draft.service'
import { AiService } from './ai.service'
import { AiSkillRouterService } from './ai.skill-router.service'
import { AiToolsService } from './ai.tools.service'
import { AiCredentialCrypto } from './ai-credential.crypto'
import { AiModelController } from './ai-model.controller'
import { AiModelService } from './ai-model.service'
import { AiDeclarativeSkillController } from './ai-declarative-skill.controller'
import { AiDeclarativeSkillService } from './ai-declarative-skill.service'
import { AiRuntimeControlService } from './ai-runtime-control.service'

@Module({
  controllers: [AiController, AiModelController, AiDeclarativeSkillController],
  imports: [
    AiKnowledgeModule,
    AnnouncementsModule,
    AuditLogsModule,
    AuthModule,
    DashboardModule,
    LearningModule,
    PointsMallModule,
    RbacModule,
    VulnerabilitiesModule,
  ],
  providers: [AiService, AiToolsService, AiSkillRouterService, AiDataRequestService, AiReportDraftService, AiCredentialCrypto, AiModelService, AiDeclarativeSkillService, AiRuntimeControlService],
})
export class AiModule {}
