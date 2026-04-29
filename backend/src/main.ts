import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  const apiPrefix = process.env.API_PREFIX ?? 'api'
  const frontendOrigin = process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173'
  const port = Number(process.env.PORT ?? 3000)

  app.setGlobalPrefix(apiPrefix)
  app.enableCors({
    credentials: true,
    origin: frontendOrigin.split(',').map((origin) => origin.trim()),
  })

  await app.listen(port)
}

void bootstrap()
