import { Module } from '@nestjs/common'
import { SchoolPolicyService } from './school-policy.service'

@Module({
  providers: [SchoolPolicyService],
  exports: [SchoolPolicyService],
})
export class SchoolPolicyModule {}
