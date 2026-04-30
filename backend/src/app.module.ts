import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { validateEnv } from './config/env'
import { ObjectStorageModule } from './integrations/object-storage/object-storage.module'
import { AnnouncementsModule } from './modules/announcements/announcements.module'
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module'
import { AttachmentsModule } from './modules/attachments/attachments.module'
import { AuthModule } from './modules/auth/auth.module'
import { CertificatesModule } from './modules/certificates/certificates.module'
import { HealthModule } from './modules/health/health.module'
import { LearningModule } from './modules/learning/learning.module'
import { PointsMallModule } from './modules/points-mall/points-mall.module'
import { PrismaModule } from './modules/prisma/prisma.module'
import { SystemSettingsModule } from './modules/system-settings/system-settings.module'
import { UsersModule } from './modules/users/users.module'
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
    AnnouncementsModule,
    AuditLogsModule,
    LearningModule,
    PointsMallModule,
    SystemSettingsModule,
    UsersModule,
  ],
})
export class AppModule {}
