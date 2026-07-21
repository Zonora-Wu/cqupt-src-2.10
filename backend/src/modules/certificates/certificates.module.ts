import { Module } from '@nestjs/common'
import { ObjectStorageModule } from '../../integrations/object-storage/object-storage.module'
import { AuthModule } from '../auth/auth.module'
import { RbacModule } from '../rbac/rbac.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { CertificatesController } from './certificates.controller'
import { CertificatesService } from './certificates.service'

@Module({
  imports: [AuthModule, RbacModule, ObjectStorageModule, NotificationsModule],
  controllers: [CertificatesController],
  providers: [CertificatesService],
})
export class CertificatesModule {}
