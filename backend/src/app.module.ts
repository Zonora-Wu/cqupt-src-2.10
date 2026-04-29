import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { validateEnv } from './config/env'
import { ObjectStorageModule } from './integrations/object-storage/object-storage.module'
import { AttachmentsModule } from './modules/attachments/attachments.module'
import { AuthModule } from './modules/auth/auth.module'
import { CertificatesModule } from './modules/certificates/certificates.module'
import { HealthModule } from './modules/health/health.module'
import { PrismaModule } from './modules/prisma/prisma.module'
import { SystemSettingsModule } from './modules/system-settings/system-settings.module'
import { VulnerabilitiesModule } from './modules/vulnerabilities/vulnerabilities.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ['.env.local', '.env'],
      isGlobal: true,
      validate: validateEnv,
    }),
    PrismaModule,
    ObjectStorageModule,
    HealthModule,
    AuthModule,
    VulnerabilitiesModule,
    AttachmentsModule,
    CertificatesModule,
    SystemSettingsModule,
  ],
})
export class AppModule {}
