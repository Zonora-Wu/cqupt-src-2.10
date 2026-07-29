import { Global, Module } from '@nestjs/common'
import { SecurityRateLimitService } from './security-rate-limit.service'

@Global()
@Module({
  exports: [SecurityRateLimitService],
  providers: [SecurityRateLimitService],
})
export class SecurityModule {}
