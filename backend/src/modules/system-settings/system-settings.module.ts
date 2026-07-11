import { Module } from '@nestjs/common'
import { ObjectStorageModule } from '../../integrations/object-storage/object-storage.module'
import { AuthModule } from '../auth/auth.module'
import { EmailModule } from '../email/email.module'
import { RbacModule } from '../rbac/rbac.module'
import { PublicPlatformController, SystemSettingsController } from './system-settings.controller'
import { SystemSettingsService } from './system-settings.service'

@Module({
  imports: [AuthModule, RbacModule, ObjectStorageModule, EmailModule],
  controllers: [SystemSettingsController, PublicPlatformController],
  providers: [SystemSettingsService],
})
export class SystemSettingsModule {}
