import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { PrismaModule } from '../prisma/prisma.module'
import { RbacModule } from '../rbac/rbac.module'
import { AiKnowledgeController } from './ai-knowledge.controller'
import { AiKnowledgeMaintenanceWorker } from './ai-knowledge-maintenance.worker'
import { AiKnowledgeService } from './ai-knowledge.service'
import { AiKnowledgeWorker } from './ai-knowledge.worker'
import { AiProblemSessionController } from './ai-problem-session.controller'
import { AiProblemSessionService } from './ai-problem-session.service'
import { AiSkillLifecycleService } from './ai-skill-lifecycle.service'

@Module({
  controllers: [AiKnowledgeController, AiProblemSessionController],
  imports: [PrismaModule, AuthModule, RbacModule],
  providers: [AiKnowledgeService, AiKnowledgeWorker, AiKnowledgeMaintenanceWorker, AiSkillLifecycleService, AiProblemSessionService],
  exports: [AiKnowledgeService, AiKnowledgeMaintenanceWorker, AiProblemSessionService],
})
export class AiKnowledgeModule {}
