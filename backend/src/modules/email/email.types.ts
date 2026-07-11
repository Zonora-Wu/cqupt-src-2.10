export type SmtpSecureMode = 'NONE' | 'SSL' | 'STARTTLS'

export type EmailPurpose =
  | 'CHANGE_EMAIL'
  | 'CHANGE_PASSWORD'
  | 'LOGIN'
  | 'REGISTER'

export type EmailServiceSettings = {
  enabled: boolean
  fromEmail: string
  fromName: string
  host: string
  password?: string
  passwordConfigured: boolean
  port: number
  replyTo: string
  secureMode: SmtpSecureMode
  username: string
}

export type UpdateEmailServiceSettingsInput = {
  enabled?: boolean
  fromEmail?: string
  fromName?: string
  host?: string
  password?: string
  clearPassword?: boolean
  port?: number
  replyTo?: string
  secureMode?: SmtpSecureMode
  username?: string
}

export type SendVerificationCodeInput = {
  code: string
  expiresInMinutes: number
  purpose: EmailPurpose
  to: string
}
