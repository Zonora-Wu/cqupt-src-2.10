import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { CaptchaController } from './captcha.controller'
import { CaptchaService } from './captcha.service'

@Module({
  controllers: [CaptchaController],
  imports: [PrismaModule],
  providers: [CaptchaService],
  exports: [CaptchaService],
})
export class CaptchaModule {}
