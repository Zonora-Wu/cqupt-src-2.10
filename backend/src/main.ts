import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { randomUUID } from 'node:crypto'
import { json, type NextFunction, type Request, type Response } from 'express'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  const apiPrefix = process.env.API_PREFIX ?? 'api'
  const frontendOrigin = process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173'
  const port = Number(process.env.PORT ?? 3001)
  const isProduction = process.env.NODE_ENV === 'production'

  app.getHttpAdapter().getInstance().set('trust proxy', process.env.TRUST_PROXY ?? 'loopback, linklocal, uniquelocal')
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const trustedClientIp = req.ip
    req.headers['x-forwarded-for'] = trustedClientIp
    next()
  })
  app.use(json({ limit: '5mb' }))
  app.use((req: Request, res: Response, next: NextFunction) => {
    const receivedRequestId = req.header('x-request-id')?.trim()
    const requestId = receivedRequestId && /^[a-zA-Z0-9._-]{8,80}$/.test(receivedRequestId)
      ? receivedRequestId
      : randomUUID()
    const startedAt = process.hrtime.bigint()
    res.setHeader('X-Request-Id', requestId)
    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000
      if (process.env.HTTP_LOG_ALL !== 'true' && res.statusCode < 400 && durationMs < 1_000) return
      const entry = JSON.stringify({
        durationMs: Math.round(durationMs * 10) / 10,
        method: req.method,
        path: req.path,
        requestId,
        statusCode: res.statusCode,
        timestamp: new Date().toISOString(),
        type: 'http_request',
      })
      const output = res.statusCode >= 500 ? process.stderr : process.stdout
      output.write(`${entry}\n`)
    })
    next()
  })
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'")
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site')
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()')
    res.setHeader('Referrer-Policy', 'no-referrer')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
    if (req.path.startsWith(`/${apiPrefix}/auth/`)) res.setHeader('Cache-Control', 'no-store')
    if (isProduction) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
    next()
  })
  app.setGlobalPrefix(apiPrefix)
  app.enableCors({
    credentials: true,
    origin: frontendOrigin.split(',').map((origin) => origin.trim()),
  })

  await app.listen(port)
}

void bootstrap().catch((error: unknown) => {
  process.stderr.write(`${JSON.stringify({
    message: error instanceof Error ? error.message : 'unknown startup error',
    timestamp: new Date().toISOString(),
    type: 'startup_failure',
  })}\n`)
  process.exitCode = 1
})
