import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { RbacModule } from '../rbac/rbac.module'
import { AnnouncementsController } from './announcements.controller'
import { AnnouncementsService } from './announcements.service'

@Module({
  imports: [AuthModule, RbacModule],
  controllers: [AnnouncementsController],
  providers: [AnnouncementsService],
  exports: [AnnouncementsService],
})
export class AnnouncementsModule {}

