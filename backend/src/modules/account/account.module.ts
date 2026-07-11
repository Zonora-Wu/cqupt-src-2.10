import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { HumanVerificationModule } from '../human-verification/human-verification.module'
import { RbacModule } from '../rbac/rbac.module'
import { AccountController } from './account.controller'
import { AccountService } from './account.service'

@Module({
  imports: [AuthModule, RbacModule, HumanVerificationModule],
  controllers: [AccountController],
  providers: [AccountService],
})
export class AccountModule {}
