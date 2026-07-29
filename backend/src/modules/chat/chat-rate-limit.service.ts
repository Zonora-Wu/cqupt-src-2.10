import { Inject, Injectable } from '@nestjs/common'
import { SecurityRateLimitService } from '../../common/security/security-rate-limit.service'

@Injectable()
export class ChatRateLimitService {
  constructor(@Inject(SecurityRateLimitService) private readonly rateLimit: SecurityRateLimitService) {}

  consume(key: string, limit: number, windowMs: number) {
    return this.rateLimit.consume('chat', key, limit, windowMs)
  }
}
