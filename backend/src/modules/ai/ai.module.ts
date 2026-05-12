import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { RbacModule } from '../rbac/rbac.module'
import { AiController } from './ai.controller'
import { AiService } from './ai.service'

@Module({
  imports: [AuthModule, RbacModule],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
