import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { validateEnv } from './config/env'
import { ObjectStorageModule } from './integrations/object-storage/object-storage.module'
import { AccessModule } from './modules/access/access.module'
import { AccountModule } from './modules/account/account.module'
import { AnnouncementsModule } from './modules/announcements/announcements.module'
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module'
import { AttachmentsModule } from './modules/attachments/attachments.module'
import { AuthModule } from './modules/auth/auth.module'
import { CaptchaModule } from './modules/captcha/captcha.module'
import { CertificatesModule } from './modules/certificates/certificates.module'
import { HealthModule } from './modules/health/health.module'
import { LearningModule } from './modules/learning/learning.module'
import { NotificationsModule } from './modules/notifications/notifications.module'
import { PointsMallModule } from './modules/points-mall/points-mall.module'
import { PrismaModule } from './modules/prisma/prisma.module'
import { SchoolPolicyModule } from './modules/school/school-policy.module'
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
    SchoolPolicyModule,
    AuthModule,
    AccountModule,
    AccessModule,
    VulnerabilitiesModule,
    AttachmentsModule,
    CaptchaModule,
    CertificatesModule,
    AnnouncementsModule,
    AuditLogsModule,
    LearningModule,
    PointsMallModule,
    NotificationsModule,
    SystemSettingsModule,
    UsersModule,
  ],
})
export class AppModule {}
