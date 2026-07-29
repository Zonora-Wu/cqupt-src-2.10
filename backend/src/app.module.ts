import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { SecurityModule } from './common/security/security.module'
import { validateEnv } from './config/env'
import { ObjectStorageModule } from './integrations/object-storage/object-storage.module'
import { AccessModule } from './modules/access/access.module'
import { AccountModule } from './modules/account/account.module'
import { AiModule } from './modules/ai/ai.module'
import { AiKnowledgeModule } from './modules/ai-knowledge/ai-knowledge.module'
import { AnnouncementsModule } from './modules/announcements/announcements.module'
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module'
import { AttachmentsModule } from './modules/attachments/attachments.module'
import { AuthModule } from './modules/auth/auth.module'
import { CaptchaModule } from './modules/captcha/captcha.module'
import { ChatModule } from './modules/chat/chat.module'
import { CertificatesModule } from './modules/certificates/certificates.module'
import { DashboardModule } from './modules/dashboard/dashboard.module'
import { HealthModule } from './modules/health/health.module'
import { HumanVerificationModule } from './modules/human-verification/human-verification.module'
import { LearningModule } from './modules/learning/learning.module'
import { NotificationsModule } from './modules/notifications/notifications.module'
import { PointsMallModule } from './modules/points-mall/points-mall.module'
import { PrismaModule } from './modules/prisma/prisma.module'
import { SchoolPolicyModule } from './modules/school/school-policy.module'
import { SecurityExamModule } from './modules/security-exam/security-exam.module'
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
    SecurityModule,
    PrismaModule,
    ObjectStorageModule,
    HealthModule,
    HumanVerificationModule,
    SchoolPolicyModule,
    AuthModule,
    AccountModule,
    AiModule,
    AiKnowledgeModule,
    AccessModule,
    SecurityExamModule,
    VulnerabilitiesModule,
    AttachmentsModule,
    CaptchaModule,
    ChatModule,
    CertificatesModule,
    AnnouncementsModule,
    AuditLogsModule,
    LearningModule,
    PointsMallModule,
    NotificationsModule,
    SystemSettingsModule,
    UsersModule,
    DashboardModule,
  ],
})
export class AppModule {}
