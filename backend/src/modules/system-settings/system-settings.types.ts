export type UploadedSettingsFile = {
  buffer?: Buffer
  mimetype?: string
  originalname?: string
  size?: number
}

export type CertificateTemplateSummary = {
  active: boolean
  createdAt: Date
  id: string
  name: string
  sealConfigured: boolean
  templateMimeType: string
  templateSizeBytes: number
  updatedAt: Date
  version: string
}

export type RegistrationMode = {
  open: boolean
}

export type PendingRegistrationItem = {
  id: string
  name: string
  email: string
  unifiedCode: string
  college: string | null
  identityText: string | null
  studentNo: string | null
  grade: string | null
  createdAt: Date
}
