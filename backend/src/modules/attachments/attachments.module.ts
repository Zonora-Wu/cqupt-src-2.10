import { Module } from '@nestjs/common'
import { ObjectStorageModule } from '../../integrations/object-storage/object-storage.module'
import { AuthModule } from '../auth/auth.module'
import { RbacModule } from '../rbac/rbac.module'
import { AttachmentsController } from './attachments.controller'
import { AttachmentsService } from './attachments.service'

@Module({
  imports: [AuthModule, RbacModule, ObjectStorageModule],
  controllers: [AttachmentsController],
  providers: [AttachmentsService],
})
export class AttachmentsModule {}
