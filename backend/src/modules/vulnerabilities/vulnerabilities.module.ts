import { Module } from '@nestjs/common'
import { AccessModule } from '../access/access.module'
import { AuthModule } from '../auth/auth.module'
import { RbacModule } from '../rbac/rbac.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { VulnerabilitiesController } from './vulnerabilities.controller'
import { VulnerabilitiesService } from './vulnerabilities.service'

@Module({
  imports: [AuthModule, RbacModule, AccessModule, NotificationsModule],
  controllers: [VulnerabilitiesController],
  providers: [VulnerabilitiesService],
  exports: [VulnerabilitiesService],
})
export class VulnerabilitiesModule {}
