import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { PrismaModule } from '../prisma/prisma.module'
import { RbacModule } from '../rbac/rbac.module'
import { PointsMallController } from './points-mall.controller'
import { PointsMallService } from './points-mall.service'

@Module({
  controllers: [PointsMallController],
  imports: [PrismaModule, AuthModule, RbacModule],
  providers: [PointsMallService],
  exports: [PointsMallService],
})
export class PointsMallModule {}
