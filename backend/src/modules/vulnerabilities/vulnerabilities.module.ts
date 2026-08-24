import { Module } from '@nestjs/common'
import { AccessModule } from '../access/access.module'
import { AuthModule } from '../auth/auth.module'
import { RbacModule } from '../rbac/rbac.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { VulnerabilitiesController } from './vulnerabilities.controller'
import { VulnerabilitiesService } from './vulnerabilities.service'
import { VulnerabilityDraftsService } from './vulnerability-drafts.service'
import { VulnerabilityMarkdownService } from './vulnerability-markdown.service'
import { ObjectStorageModule } from '../../integrations/object-storage/object-storage.module'

@Module({
  imports: [AuthModule, RbacModule, AccessModule, NotificationsModule, ObjectStorageModule],
  controllers: [VulnerabilitiesController],
  providers: [VulnerabilitiesService, VulnerabilityDraftsService, VulnerabilityMarkdownService],
  exports: [VulnerabilitiesService],
})
export class VulnerabilitiesModule {}
