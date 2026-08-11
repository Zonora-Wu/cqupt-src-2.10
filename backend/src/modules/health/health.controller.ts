import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common'
import { HealthService } from './health.service'

@Controller('health')
export class HealthController {
  constructor(@Inject(HealthService) private readonly health: HealthService) {}

  @Get()
  check() {
    return this.live()
  }

  @Get('live')
  live() {
    return { service: 'cqupt-src-backend', status: 'ok', timestamp: new Date().toISOString() }
  }

  @Get('ready')
  async ready() {
    const result = await this.health.checkReadiness()
    if (!result.ready) throw new ServiceUnavailableException(result)
    return result
  }
}
