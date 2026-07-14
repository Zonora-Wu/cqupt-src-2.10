import { HttpException, HttpStatus, Injectable } from '@nestjs/common'

type WindowEntry = { count: number; resetAt: number }

@Injectable()
export class ChatRateLimitService {
  private readonly windows = new Map<string, WindowEntry>()

  consume(key: string, limit: number, windowMs: number) {
    const now = Date.now()
    const current = this.windows.get(key)
    if (!current || current.resetAt <= now) {
      this.windows.set(key, { count: 1, resetAt: now + windowMs })
      return
    }

    if (current.count >= limit) {
      throw new HttpException('操作过于频繁，请稍后重试', HttpStatus.TOO_MANY_REQUESTS)
    }

    current.count += 1
  }
}
