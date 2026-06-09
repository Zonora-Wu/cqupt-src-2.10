import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { RbacModule } from '../rbac/rbac.module'
import { SecurityExamAdminController, SecurityExamController } from './security-exam.controller'
import { SecurityExamService } from './security-exam.service'

@Module({
  imports: [AuthModule, RbacModule],
  controllers: [SecurityExamController, SecurityExamAdminController],
  providers: [SecurityExamService],
  exports: [SecurityExamService],
})
export class SecurityExamModule {}
