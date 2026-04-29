import { Controller, Get } from '@nestjs/common'

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      service: 'cqupt-src-backend',
      status: 'ok',
      timestamp: new Date().toISOString(),
    }
  }
}
