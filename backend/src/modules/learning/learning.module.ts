import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { RbacModule } from '../rbac/rbac.module'
import { LearningController } from './learning.controller'
import { LearningService } from './learning.service'

@Module({
  imports: [AuthModule, RbacModule],
  controllers: [LearningController],
  providers: [LearningService],
  exports: [LearningService],
})
export class LearningModule {}

