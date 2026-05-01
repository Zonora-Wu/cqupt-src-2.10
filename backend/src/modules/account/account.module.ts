import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { RbacModule } from '../rbac/rbac.module'
import { SchoolPolicyModule } from '../school/school-policy.module'
import { AccountController } from './account.controller'
import { AccountService } from './account.service'

@Module({
  imports: [AuthModule, RbacModule, SchoolPolicyModule],
  controllers: [AccountController],
  providers: [AccountService],
})
export class AccountModule {}
