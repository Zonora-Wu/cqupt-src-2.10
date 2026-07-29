import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
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

void bootstrap()
