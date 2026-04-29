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
