import { BadRequestException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common'
import { AuditAction, Prisma } from '@prisma/client'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import nodemailer from 'nodemailer'
import { PrismaService } from '../prisma/prisma.service'
import { AuthenticatedRequestUser, ClientRequestMeta } from '../auth/auth.types'
import { EmailServiceSettings, SendVerificationCodeInput, SmtpSecureMode, UpdateEmailServiceSettingsInput } from './email.types'

const EMAIL_SETTINGS_KEY = 'email_service_settings'
const secureModes: SmtpSecureMode[] = ['NONE', 'SSL', 'STARTTLS']

const defaultSettings: EmailServiceSettings = {
  enabled: false,
  fromEmail: '',
  fromName: 'CQUPT-SRC',
  host: '',
  passwordConfigured: false,
  port: 465,
  replyTo: '',
  secureMode: 'SSL',
  username: '',
}

@Injectable()
export class EmailService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getSettings(): Promise<EmailServiceSettings> {
    return redactSettings(await this.getStoredSettings())
  }

  async updateSettings(
    input: UpdateEmailServiceSettingsInput,
    user: AuthenticatedRequestUser,
    meta: ClientRequestMeta,
  ): Promise<EmailServiceSettings> {
    const current = await this.getStoredSettings()
    const nextPassword = input.clearPassword ? undefined : input.password !== undefined ? String(input.password) : current.password
    const next: EmailServiceSettings = sanitizeSettings({
      ...current,
      enabled: input.enabled ?? current.enabled,
      fromEmail: input.fromEmail ?? current.fromEmail,
      fromName: input.fromName ?? current.fromName,
      host: input.host ?? current.host,
      password: nextPassword,
      passwordConfigured: Boolean(nextPassword),
      port: input.port ?? current.port,
      replyTo: input.replyTo ?? current.replyTo,
      secureMode: input.secureMode ?? current.secureMode,
      username: input.username ?? current.username,
    })

    validateSettings(next)

    await this.prisma.$transaction(async (tx) => {
      await tx.systemSetting.upsert({
        where: { key: EMAIL_SETTINGS_KEY },
        update: {
          updatedById: user.id,
          value: settingsToJson(next),
        },
        create: {
          description: 'SMTP 邮件服务配置',
          key: EMAIL_SETTINGS_KEY,
          updatedById: user.id,
          value: settingsToJson(next),
        },
      })

      await tx.auditLog.create({
        data: {
          action: AuditAction.CHANGE_SYSTEM_SETTING,
          actorId: user.id,
          ipAddress: meta.ipAddress,
          metadata: {
            enabled: next.enabled,
            fromEmail: maskEmail(next.fromEmail),
            host: next.host,
            passwordChanged: input.password !== undefined || input.clearPassword === true,
            port: next.port,
            secureMode: next.secureMode,
          },
          requestPath: meta.requestPath,
          result: 'success',
          targetType: 'SystemSetting',
          userAgent: meta.userAgent,
        },
      })
    })

    return redactSettings(next)
  }

  async testSettings(to: string, user: AuthenticatedRequestUser, meta: ClientRequestMeta) {
    const recipient = normalizeEmail(to)
    const settings = await this.getOperationalSettings()
    const transporter = this.createTransporter(settings)

    await transporter.verify()
    await transporter.sendMail({
      from: formatSender(settings),
      replyTo: settings.replyTo || undefined,
      subject: 'CQUPT-SRC 邮件服务测试',
      text: [
        '这是一封来自 CQUPT-SRC 平台的邮件服务测试。',
        '',
        '如果你收到这封邮件，说明当前 SMTP 配置可以正常发送平台验证码与通知。',
      ].join('\n'),
      to: recipient,
    })

    await this.prisma.auditLog.create({
      data: {
        action: AuditAction.CHANGE_SYSTEM_SETTING,
        actorId: user.id,
        ipAddress: meta.ipAddress,
        metadata: { action: 'test_smtp_email', to: maskEmail(recipient) },
        requestPath: meta.requestPath,
        result: 'success',
        targetType: 'SystemSetting',
        userAgent: meta.userAgent,
      },
    })

    return { message: `测试邮件已发送至 ${maskEmail(recipient)}` }
  }

  async sendVerificationCode(input: SendVerificationCodeInput) {
    const settings = await this.getOperationalSettings()
    const transporter = this.createTransporter(settings)
    const purposeText = getPurposeText(input.purpose)
    const platformName = settings.fromName || 'CQUPT-SRC'

    await transporter.sendMail({
      from: formatSender(settings),
      html: renderVerificationCodeHtml({
        code: input.code,
        expiresInMinutes: input.expiresInMinutes,
        platformName,
        purposeText,
      }),
      replyTo: settings.replyTo || undefined,
      subject: `${platformName} ${purposeText}验证码`,
      text: [
        `${platformName} ${purposeText}验证码：${input.code}`,
        '',
        `验证码 ${input.expiresInMinutes} 分钟内有效，请勿转发给他人。`,
        '如果不是你本人操作，请忽略这封邮件。',
      ].join('\n'),
      to: input.to,
    })
  }

  private async getOperationalSettings() {
    const settings = await this.getStoredSettings()
    validateSettings(settings)
    if (!settings.enabled) {
      throw new ServiceUnavailableException('邮件服务尚未启用，请先在系统设置中配置 SMTP')
    }
    if (!settings.passwordConfigured || !settings.password) {
      throw new ServiceUnavailableException('SMTP 密码或授权码未配置')
    }
    return settings
  }

  private async getStoredSettings(): Promise<EmailServiceSettings> {
    const setting = await this.prisma.systemSetting.findUnique({ where: { key: EMAIL_SETTINGS_KEY } })
    return normalizeStoredSettings(setting?.value)
  }

  private createTransporter(settings: EmailServiceSettings) {
    return nodemailer.createTransport({
      auth: {
        pass: settings.password,
        user: settings.username,
      },
      host: settings.host,
      port: settings.port,
      requireTLS: settings.secureMode === 'STARTTLS',
      secure: settings.secureMode === 'SSL',
    })
  }
}

function normalizeStoredSettings(value: unknown): EmailServiceSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return defaultSettings
  return sanitizeSettings({ ...defaultSettings, ...(value as Record<string, unknown>) })
}

function sanitizeSettings(raw: Record<string, unknown>): EmailServiceSettings {
  const secureMode = secureModes.includes(raw.secureMode as SmtpSecureMode) ? raw.secureMode as SmtpSecureMode : 'SSL'
  const password = readStoredPassword(raw.password)
  return {
    enabled: raw.enabled === true,
    fromEmail: typeof raw.fromEmail === 'string' ? raw.fromEmail.trim().toLowerCase() : '',
    fromName: typeof raw.fromName === 'string' ? raw.fromName.trim().slice(0, 60) : defaultSettings.fromName,
    host: typeof raw.host === 'string' ? raw.host.trim() : '',
    password,
    passwordConfigured: Boolean(password || raw.passwordConfigured),
    port: Number.isInteger(Number(raw.port)) ? Number(raw.port) : defaultSettings.port,
    replyTo: typeof raw.replyTo === 'string' ? raw.replyTo.trim().toLowerCase() : '',
    secureMode,
    username: typeof raw.username === 'string' ? raw.username.trim() : '',
  }
}

function validateSettings(settings: EmailServiceSettings) {
  if (!settings.enabled && !settings.host && !settings.fromEmail && !settings.username) return
  if (!settings.host || settings.host.length > 255) throw new BadRequestException('SMTP 地址不能为空且不能超过 255 个字符')
  if (!Number.isInteger(settings.port) || settings.port < 1 || settings.port > 65535) throw new BadRequestException('SMTP 端口必须是 1-65535 的整数')
  if (!secureModes.includes(settings.secureMode)) throw new BadRequestException('SMTP 加密方式无效')
  if (!isEmail(settings.fromEmail)) throw new BadRequestException('发件邮箱格式不正确')
  if (settings.replyTo && !isEmail(settings.replyTo)) throw new BadRequestException('回复邮箱格式不正确')
  if (!settings.username) throw new BadRequestException('SMTP 用户名不能为空')
}

function settingsToJson(settings: EmailServiceSettings): Prisma.InputJsonValue {
  return {
    enabled: settings.enabled,
    fromEmail: settings.fromEmail,
    fromName: settings.fromName,
    host: settings.host,
    password: settings.password ? encryptSecret(settings.password) : null,
    passwordConfigured: settings.passwordConfigured,
    port: settings.port,
    replyTo: settings.replyTo,
    secureMode: settings.secureMode,
    username: settings.username,
  }
}

function readStoredPassword(value: unknown) {
  if (typeof value === 'string' && value.length > 0) return value
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const encrypted = value as Record<string, unknown>
  if (
    encrypted.algorithm !== 'aes-256-gcm' ||
    typeof encrypted.ciphertext !== 'string' ||
    typeof encrypted.iv !== 'string' ||
    typeof encrypted.tag !== 'string'
  ) {
    return undefined
  }
  try {
    const decipher = createDecipheriv('aes-256-gcm', getSecretKey(), Buffer.from(encrypted.iv, 'base64'))
    decipher.setAuthTag(Buffer.from(encrypted.tag, 'base64'))
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted.ciphertext, 'base64')),
      decipher.final(),
    ]).toString('utf8')
  } catch {
    return undefined
  }
}

function encryptSecret(value: string): Prisma.InputJsonValue {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', getSecretKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return {
    algorithm: 'aes-256-gcm',
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
  }
}

function getSecretKey() {
  return createHash('sha256')
    .update(process.env.JWT_REFRESH_SECRET || process.env.JWT_ACCESS_SECRET || 'cqupt-src-email-secret')
    .digest()
}

function redactSettings(settings: EmailServiceSettings): EmailServiceSettings {
  const { password: _password, ...safeSettings } = settings
  return safeSettings
}

function normalizeEmail(value: string) {
  const email = value.trim().toLowerCase()
  if (!isEmail(email)) throw new BadRequestException('测试收件邮箱格式不正确')
  return email
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function formatSender(settings: EmailServiceSettings) {
  return settings.fromName ? `"${settings.fromName.replace(/"/g, '')}" <${settings.fromEmail}>` : settings.fromEmail
}

function getPurposeText(purpose: SendVerificationCodeInput['purpose']) {
  switch (purpose) {
    case 'CHANGE_EMAIL':
      return '修改邮箱'
    case 'CHANGE_PASSWORD':
      return '修改密码'
    case 'LOGIN':
      return '登录'
    case 'REGISTER':
      return '注册'
  }
}

function renderVerificationCodeHtml(input: { code: string; expiresInMinutes: number; platformName: string; purposeText: string }) {
  return `
  <div style="margin:0;background:#f6f8fb;padding:32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      <div style="padding:24px 28px;border-bottom:1px solid #e2e8f0;">
        <div style="font-size:14px;color:#475569;">${escapeHtml(input.platformName)}</div>
        <div style="margin-top:6px;font-size:20px;font-weight:700;">${escapeHtml(input.purposeText)}验证码</div>
      </div>
      <div style="padding:28px;">
        <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#334155;">你正在进行${escapeHtml(input.purposeText)}操作，请在页面中输入以下验证码。</p>
        <div style="letter-spacing:8px;font-size:32px;font-weight:800;color:#14532d;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:18px;text-align:center;">${input.code}</div>
        <p style="margin:18px 0 0;font-size:13px;line-height:1.7;color:#64748b;">验证码 ${input.expiresInMinutes} 分钟内有效。请勿将验证码转发给任何人，平台工作人员不会向你索要验证码。</p>
      </div>
    </div>
  </div>`
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function maskEmail(email: string) {
  const [name, domain] = email.split('@')
  if (!domain) return email
  return `${name.slice(0, 2)}***@${domain}`
}
