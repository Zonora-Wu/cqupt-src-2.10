import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { PrismaModule } from '../prisma/prisma.module'
import { RbacModule } from '../rbac/rbac.module'
import { UsersController } from './users.controller'
import { UsersService } from './users.service'

@Module({
  controllers: [UsersController],
  imports: [PrismaModule, AuthModule, RbacModule],
  providers: [UsersService],
})
export class UsersModule {}
