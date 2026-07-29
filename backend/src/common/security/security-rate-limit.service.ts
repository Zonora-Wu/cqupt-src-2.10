import { HttpException, HttpStatus, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { createHash } from 'node:crypto'
import { createClient, type RedisClientType } from 'redis'

type WindowEntry = { count: number; resetAt: number }

const MAX_BUCKETS = 20_000

@Injectable()
export class SecurityRateLimitService implements OnModuleDestroy, OnModuleInit {
  private readonly logger = new Logger(SecurityRateLimitService.name)
  private readonly windows = new Map<string, WindowEntry>()
  private readonly cleanupTimer = setInterval(() => this.cleanup(), 60_000)
  private client: RedisClientType | null = null

  constructor() {
    this.cleanupTimer.unref()
  }

  async onModuleInit() {
    const redisUrl = process.env.REDIS_URL?.trim()
    if (!redisUrl) {
      if (process.env.NODE_ENV === 'production') throw new Error('REDIS_URL is required in production')
      this.logger.warn('REDIS_URL 未配置，限流使用单进程内存模式')
      return
    }
    const client = createClient({ url: redisUrl })
    client.on('error', (error) => this.logger.error(`Redis 限流连接异常：${error.message}`))
    try {
      await client.connect()
      this.client = client as RedisClientType
    } catch (error) {
      await client.disconnect().catch(() => undefined)
      if (process.env.NODE_ENV === 'production') throw error
      this.logger.warn('Redis 不可用，限流回退到单进程内存模式')
    }
  }

  async consume(scope: string, subject: string | undefined, limit: number, windowMs: number) {
    const now = Date.now()
    const key = `${scope}:${hashSubject(subject || 'unknown')}`
    if (this.client?.isReady) {
      const count = Number(await this.client.eval(
        "local current = redis.call('INCR', KEYS[1]); if current == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]); end; return current",
        { arguments: [String(windowMs)], keys: [`cqupt-src:rate:${key}`] },
      ))
      if (count > limit) throw rateLimitError()
      return
    }
    if (process.env.NODE_ENV === 'production') {
      throw new HttpException('服务繁忙，请稍后重试', HttpStatus.SERVICE_UNAVAILABLE)
    }
    const current = this.windows.get(key)
    if (!current || current.resetAt <= now) {
      this.ensureCapacity(now)
      this.windows.set(key, { count: 1, resetAt: now + windowMs })
      return
    }
    if (current.count >= limit) {
      throw rateLimitError()
    }
    current.count += 1
  }

  async onModuleDestroy() {
    clearInterval(this.cleanupTimer)
    this.windows.clear()
    if (this.client?.isOpen) await this.client.quit().catch(() => undefined)
  }

  private ensureCapacity(now: number) {
    if (this.windows.size < MAX_BUCKETS) return
    this.cleanup(now)
    if (this.windows.size < MAX_BUCKETS) return
    const oldest = [...this.windows.entries()]
      .sort((left, right) => left[1].resetAt - right[1].resetAt)
      .slice(0, Math.ceil(MAX_BUCKETS * 0.1))
    oldest.forEach(([key]) => this.windows.delete(key))
  }

  private cleanup(now = Date.now()) {
    for (const [key, entry] of this.windows) {
      if (entry.resetAt <= now) this.windows.delete(key)
    }
  }
}

function rateLimitError() {
  return new HttpException('操作过于频繁，请稍后重试', HttpStatus.TOO_MANY_REQUESTS)
}

function hashSubject(value: string) {
  return createHash('sha256').update(value).digest('base64url').slice(0, 22)
}
