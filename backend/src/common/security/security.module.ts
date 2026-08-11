import { Global, Module } from '@nestjs/common'
import { SecurityRateLimitService } from './security-rate-limit.service'
import { MalwareScanInterceptor } from './malware-scan.interceptor'
import { MalwareScanService } from './malware-scan.service'

@Global()
@Module({
  exports: [MalwareScanInterceptor, MalwareScanService, SecurityRateLimitService],
  providers: [MalwareScanInterceptor, MalwareScanService, SecurityRateLimitService],
})
export class SecurityModule {}
