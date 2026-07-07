import { Module } from '@nestjs/common'
import { ObjectStorageModule } from '../../integrations/object-storage/object-storage.module'
import { AuthModule } from '../auth/auth.module'
import { RbacModule } from '../rbac/rbac.module'
import { PublicPlatformController, SystemSettingsController } from './system-settings.controller'
import { SystemSettingsService } from './system-settings.service'

@Module({
  imports: [AuthModule, RbacModule, ObjectStorageModule],
  controllers: [SystemSettingsController, PublicPlatformController],
  providers: [SystemSettingsService],
})
export class SystemSettingsModule {}
