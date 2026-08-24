export type UploadedPdfFile = {
  buffer?: Buffer
  mimetype?: string
  originalname?: string
  size?: number
}

export type UploadedAttachmentFile = UploadedPdfFile
