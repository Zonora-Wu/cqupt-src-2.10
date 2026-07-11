import { Module } from '@nestjs/common'
import { HumanVerificationController } from './human-verification.controller'
import { HumanVerificationService } from './human-verification.service'

@Module({
  controllers: [HumanVerificationController],
  providers: [HumanVerificationService],
  exports: [HumanVerificationService],
})
export class HumanVerificationModule {}
