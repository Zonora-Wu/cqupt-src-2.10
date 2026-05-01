import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { RbacModule } from '../rbac/rbac.module'
import { AccessController } from './access.controller'
import { AccessPolicyService } from './access-policy.service'

@Module({
  imports: [AuthModule, RbacModule],
  controllers: [AccessController],
  providers: [AccessPolicyService],
  exports: [AccessPolicyService],
})
export class AccessModule {}
