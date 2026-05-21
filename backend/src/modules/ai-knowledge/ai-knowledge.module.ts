import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { PrismaModule } from '../prisma/prisma.module'
import { RbacModule } from '../rbac/rbac.module'
import { AiKnowledgeController } from './ai-knowledge.controller'
import { AiKnowledgeService } from './ai-knowledge.service'
import { AiKnowledgeWorker } from './ai-knowledge.worker'

@Module({
  controllers: [AiKnowledgeController],
  imports: [PrismaModule, AuthModule, RbacModule],
  providers: [AiKnowledgeService, AiKnowledgeWorker],
  exports: [AiKnowledgeService],
})
export class AiKnowledgeModule {}
