import { Module } from '@nestjs/common'
import { CaptchaModule } from '../captcha/captcha.module'
import { RbacModule } from '../rbac/rbac.module'
import { SchoolPolicyModule } from '../school/school-policy.module'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { JwtAuthGuard } from './jwt-auth.guard'
import { PermissionsGuard } from './permissions.guard'

@Module({
  imports: [RbacModule, CaptchaModule, SchoolPolicyModule],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, PermissionsGuard],
  exports: [AuthService, JwtAuthGuard, PermissionsGuard],
})
export class AuthModule {}
