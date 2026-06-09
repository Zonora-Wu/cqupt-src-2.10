import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AiKnowledgeService } from './ai-knowledge.service'

@Injectable()
export class AiKnowledgeWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AiKnowledgeWorker.name)
  private running = false
  private timer?: NodeJS.Timeout

  constructor(
    @Inject(AiKnowledgeService) private readonly knowledge: AiKnowledgeService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const enabled = this.config.get<string>('AI_KNOWLEDGE_WORKER_ENABLED') ?? 'true'
    if (enabled === 'false') return

    const intervalMs = Math.max(Number(this.config.get<string>('AI_KNOWLEDGE_WORKER_INTERVAL_MS') ?? 120000), 30000)
    this.timer = setInterval(() => void this.tick(), intervalMs)
    this.timer.unref?.()
    void this.tick()
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer)
  }

  private async tick() {
    if (this.running) return
    this.running = true
    try {
      const limit = Math.max(Number(this.config.get<string>('AI_KNOWLEDGE_WORKER_BATCH_SIZE') ?? 10), 1)
      const result = await this.knowledge.processPendingCaptures(limit)
      if (result.processed > 0) {
        this.logger.log(`processed ${result.processed} AI knowledge capture job(s)`)
      }
    } catch (error) {
      this.logger.warn(`AI knowledge worker tick failed: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      this.running = false
    }
  }
}
