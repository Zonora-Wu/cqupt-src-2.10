import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { AuditAction, UserStatus } from '@prisma/client'
import { createHash } from 'node:crypto'
import { extname } from 'node:path'
import { PDFDocument } from 'pdf-lib'
import { S3StorageService } from '../../integrations/object-storage/s3-storage.service'
import { AuthenticatedRequestUser, ClientRequestMeta } from '../auth/auth.types'
import { generateCertificatePdf } from '../certificates/certificate-pdf.generator'
import { PrismaService } from '../prisma/prisma.service'
import { AiAssistantAppearance, AiKnowledgeUsagePolicySettings, AiQuotaSettings, CertificateTemplateSummary, PendingRegistrationItem, PlatformSettings, RegistrationMode, UploadedSettingsFile } from './system-settings.types'

const MAX_TEMPLATE_SIZE_BYTES = 20 * 1024 * 1024
const MAX_SEAL_SIZE_BYTES = 5 * 1024 * 1024
const MAX_AI_AVATAR_SIZE_BYTES = 2 * 1024 * 1024
const MAX_SCHOOL_LOGO_SIZE_BYTES = 2 * 1024 * 1024
const DEFAULT_THEME_COLOR = '#2A6438'
const BRAND_PALETTE_SHADES = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'] as const
const BRAND_PALETTE_SLOTS = ['lightBg', 'lightSurface', 'lightMuted', 'lightBorder', 'lightText', 'darkBg', 'darkSurface', 'darkMuted', 'darkBorder', 'darkText', 'primary'] as const
const BRAND_PALETTE_KEYS = [...BRAND_PALETTE_SLOTS, ...BRAND_PALETTE_SHADES] as const
const platformLogoSlots = ['navigation', 'auth', 'favicon'] as const
type PlatformLogoSlot = typeof platformLogoSlots[number]
type PlatformLogoMode = 'dark' | 'light'
const platformLogoSettingKeys: Record<PlatformLogoSlot, string> = {
  auth: 'auth_logo_url',
  favicon: 'favicon_url',
  navigation: 'navigation_logo_url',
}
const platformLogoDarkSettingKeys: Partial<Record<PlatformLogoSlot, string>> = {
  auth: 'auth_logo_url_dark',
  navigation: 'navigation_logo_url_dark',
}
const platformLogoSettingDescriptions: Record<PlatformLogoSlot, string> = {
  auth: '登录注册弹窗图标',
  favicon: '浏览器标签页图标',
  navigation: '菜单栏图标',
}
const DEFAULT_AI_DAILY_TOKENS = 20_000
const DEFAULT_AI_WEEKLY_TOKENS = 60_000
const DEFAULT_AI_MONTHLY_TOKENS = 100_000
const AI_DEFAULT_DAILY_TOKENS_KEY = 'ai_default_daily_tokens'
const AI_DEFAULT_WEEKLY_TOKENS_KEY = 'ai_default_weekly_tokens'
const AI_DEFAULT_MONTHLY_TOKENS_KEY = 'ai_default_monthly_tokens'
const AI_QUOTA_PERIOD_KEY = 'ai_quota_period'
const AI_KNOWLEDGE_USAGE_POLICY_KEY = 'ai_knowledge_usage_policy'

const DEFAULT_LAYOUT = {
  certificateNo: { x: 90, y: 74, fontSize: 28 },
  certificateType: { align: 'center', x: 421, y: 150, fontSize: 28 },
  fontFamily: 'notoSansCjk',
  issuedAt: { x: 420, y: 520, fontSize: 28 },
  recipientName: { align: 'center', x: 421, y: 220, fontSize: 28 },
  reportNo: { x: 118, y: 424, fontSize: 28 },
  seal: { width: 120, x: 450, y: 430 },
  severity: { x: 118, y: 456, fontSize: 28 },
}

@Injectable()
export class SystemSettingsService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(S3StorageService)
    private readonly storage: S3StorageService,
  ) {}

  async getActiveCertificateTemplate(): Promise<CertificateTemplateSummary | null> {
    const template = await this.prisma.certificateTemplate.findFirst({
      where: { active: true },
      orderBy: { createdAt: 'desc' },
    })

    return template ? summarizeTemplate(template) : null
  }

  async uploadCertificateTemplateBackground(
    file: UploadedSettingsFile | undefined,
    user: AuthenticatedRequestUser,
    meta: ClientRequestMeta,
  ) {
    const validatedFile = validateTemplateFile(file)
    const templateId = createStorageId('tpl')
    const version = createTemplateVersion()
    const originalName = sanitizeOriginalName(validatedFile.originalname)
    const storageKey = `certificate-templates/${templateId}/${originalName}`
    const sha256 = createHash('sha256').update(validatedFile.buffer).digest('hex')

    await this.storage.putObject({
      body: validatedFile.buffer,
      contentType: validatedFile.mimeType,
      key: storageKey,
    })

    const template = await this.prisma.$transaction(async (tx) => {
      await tx.certificateTemplate.updateMany({
        where: { active: true },
        data: { active: false },
      })

      const created = await tx.certificateTemplate.create({
        data: {
          active: true,
          createdById: user.id,
          layoutJson: DEFAULT_LAYOUT,
          name: '默认证书模板',
          templateMimeType: validatedFile.mimeType,
          templateSha256: sha256,
          templateSizeBytes: validatedFile.buffer.length,
          templateStorageKey: storageKey,
          version,
        },
      })

      await tx.auditLog.create({
        data: {
          action: AuditAction.CHANGE_SYSTEM_SETTING,
          actorId: user.id,
          ipAddress: meta.ipAddress,
          metadata: {
            fileName: originalName,
            mimeType: validatedFile.mimeType,
            sha256,
            templateId: created.id,
            version,
          },
          requestPath: meta.requestPath,
          result: 'success',
          targetId: created.id,
          targetType: 'CertificateTemplate',
          userAgent: meta.userAgent,
        },
      })

      return created
    })

    return summarizeTemplate(template)
  }

  async uploadCertificateSeal(
    file: UploadedSettingsFile | undefined,
    user: AuthenticatedRequestUser,
    meta: ClientRequestMeta,
  ) {
    const validatedFile = validateSealFile(file)
    const template = await this.prisma.certificateTemplate.findFirst({
      where: { active: true },
      orderBy: { createdAt: 'desc' },
    })

    if (!template) {
      throw new NotFoundException('请先上传并启用证书背景模板')
    }

    const originalName = sanitizeOriginalName(validatedFile.originalname)
    const storageKey = `certificate-templates/${template.id}/seal-${originalName}`
    const sha256 = createHash('sha256').update(validatedFile.buffer).digest('hex')

    await this.storage.putObject({
      body: validatedFile.buffer,
      contentType: validatedFile.mimeType,
      key: storageKey,
    })

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.certificateTemplate.update({
        where: { id: template.id },
        data: {
          sealMimeType: validatedFile.mimeType,
          sealSha256: sha256,
          sealSizeBytes: validatedFile.buffer.length,
          sealStorageKey: storageKey,
        },
      })

      await tx.auditLog.create({
        data: {
          action: AuditAction.CHANGE_SYSTEM_SETTING,
          actorId: user.id,
          ipAddress: meta.ipAddress,
          metadata: {
            fileName: originalName,
            mimeType: validatedFile.mimeType,
            sealSha256: sha256,
            templateId: template.id,
            version: template.version,
          },
          requestPath: meta.requestPath,
          result: 'success',
          targetId: template.id,
          targetType: 'CertificateTemplate',
          userAgent: meta.userAgent,
        },
      })

      return next
    })

    return summarizeTemplate(updated)
  }

  async updateCertificateTemplateLayout(
    layoutJson: unknown,
    user: AuthenticatedRequestUser,
    meta: ClientRequestMeta,
  ) {
    if (!layoutJson || typeof layoutJson !== 'object' || Array.isArray(layoutJson)) {
      throw new BadRequestException('layoutJson 必须是对象')
    }

    const template = await this.prisma.certificateTemplate.findFirst({
      where: { active: true },
      orderBy: { createdAt: 'desc' },
    })

    if (!template) {
      throw new NotFoundException('当前无启用的证书模板')
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.certificateTemplate.update({
        where: { id: template.id },
        data: { layoutJson: layoutJson as import('@prisma/client').Prisma.InputJsonValue },
      })

      await tx.auditLog.create({
        data: {
          action: AuditAction.CHANGE_SYSTEM_SETTING,
          actorId: user.id,
          ipAddress: meta.ipAddress,
          metadata: { layoutJson, templateId: template.id, version: template.version },
          requestPath: meta.requestPath,
          result: 'success',
          targetId: template.id,
          targetType: 'CertificateTemplate',
          userAgent: meta.userAgent,
        },
      })

      return next
    })

    return summarizeTemplate(updated)
  }

  async previewCertificateTemplate(user: AuthenticatedRequestUser, meta: ClientRequestMeta) {
    const template = await this.prisma.certificateTemplate.findFirst({
      where: { active: true },
      orderBy: { createdAt: 'desc' },
    })

    if (!template) {
      throw new NotFoundException('当前无启用的证书模板，请先上传背景图')
    }

    if (!template.sealStorageKey) {
      throw new BadRequestException('请先上传电子印章后再预览')
    }

    const [templateObject, sealObject] = await Promise.all([
      this.storage.getObject(template.templateStorageKey),
      this.storage.getObject(template.sealStorageKey),
    ])

    const pdfBuffer = await generateCertificatePdf({
      assetName: '重庆邮电大学学生工作系统',
      certificateNo: 'CQUPT-SRC-CERT-2026-A1B2C3',
      certificateType: '漏洞贡献证书',
      contribution: '发现了一处存储型跨站脚本漏洞（XSS），攻击者可通过该漏洞向其他用户注入恶意脚本，对用户数据安全构成威胁。提交报告详细描述了漏洞成因和修复建议。',
      issuedAt: new Date(),
      recipientName: '张三（预览模式）',
      reportNo: 'CQUPT-SRC-20260525-A1B2C3',
      sealBuffer: sealObject.body,
      severity: '高危',
      template: {
        layoutJson: template.layoutJson,
        sealMimeType: template.sealMimeType,
        sealStorageKey: template.sealStorageKey,
        templateMimeType: template.templateMimeType,
      },
      templateBuffer: templateObject.body,
      title: '【预览】存储型跨站脚本漏洞（XSS）',
      verifyCode: 'PREVIEW-ONLY',
    })

    await this.prisma.auditLog.create({
      data: {
        action: AuditAction.CHANGE_SYSTEM_SETTING,
        actorId: user.id,
        ipAddress: meta.ipAddress,
        metadata: { previewOnly: true, templateId: template.id, version: template.version },
        requestPath: meta.requestPath,
        result: 'success',
        targetId: template.id,
        targetType: 'CertificateTemplate',
        userAgent: meta.userAgent,
      },
    })

    return { body: pdfBuffer, contentType: 'application/pdf', fileName: 'certificate-preview.pdf' }
  }

  async previewCertificateTemplateLayout(layoutJson: unknown) {
    const template = await this.prisma.certificateTemplate.findFirst({
      where: { active: true },
      orderBy: { createdAt: 'desc' },
    })

    if (!template) {
      throw new NotFoundException('当前无启用的证书模板')
    }

    if (!layoutJson || typeof layoutJson !== 'object' || Array.isArray(layoutJson)) {
      throw new BadRequestException('layoutJson 必须是对象')
    }

    const [templateObject, sealObject] = await Promise.all([
      this.storage.getObject(template.templateStorageKey),
      template.sealStorageKey ? this.storage.getObject(template.sealStorageKey) : Promise.resolve(null),
    ])

    const pdfBuffer = await generateCertificatePdf({
      assetName: '重庆邮电大学学生工作系统',
      certificateNo: 'CQUPT-SRC-CERT-2026-A1B2C3',
      certificateType: '漏洞贡献证书',
      contribution: '发现了一处存储型跨站脚本漏洞（XSS），攻击者可通过该漏洞向其他用户注入恶意脚本，对用户数据安全构成威胁。提交报告详细描述了漏洞成因和修复建议。',
      issuedAt: new Date(),
      recipientName: '张三',
      reportNo: 'CQUPT-SRC-20260525-A1B2C3',
      sealBuffer: sealObject?.body,
      severity: '高危',
      template: {
        layoutJson,
        sealMimeType: template.sealMimeType,
        sealStorageKey: template.sealStorageKey,
        templateMimeType: template.templateMimeType,
      },
      templateBuffer: templateObject.body,
      title: '存储型跨站脚本漏洞',
      verifyCode: 'VERIFY-CODE-1234',
    })

    return { body: pdfBuffer, contentType: 'application/pdf', fileName: 'certificate-layout-preview.pdf' }
  }

  async previewCertificateTemplateBackground() {
    const template = await this.prisma.certificateTemplate.findFirst({
      where: { active: true },
      orderBy: { createdAt: 'desc' },
    })

    if (!template) {
      throw new NotFoundException('当前无启用的证书模板，请先上传背景图')
    }

    const templateObject = await this.storage.getObject(template.templateStorageKey)
    const dimensions = await getTemplateDimensions(template.templateMimeType, templateObject.body)
    return {
      body: templateObject.body,
      contentType: template.templateMimeType,
      fileName: template.name || 'certificate-template',
      height: dimensions.height,
      width: dimensions.width,
    }
  }

  async previewCertificateSeal() {
    const template = await this.prisma.certificateTemplate.findFirst({
      where: { active: true },
      orderBy: { createdAt: 'desc' },
    })

    if (!template || !template.sealStorageKey || !template.sealMimeType) {
      throw new NotFoundException('当前证书模板未配置电子印章')
    }

    const sealObject = await this.storage.getObject(template.sealStorageKey)
    const dimensions = getPngDimensions(sealObject.body)
    return {
      body: sealObject.body,
      contentType: template.sealMimeType,
      fileName: 'certificate-seal.png',
      height: dimensions.height,
      width: dimensions.width,
    }
  }

  async getRegistrationMode(): Promise<RegistrationMode> {
    const setting = await this.prisma.systemSetting.findUnique({ where: { key: 'open_registration' } })
    const open = setting ? (setting.value as boolean) !== false : true
    return { open }
  }

  async setRegistrationMode(
    open: boolean,
    user: AuthenticatedRequestUser,
    meta: ClientRequestMeta,
  ): Promise<RegistrationMode> {
    await this.prisma.$transaction(async (tx) => {
      await tx.systemSetting.upsert({
        where: { key: 'open_registration' },
        update: { value: open, updatedById: user.id },
        create: {
          key: 'open_registration',
          value: open,
          description: '是否开放自由注册',
          updatedById: user.id,
        },
      })

      await tx.auditLog.create({
        data: {
          action: AuditAction.CHANGE_SYSTEM_SETTING,
          actorId: user.id,
          ipAddress: meta.ipAddress,
          metadata: { key: 'open_registration', value: open },
          requestPath: meta.requestPath,
          result: 'success',
          targetType: 'SystemSetting',
        },
      })
    })

    return { open }
  }

  async listPendingRegistrations(): Promise<PendingRegistrationItem[]> {
    const users = await this.prisma.user.findMany({
      where: { pendingRegistrationApproval: true, status: UserStatus.PENDING },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        email: true,
        unifiedCode: true,
        college: true,
        identityText: true,
        studentNo: true,
        grade: true,
        createdAt: true,
      },
    })

    return users
  }

  async approveRegistration(
    id: string,
    user: AuthenticatedRequestUser,
    meta: ClientRequestMeta,
  ): Promise<{ success: true }> {
    const target = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, status: true, pendingRegistrationApproval: true, name: true },
    })

    if (!target || !target.pendingRegistrationApproval || target.status !== UserStatus.PENDING) {
      throw new NotFoundException('未找到待审核注册申请')
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { status: UserStatus.ACTIVE, pendingRegistrationApproval: false },
      })

      await tx.auditLog.create({
        data: {
          action: AuditAction.MANAGE_USER,
          actorId: user.id,
          ipAddress: meta.ipAddress,
          metadata: { action: 'approve_registration', targetName: target.name },
          requestPath: meta.requestPath,
          result: 'success',
          targetId: id,
          targetType: 'User',
          userAgent: meta.userAgent,
        },
      })
    })

    return { success: true }
  }

  async rejectRegistration(
    id: string,
    user: AuthenticatedRequestUser,
    meta: ClientRequestMeta,
  ): Promise<{ success: true }> {
    const target = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, status: true, pendingRegistrationApproval: true, name: true },
    })

    if (!target || !target.pendingRegistrationApproval || target.status !== UserStatus.PENDING) {
      throw new NotFoundException('未找到待审核注册申请')
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { status: UserStatus.DISABLED, pendingRegistrationApproval: false },
      })

      await tx.auditLog.create({
        data: {
          action: AuditAction.MANAGE_USER,
          actorId: user.id,
          ipAddress: meta.ipAddress,
          metadata: { action: 'reject_registration', targetName: target.name },
          requestPath: meta.requestPath,
          result: 'success',
          targetId: id,
          targetType: 'User',
          userAgent: meta.userAgent,
        },
      })
    })

    return { success: true }
  }

  async getPlatformSettings(): Promise<PlatformSettings> {
    const keys = [
      'platform_name',
      'school_name',
      'org_name',
      'platform_domain',
      'public_cert_verify',
      'school_logo_url',
      'navigation_logo_url',
      'navigation_logo_url_dark',
      'auth_logo_url',
      'auth_logo_url_dark',
      'favicon_url',
      'theme_color',
      'theme_palette',
    ]
    const rows = await this.prisma.systemSetting.findMany({ where: { key: { in: keys } } })
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
    const themePalette = normalizeThemePalette(map['theme_palette'])
    const themeColor = typeof map['theme_color'] === 'string' && isHexColor(map['theme_color']) ? map['theme_color'].toUpperCase() : DEFAULT_THEME_COLOR
    const legacyLogoUrl = typeof map['school_logo_url'] === 'string' ? map['school_logo_url'] : null
    return {
      authLogoUrl: typeof map['auth_logo_url'] === 'string' ? map['auth_logo_url'] : legacyLogoUrl,
      authLogoUrlDark: typeof map['auth_logo_url_dark'] === 'string' ? map['auth_logo_url_dark'] : null,
      faviconUrl: typeof map['favicon_url'] === 'string' ? map['favicon_url'] : legacyLogoUrl,
      logoUrl: legacyLogoUrl,
      navigationLogoUrl: typeof map['navigation_logo_url'] === 'string' ? map['navigation_logo_url'] : legacyLogoUrl,
      navigationLogoUrlDark: typeof map['navigation_logo_url_dark'] === 'string' ? map['navigation_logo_url_dark'] : null,
      platformName: typeof map['platform_name'] === 'string' ? map['platform_name'] : 'CQUPT-SRC 校园漏洞响应平台',
      schoolName: typeof map['school_name'] === 'string' ? map['school_name'] : '重庆邮电大学',
      orgName: typeof map['org_name'] === 'string' ? map['org_name'] : '信息化办公室',
      platformDomain: typeof map['platform_domain'] === 'string' ? map['platform_domain'] : 'https://src.cqupt.edu.cn',
      publicCertVerify: typeof map['public_cert_verify'] === 'boolean' ? map['public_cert_verify'] : true,
      themeColor: typeof themePalette.primary === 'string' ? themePalette.primary : typeof themePalette['600'] === 'string' ? themePalette['600'] : themeColor,
      themePalette,
    }
  }

  async uploadSchoolLogo(
    file: UploadedSettingsFile | undefined,
    user: AuthenticatedRequestUser,
    meta: ClientRequestMeta,
  ): Promise<PlatformSettings> {
    return this.uploadPlatformLogo('navigation', file, user, meta)
  }

  async uploadPlatformLogo(
    slot: PlatformLogoSlot,
    file: UploadedSettingsFile | undefined,
    user: AuthenticatedRequestUser,
    meta: ClientRequestMeta,
    mode: PlatformLogoMode = 'light',
  ): Promise<PlatformSettings> {
    const validatedFile = validateImageFile(file, MAX_SCHOOL_LOGO_SIZE_BYTES, '图标')
    const logoUrl = `data:${validatedFile.mimeType};base64,${validatedFile.buffer.toString('base64')}`
    const darkSettingKey = platformLogoDarkSettingKeys[slot]
    const settingKey = mode === 'dark' && darkSettingKey ? darkSettingKey : platformLogoSettingKeys[slot]

    await this.prisma.$transaction(async (tx) => {
      await tx.systemSetting.upsert({
        where: { key: settingKey },
        update: { value: logoUrl, updatedById: user.id },
        create: {
          key: settingKey,
          value: logoUrl,
          description: `${platformLogoSettingDescriptions[slot]}${mode === 'dark' && darkSettingKey ? '（黑夜模式）' : '（白天模式）'}`,
          updatedById: user.id,
        },
      })

      if (slot === 'navigation' && mode !== 'dark') {
        await tx.systemSetting.upsert({
          where: { key: 'school_logo_url' },
          update: { value: logoUrl, updatedById: user.id },
          create: {
            key: 'school_logo_url',
            value: logoUrl,
            description: '菜单栏图标',
            updatedById: user.id,
          },
        })
      }

      await tx.auditLog.create({
        data: {
          action: AuditAction.CHANGE_SYSTEM_SETTING,
          actorId: user.id,
          ipAddress: meta.ipAddress,
          metadata: {
            key: settingKey,
            mimeType: validatedFile.mimeType,
            mode,
            slot,
            size: validatedFile.buffer.length,
          },
          requestPath: meta.requestPath,
          result: 'success',
          targetType: 'SystemSetting',
          userAgent: meta.userAgent,
        },
      })
    })

    return this.getPlatformSettings()
  }

  async resetPlatformLogo(
    slot: PlatformLogoSlot,
    user: AuthenticatedRequestUser,
    meta: ClientRequestMeta,
    mode: PlatformLogoMode = 'light',
  ): Promise<PlatformSettings> {
    const darkSettingKey = platformLogoDarkSettingKeys[slot]
    const settingKey = mode === 'dark' && darkSettingKey ? darkSettingKey : platformLogoSettingKeys[slot]
    const keys = slot === 'navigation' && mode !== 'dark' ? [settingKey, 'school_logo_url'] : [settingKey]

    await this.prisma.$transaction(async (tx) => {
      await tx.systemSetting.deleteMany({ where: { key: { in: keys } } })

      await tx.auditLog.create({
        data: {
          action: AuditAction.CHANGE_SYSTEM_SETTING,
          actorId: user.id,
          ipAddress: meta.ipAddress,
          metadata: {
            key: settingKey,
            mode,
            slot,
            resetToDefault: true,
          },
          requestPath: meta.requestPath,
          result: 'success',
          targetType: 'SystemSetting',
          userAgent: meta.userAgent,
        },
      })
    })

    return this.getPlatformSettings()
  }

  async getAiAssistantAppearance(): Promise<AiAssistantAppearance> {
    const setting = await this.prisma.systemSetting.findUnique({ where: { key: 'ai_assistant_avatar_url' } })
    return {
      avatarUrl: typeof setting?.value === 'string' ? setting.value : null,
    }
  }

  async uploadAiAssistantAvatar(
    file: UploadedSettingsFile | undefined,
    user: AuthenticatedRequestUser,
    meta: ClientRequestMeta,
  ): Promise<AiAssistantAppearance> {
    const validatedFile = validateImageFile(file, MAX_AI_AVATAR_SIZE_BYTES, '头像')
    const avatarUrl = `data:${validatedFile.mimeType};base64,${validatedFile.buffer.toString('base64')}`

    await this.prisma.$transaction(async (tx) => {
      await tx.systemSetting.upsert({
        where: { key: 'ai_assistant_avatar_url' },
        update: { value: avatarUrl, updatedById: user.id },
        create: {
          key: 'ai_assistant_avatar_url',
          value: avatarUrl,
          description: '邮宝头像',
          updatedById: user.id,
        },
      })

      await tx.auditLog.create({
        data: {
          action: AuditAction.CHANGE_SYSTEM_SETTING,
          actorId: user.id,
          ipAddress: meta.ipAddress,
          metadata: {
            key: 'ai_assistant_avatar_url',
            mimeType: validatedFile.mimeType,
            size: validatedFile.buffer.length,
          },
          requestPath: meta.requestPath,
          result: 'success',
          targetType: 'SystemSetting',
          userAgent: meta.userAgent,
        },
      })
    })

    return { avatarUrl }
  }

  async getAiQuotaSettings(): Promise<AiQuotaSettings> {
    const rows = await this.prisma.systemSetting.findMany({
      where: {
        key: {
          in: [
            AI_DEFAULT_DAILY_TOKENS_KEY,
            AI_DEFAULT_WEEKLY_TOKENS_KEY,
            AI_DEFAULT_MONTHLY_TOKENS_KEY,
            AI_QUOTA_PERIOD_KEY,
          ],
        },
      },
    })
    const map = Object.fromEntries(rows.map((row) => [row.key, row.value]))
    const quotaPeriod = normalizeQuotaPeriod(map[AI_QUOTA_PERIOD_KEY])
    return {
      defaultDailyTokens: normalizeStoredTokenLimit(map[AI_DEFAULT_DAILY_TOKENS_KEY], DEFAULT_AI_DAILY_TOKENS),
      defaultMonthlyTokens: normalizeStoredTokenLimit(map[AI_DEFAULT_MONTHLY_TOKENS_KEY], DEFAULT_AI_MONTHLY_TOKENS),
      defaultWeeklyTokens: normalizeStoredTokenLimit(map[AI_DEFAULT_WEEKLY_TOKENS_KEY], DEFAULT_AI_WEEKLY_TOKENS),
      quotaPeriod,
      resetAt: getNextPeriodStart(quotaPeriod),
    }
  }

  async updateAiQuotaSettings(
    body: Partial<AiQuotaSettings>,
    user: AuthenticatedRequestUser,
    meta: ClientRequestMeta,
  ): Promise<AiQuotaSettings> {
    const defaultDailyTokens = validateTokenLimit(body.defaultDailyTokens)
    const defaultWeeklyTokens = validateTokenLimit(body.defaultWeeklyTokens)
    const defaultMonthlyTokens = validateTokenLimit(body.defaultMonthlyTokens)
    const quotaPeriod = validateQuotaPeriod(body.quotaPeriod)

    const updates = [
      { key: AI_DEFAULT_DAILY_TOKENS_KEY, value: defaultDailyTokens, description: '新用户默认 AI 日 token 额度' },
      { key: AI_DEFAULT_WEEKLY_TOKENS_KEY, value: defaultWeeklyTokens, description: '新用户默认 AI 周 token 额度' },
      { key: AI_DEFAULT_MONTHLY_TOKENS_KEY, value: defaultMonthlyTokens, description: '新用户默认 AI 月 token 额度' },
      { key: AI_QUOTA_PERIOD_KEY, value: quotaPeriod, description: 'AI token 额度重置周期' },
    ] satisfies Array<{ key: string; value: import('@prisma/client').Prisma.InputJsonValue; description: string }>

    await this.prisma.$transaction(async (tx) => {
      await Promise.all(
        updates.map((item) =>
          tx.systemSetting.upsert({
            where: { key: item.key },
            update: { value: item.value, updatedById: user.id },
            create: {
              key: item.key,
              value: item.value,
              description: item.description,
              updatedById: user.id,
            },
          }),
        ),
      )

      await tx.auditLog.create({
        data: {
          action: AuditAction.CHANGE_SYSTEM_SETTING,
          actorId: user.id,
          ipAddress: meta.ipAddress,
          metadata: {
            defaultDailyTokens,
            defaultMonthlyTokens,
            defaultWeeklyTokens,
            quotaPeriod,
          },
          requestPath: meta.requestPath,
          result: 'success',
          targetType: 'SystemSetting',
          userAgent: meta.userAgent,
        },
      })
    })

    return { defaultDailyTokens, defaultMonthlyTokens, defaultWeeklyTokens, quotaPeriod, resetAt: getNextPeriodStart(quotaPeriod) }
  }

  async getAiKnowledgeUsagePolicySettings(): Promise<AiKnowledgeUsagePolicySettings> {
    const row = await this.prisma.systemSetting.findUnique({ where: { key: AI_KNOWLEDGE_USAGE_POLICY_KEY } })
    return normalizeKnowledgeUsagePolicySettings(isRecord(row?.value) ? row.value : {})
  }

  async updateAiKnowledgeUsagePolicySettings(
    body: Partial<AiKnowledgeUsagePolicySettings> & { changeReason?: string },
    user: AuthenticatedRequestUser,
    meta: ClientRequestMeta,
  ): Promise<AiKnowledgeUsagePolicySettings> {
    const changeReason = typeof body.changeReason === 'string' ? body.changeReason.trim() : ''
    if (changeReason.length < 2 || changeReason.length > 300) {
      throw new BadRequestException('修改原因不能为空且不超过 300 个字符')
    }
    const before = await this.getAiKnowledgeUsagePolicySettings()
    const after = normalizeKnowledgeUsagePolicySettings({
      agentInjectEnabled: body.agentInjectEnabled,
      allowAttachmentKnowledgeInjection: body.allowAttachmentKnowledgeInjection,
      auditCandidateHits: body.auditCandidateHits,
      directAnswerEnabled: body.directAnswerEnabled,
      directThresholdOverride: body.directThresholdOverride,
      directTopKOverride: body.directTopKOverride,
      injectThresholdOverride: body.injectThresholdOverride,
      injectTopKOverride: body.injectTopKOverride,
      knowledgeUsageStrength: body.knowledgeUsageStrength,
      requireSourceBadge: body.requireSourceBadge,
      retrievalEnabled: body.retrievalEnabled,
    })

    await this.prisma.$transaction(async (tx) => {
      await tx.systemSetting.upsert({
        create: {
          description: 'AI 知识库使用强度与受控路由策略',
          key: AI_KNOWLEDGE_USAGE_POLICY_KEY,
          updatedById: user.id,
          value: after as unknown as import('@prisma/client').Prisma.InputJsonValue,
        },
        update: {
          updatedById: user.id,
          value: after as unknown as import('@prisma/client').Prisma.InputJsonValue,
        },
        where: { key: AI_KNOWLEDGE_USAGE_POLICY_KEY },
      })
      await tx.auditLog.create({
        data: {
          action: AuditAction.CHANGE_SYSTEM_SETTING,
          actorId: user.id,
          ipAddress: meta.ipAddress,
          metadata: {
            after,
            before,
            changeReason,
            key: AI_KNOWLEDGE_USAGE_POLICY_KEY,
          },
          requestPath: meta.requestPath,
          result: 'success',
          targetType: 'SystemSetting',
          userAgent: meta.userAgent,
        },
      })
    })

    return after
  }

  async updatePlatformSettings(
    body: Partial<PlatformSettings>,
    user: AuthenticatedRequestUser,
    meta: ClientRequestMeta,
  ): Promise<PlatformSettings> {
    const { platformName, schoolName, orgName, platformDomain, publicCertVerify, themeColor, themePalette } = body

    if (platformName !== undefined && (typeof platformName !== 'string' || platformName.trim().length === 0 || platformName.length > 100)) {
      throw new BadRequestException('平台名称不能为空且不超过 100 个字符')
    }
    if (schoolName !== undefined && (typeof schoolName !== 'string' || schoolName.trim().length === 0 || schoolName.length > 100)) {
      throw new BadRequestException('学校名称不能为空且不超过 100 个字符')
    }
    if (orgName !== undefined && (typeof orgName !== 'string' || orgName.trim().length === 0 || orgName.length > 100)) {
      throw new BadRequestException('主管单位不能为空且不超过 100 个字符')
    }
    if (platformDomain !== undefined) {
      try {
        const url = new URL(platformDomain as string)
        if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error()
      } catch {
        throw new BadRequestException('平台访问域名必须是有效的 URL（以 http:// 或 https:// 开头）')
      }
    }
    if (themeColor !== undefined && (typeof themeColor !== 'string' || !isHexColor(themeColor))) {
      throw new BadRequestException('主题色必须是 #RRGGBB 格式的十六进制颜色')
    }
    const normalizedThemePalette = themePalette !== undefined ? normalizeThemePaletteForSave(themePalette) : undefined

    type UpsertEntry = { key: string; value: import('@prisma/client').Prisma.InputJsonValue; description: string }
    const updates: UpsertEntry[] = []
    if (platformName !== undefined) updates.push({ key: 'platform_name', value: platformName.trim(), description: '平台名称' })
    if (schoolName !== undefined) updates.push({ key: 'school_name', value: schoolName.trim(), description: '学校名称' })
    if (orgName !== undefined) updates.push({ key: 'org_name', value: orgName.trim(), description: '主管单位' })
    if (platformDomain !== undefined) updates.push({ key: 'platform_domain', value: (platformDomain as string).trim(), description: '平台访问域名' })
    if (publicCertVerify !== undefined) updates.push({ key: 'public_cert_verify', value: Boolean(publicCertVerify), description: '公开证书查询' })
    if (themeColor !== undefined) updates.push({ key: 'theme_color', value: themeColor.trim().toUpperCase(), description: '平台主题色' })
    if (normalizedThemePalette !== undefined) {
      updates.push({ key: 'theme_palette', value: normalizedThemePalette, description: '平台主题色卡' })
      if ((normalizedThemePalette.primary || normalizedThemePalette['600']) && themeColor === undefined) {
        updates.push({ key: 'theme_color', value: normalizedThemePalette.primary ?? normalizedThemePalette['600'], description: '平台主题色' })
      }
    }

    if (updates.length > 0) {
      await this.prisma.$transaction(async (tx) => {
        await Promise.all(
          updates.map((u) =>
            tx.systemSetting.upsert({
              where: { key: u.key },
              update: { value: u.value, updatedById: user.id },
              create: { key: u.key, value: u.value, description: u.description, updatedById: user.id },
            }),
          ),
        )

        await tx.auditLog.create({
          data: {
            action: AuditAction.CHANGE_SYSTEM_SETTING,
            actorId: user.id,
            ipAddress: meta.ipAddress,
            metadata: { keys: updates.map((u) => u.key) },
            requestPath: meta.requestPath,
            result: 'success',
            targetType: 'SystemSetting',
          },
        })
      })
    }

    return this.getPlatformSettings()
  }
}

function summarizeTemplate(template: {
  active: boolean
  createdAt: Date
  id: string
  layoutJson: unknown
  name: string
  sealStorageKey: string | null
  templateMimeType: string
  templateSizeBytes: number
  updatedAt: Date
  version: string
}): CertificateTemplateSummary {
  return {
    active: template.active,
    createdAt: template.createdAt,
    id: template.id,
    layoutJson: template.layoutJson,
    name: template.name,
    sealConfigured: Boolean(template.sealStorageKey),
    templateMimeType: template.templateMimeType,
    templateSizeBytes: template.templateSizeBytes,
    updatedAt: template.updatedAt,
    version: template.version,
  }
}

function validateTemplateFile(file: UploadedSettingsFile | undefined) {
  const validated = validateUploadedFile(file, MAX_TEMPLATE_SIZE_BYTES)
  const extension = extname(validated.originalname).toLowerCase()
  const isPdf = extension === '.pdf' && validated.mimeType === 'application/pdf' && hasPdfMagicBytes(validated.buffer)
  const isPng = extension === '.png' && validated.mimeType === 'image/png' && hasPngMagicBytes(validated.buffer)

  if (!isPdf && !isPng) {
    throw new BadRequestException('证书背景模板仅支持真实 PDF 或 PNG 文件')
  }

  return validated
}

async function getTemplateDimensions(mimeType: string, body: Buffer) {
  if (mimeType === 'application/pdf') {
    const pdf = await PDFDocument.load(body)
    const page = pdf.getPage(0)
    return { height: page.getHeight(), width: page.getWidth() }
  }

  if (mimeType === 'image/png') {
    return getPngDimensions(body)
  }

  throw new BadRequestException('不支持的证书模板格式')
}

function getPngDimensions(body: Buffer) {
  if (!hasPngMagicBytes(body) || body.length < 24) {
    throw new BadRequestException('PNG 文件损坏，无法读取尺寸')
  }

  return {
    height: body.readUInt32BE(20),
    width: body.readUInt32BE(16),
  }
}

function validateSealFile(file: UploadedSettingsFile | undefined) {
  const validated = validateUploadedFile(file, MAX_SEAL_SIZE_BYTES)
  const extension = extname(validated.originalname).toLowerCase()

  if (extension !== '.png' || validated.mimeType !== 'image/png' || !hasPngMagicBytes(validated.buffer)) {
    throw new BadRequestException('电子印章仅支持真实 PNG 文件')
  }

  return validated
}

function validateImageFile(file: UploadedSettingsFile | undefined, maxBytes: number, displayName: string) {
  const validated = validateUploadedFile(file, maxBytes)
  const extension = extname(validated.originalname).toLowerCase()
  const validMime = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(validated.mimeType)
  const validExtension = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(extension)

  if (!validMime || !validExtension) {
    throw new BadRequestException(`${displayName}仅支持 JPG、PNG、WebP、GIF 格式`)
  }

  return validated
}

function isHexColor(value: string) {
  return /^#[0-9A-Fa-f]{6}$/.test(value.trim())
}

function normalizeThemePalette(value: unknown) {
  if (!isRecord(value)) return {}

  return BRAND_PALETTE_KEYS.reduce<Record<string, string>>((palette, key) => {
    const color = value[key]
    if (typeof color === 'string' && isHexColor(color)) {
      palette[key] = color.trim().toUpperCase()
    }
    return palette
  }, {})
}

function normalizeThemePaletteForSave(value: unknown) {
  if (!isRecord(value)) {
    throw new BadRequestException('主题色卡必须是色阶到颜色值的对象')
  }

  return BRAND_PALETTE_SLOTS.reduce<Record<string, string>>((palette, slot) => {
    const color = value[slot] ?? (slot === 'primary' ? value['600'] : undefined)
    if (color === undefined || color === null || color === '') {
      throw new BadRequestException(`主题色卡缺少 ${slot}`)
    }
    if (typeof color !== 'string' || !isHexColor(color)) {
      throw new BadRequestException(`${slot} 必须是 #RRGGBB 格式的十六进制颜色`)
    }
    palette[slot] = color.trim().toUpperCase()
    return palette
  }, normalizeThemePalette(value))
}

function validateUploadedFile(file: UploadedSettingsFile | undefined, maxBytes: number) {
  if (!file?.buffer || file.buffer.length === 0) {
    throw new BadRequestException('请上传文件')
  }

  if (file.buffer.length > maxBytes || (file.size ?? file.buffer.length) > maxBytes) {
    throw new BadRequestException(`文件不能超过 ${Math.floor(maxBytes / 1024 / 1024)}MB`)
  }

  return {
    buffer: file.buffer,
    mimeType: file.mimetype ?? 'application/octet-stream',
    originalname: file.originalname ?? 'certificate-template',
  }
}

function createStorageId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

function createTemplateVersion() {
  const now = new Date()
  const datePart = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('')

  return `cert-tpl-${datePart}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

function validateTokenLimit(value: unknown) {
  const numberValue = Number(value)
  if (!Number.isInteger(numberValue) || numberValue < 0 || numberValue > 100_000_000) {
    throw new BadRequestException('默认 AI token 额度必须是 0 到 100000000 之间的整数')
  }

  return numberValue
}

function normalizeKnowledgeUsagePolicySettings(value: Record<string, unknown>): AiKnowledgeUsagePolicySettings {
  return {
    agentInjectEnabled: booleanOrDefault(value.agentInjectEnabled, true),
    allowAttachmentKnowledgeInjection: booleanOrDefault(value.allowAttachmentKnowledgeInjection, false),
    auditCandidateHits: booleanOrDefault(value.auditCandidateHits, true),
    directAnswerEnabled: booleanOrDefault(value.directAnswerEnabled, true),
    directThresholdOverride: optionalNumber(value.directThresholdOverride, 0.8, 0.98),
    directTopKOverride: optionalInt(value.directTopKOverride, 0, 2),
    injectThresholdOverride: optionalNumber(value.injectThresholdOverride, 0.65, 0.95),
    injectTopKOverride: optionalInt(value.injectTopKOverride, 0, 5),
    knowledgeUsageStrength: intOrDefault(value.knowledgeUsageStrength, 5, 1, 10),
    requireSourceBadge: booleanOrDefault(value.requireSourceBadge, true),
    retrievalEnabled: booleanOrDefault(value.retrievalEnabled, true),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function booleanOrDefault(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback
}

function intOrDefault(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

function optionalInt(value: unknown, min: number, max: number) {
  if (value === undefined || value === null || value === '') return undefined
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new BadRequestException(`整数配置必须在 ${min} 到 ${max} 之间`)
  }
  return parsed
}

function optionalNumber(value: unknown, min: number, max: number) {
  if (value === undefined || value === null || value === '') return undefined
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new BadRequestException(`阈值配置必须在 ${min} 到 ${max} 之间`)
  }
  return Number(parsed.toFixed(3))
}

function validateQuotaPeriod(value: unknown): AiQuotaSettings['quotaPeriod'] {
  if (value === 'DAY' || value === 'WEEK' || value === 'MONTH') return value
  throw new BadRequestException('AI token 重置周期必须是 DAY、WEEK 或 MONTH')
}

function normalizeStoredTokenLimit(value: unknown, fallback: number) {
  const numberValue = Number(value)
  return Number.isInteger(numberValue) && numberValue >= 0 ? numberValue : fallback
}

function normalizeQuotaPeriod(value: unknown): AiQuotaSettings['quotaPeriod'] {
  return value === 'DAY' || value === 'WEEK' || value === 'MONTH' ? value : 'MONTH'
}

function getNextPeriodStart(period: AiQuotaSettings['quotaPeriod']) {
  if (period === 'DAY') return getNextDayStart()
  if (period === 'WEEK') return getNextWeekStart()
  return getNextMonthStart()
}

function getNextDayStart() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
}

function getWeekStart() {
  const now = new Date()
  const day = now.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset)
}

function getNextWeekStart() {
  const start = getWeekStart()
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7)
}

function getNextMonthStart() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() + 1, 1)
}

function hasPdfMagicBytes(buffer: Buffer) {
  return buffer.subarray(0, 5).toString('utf8') === '%PDF-'
}

function hasPngMagicBytes(buffer: Buffer) {
  return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
}

function sanitizeOriginalName(name: string) {
  return name
    .replace(/[\r\n]/g, '')
    .replace(/[\\/]/g, '-')
    .replace(/[^\w.\-\u4e00-\u9fa5]/g, '_')
    .slice(0, 120) || 'certificate-template'
}
