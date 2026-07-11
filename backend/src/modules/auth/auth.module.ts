import { Module } from '@nestjs/common'
import { EmailModule } from '../email/email.module'
import { HumanVerificationModule } from '../human-verification/human-verification.module'
import { RbacModule } from '../rbac/rbac.module'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { JwtAuthGuard } from './jwt-auth.guard'
import { PermissionsGuard } from './permissions.guard'

@Module({
  imports: [RbacModule, HumanVerificationModule, EmailModule],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, PermissionsGuard],
  exports: [AuthService, JwtAuthGuard, PermissionsGuard],
})
export class AuthModule {}
