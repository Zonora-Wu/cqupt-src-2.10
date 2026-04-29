import * as fontkit from '@pdf-lib/fontkit'
import { existsSync, readFileSync } from 'node:fs'
import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from 'pdf-lib'

type LayoutPoint = {
  align?: 'center' | 'left' | 'right'
  color?: string
  fontSize?: number
  height?: number
  lineHeight?: number
  maxWidth?: number
  width?: number
  x?: number
  y?: number
}

export type CertificatePdfTemplate = {
  layoutJson: unknown
  sealMimeType: string | null
  sealStorageKey: string | null
  templateMimeType: string
}

export type CertificatePdfInput = {
  assetName: string
  certificateNo: string
  contribution: string
  issuedAt: Date
  recipientName: string
  reportNo: string
  severity: string
  template: CertificatePdfTemplate
  templateBuffer: Buffer
  sealBuffer?: Buffer
  title: string
  verifyCode: string
}

type CertificateLayout = {
  assetName: LayoutPoint
  certificateNo: LayoutPoint
  contribution: LayoutPoint
  issuedAt: LayoutPoint
  recipientName: LayoutPoint
  reportNo: LayoutPoint
  seal: LayoutPoint
  severity: LayoutPoint
  title: LayoutPoint
  verifyCode: LayoutPoint
}

const DEFAULT_LAYOUT: CertificateLayout = {
  assetName: { fontSize: 12, maxWidth: 360, x: 118, y: 392 },
  certificateNo: { fontSize: 11, x: 86, y: 68 },
  contribution: { align: 'center', fontSize: 13, lineHeight: 22, maxWidth: 430, x: 300, y: 330 },
  issuedAt: { fontSize: 12, x: 420, y: 520 },
  recipientName: { align: 'center', fontSize: 28, x: 300, y: 220 },
  reportNo: { fontSize: 12, x: 118, y: 424 },
  seal: { width: 118, x: 430, y: 420 },
  severity: { fontSize: 12, x: 118, y: 456 },
  title: { align: 'center', fontSize: 15, maxWidth: 430, x: 300, y: 292 },
  verifyCode: { fontSize: 10, x: 86, y: 94 },
}

const FONT_PATH_CANDIDATES = [
  process.env.CERTIFICATE_FONT_PATH,
  'C:\\Windows\\Fonts\\simhei.ttf',
  'C:\\Windows\\Fonts\\msyh.ttc',
  '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
  '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
  '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
].filter(Boolean) as string[]

export async function generateCertificatePdf(input: CertificatePdfInput) {
  const pdfDoc = await loadTemplateDocument(input.template.templateMimeType, input.templateBuffer)
  const page = pdfDoc.getPage(0)
  const layout = mergeLayout(input.template.layoutJson)
  const regularFont = await embedPreferredFont(pdfDoc, false)
  const boldFont = await embedPreferredFont(pdfDoc, true)

  drawText(page, input.certificateNo, layout.certificateNo, regularFont)
  drawText(page, input.verifyCode, layout.verifyCode, regularFont)
  drawText(page, input.recipientName, layout.recipientName, boldFont)
  drawText(page, input.title, layout.title, regularFont)
  drawText(page, `报告编号：${input.reportNo}`, layout.reportNo, regularFont)
  drawText(page, `最终等级：${input.severity}`, layout.severity, regularFont)
  drawText(page, `影响资产：${input.assetName}`, layout.assetName, regularFont)
  drawText(page, formatDate(input.issuedAt), layout.issuedAt, regularFont)
  drawMultilineText(page, input.contribution, layout.contribution, regularFont)

  if (input.sealBuffer && input.template.sealStorageKey) {
    await drawSeal(pdfDoc, page, input.sealBuffer, layout.seal)
  }

  return Buffer.from(await pdfDoc.save())
}

async function loadTemplateDocument(templateMimeType: string, templateBuffer: Buffer) {
  if (templateMimeType === 'application/pdf') {
    return PDFDocument.load(templateBuffer)
  }

  if (templateMimeType === 'image/png') {
    const pdfDoc = await PDFDocument.create()
    const image = await pdfDoc.embedPng(templateBuffer)
    const page = pdfDoc.addPage([image.width, image.height])
    page.drawImage(image, {
      height: image.height,
      width: image.width,
      x: 0,
      y: 0,
    })
    return pdfDoc
  }

  throw new Error('不支持的证书模板格式')
}

async function embedPreferredFont(pdfDoc: PDFDocument, bold: boolean) {
  const fontPath = resolveFontPath(bold)

  if (fontPath) {
    pdfDoc.registerFontkit(fontkit)
    return pdfDoc.embedFont(readFileSync(fontPath), { subset: true })
  }

  return pdfDoc.embedFont(bold ? StandardFonts.HelveticaBold : StandardFonts.Helvetica)
}

function resolveFontPath(bold: boolean) {
  const explicitPath = process.env.CERTIFICATE_FONT_PATH
  if (explicitPath && existsSync(explicitPath)) {
    return explicitPath
  }

  const preferred = bold
    ? [
        'C:\\Windows\\Fonts\\simhei.ttf',
        'C:\\Windows\\Fonts\\msyhbd.ttc',
        '/usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc',
        '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',
      ]
    : FONT_PATH_CANDIDATES

  return preferred.find((path) => existsSync(path))
}

async function drawSeal(pdfDoc: PDFDocument, page: PDFPage, sealBuffer: Buffer, point: LayoutPoint) {
  const image = await pdfDoc.embedPng(sealBuffer)
  const pageHeight = page.getHeight()
  const width = point.width ?? DEFAULT_LAYOUT.seal.width ?? image.width
  const height = point.height ?? (width / image.width) * image.height
  const x = point.x ?? DEFAULT_LAYOUT.seal.x ?? 0
  const y = toPdfY(pageHeight, point.y ?? DEFAULT_LAYOUT.seal.y ?? 0, height)

  page.drawImage(image, {
    height,
    opacity: 0.92,
    width,
    x,
    y,
  })
}

function drawText(page: PDFPage, text: string, point: LayoutPoint, font: PDFFont) {
  const fontSize = point.fontSize ?? 12
  const color = parseColor(point.color)
  const safeText = canEncode(font, text) ? text : toPdfSafeText(text)
  const width = font.widthOfTextAtSize(safeText, fontSize)
  const x = resolveAlignedX(point, width)
  const y = toPdfY(page.getHeight(), point.y ?? 0, fontSize)

  page.drawText(safeText, {
    color,
    font,
    size: fontSize,
    x,
    y,
  })
}

function drawMultilineText(page: PDFPage, text: string, point: LayoutPoint, font: PDFFont) {
  const fontSize = point.fontSize ?? 12
  const lineHeight = point.lineHeight ?? fontSize * 1.65
  const maxWidth = point.maxWidth ?? 420
  const lines = wrapText(text, font, fontSize, maxWidth)
  const color = parseColor(point.color)

  lines.slice(0, 6).forEach((line, index) => {
    const safeText = canEncode(font, line) ? line : toPdfSafeText(line)
    const width = font.widthOfTextAtSize(safeText, fontSize)
    const x = resolveAlignedX(point, width)
    const y = toPdfY(page.getHeight(), (point.y ?? 0) + index * lineHeight, fontSize)

    page.drawText(safeText, {
      color,
      font,
      size: fontSize,
      x,
      y,
    })
  })
}

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number) {
  const compact = text.replace(/\s+/g, ' ').trim()
  const lines: string[] = []
  let current = ''

  for (const char of compact) {
    const next = current + char
    if (current && font.widthOfTextAtSize(canEncode(font, next) ? next : toPdfSafeText(next), fontSize) > maxWidth) {
      lines.push(current)
      current = char
      continue
    }
    current = next
  }

  if (current) {
    lines.push(current)
  }

  return lines
}

function resolveAlignedX(point: LayoutPoint, textWidth: number) {
  const x = point.x ?? 0
  if (point.align === 'center') return x - textWidth / 2
  if (point.align === 'right') return x - textWidth
  return x
}

function toPdfY(pageHeight: number, topY: number, height: number) {
  return pageHeight - topY - height
}

function mergeLayout(value: unknown): CertificateLayout {
  if (!value || typeof value !== 'object') {
    return DEFAULT_LAYOUT
  }

  const input = value as Record<string, unknown>
  return {
    assetName: mergePoint(DEFAULT_LAYOUT.assetName, input.assetName),
    certificateNo: mergePoint(DEFAULT_LAYOUT.certificateNo, input.certificateNo),
    contribution: mergePoint(DEFAULT_LAYOUT.contribution, input.contribution),
    issuedAt: mergePoint(DEFAULT_LAYOUT.issuedAt, input.issuedAt),
    recipientName: mergePoint(DEFAULT_LAYOUT.recipientName, input.recipientName),
    reportNo: mergePoint(DEFAULT_LAYOUT.reportNo, input.reportNo),
    seal: mergePoint(DEFAULT_LAYOUT.seal, input.seal),
    severity: mergePoint(DEFAULT_LAYOUT.severity, input.severity),
    title: mergePoint(DEFAULT_LAYOUT.title, input.vulnerabilityTitle ?? input.title),
    verifyCode: mergePoint(DEFAULT_LAYOUT.verifyCode, input.verifyCode),
  }
}

function mergePoint(defaultPoint: LayoutPoint, value: unknown): LayoutPoint {
  if (!value || typeof value !== 'object') {
    return defaultPoint
  }

  const point = value as Record<string, unknown>
  return {
    ...defaultPoint,
    align: normalizeAlign(point.align) ?? defaultPoint.align,
    color: typeof point.color === 'string' ? point.color : defaultPoint.color,
    fontSize: normalizeNumber(point.fontSize) ?? defaultPoint.fontSize,
    height: normalizeNumber(point.height) ?? defaultPoint.height,
    lineHeight: normalizeNumber(point.lineHeight) ?? defaultPoint.lineHeight,
    maxWidth: normalizeNumber(point.maxWidth) ?? defaultPoint.maxWidth,
    width: normalizeNumber(point.width) ?? defaultPoint.width,
    x: normalizeNumber(point.x) ?? defaultPoint.x,
    y: normalizeNumber(point.y) ?? defaultPoint.y,
  }
}

function normalizeAlign(value: unknown) {
  if (value === 'center' || value === 'left' || value === 'right') {
    return value
  }
  return undefined
}

function normalizeNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function parseColor(value: string | undefined) {
  if (!value) {
    return rgb(0.12, 0.16, 0.14)
  }

  const normalized = value.replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return rgb(0.12, 0.16, 0.14)
  }

  const r = Number.parseInt(normalized.slice(0, 2), 16) / 255
  const g = Number.parseInt(normalized.slice(2, 4), 16) / 255
  const b = Number.parseInt(normalized.slice(4, 6), 16) / 255
  return rgb(r, g, b)
}

function formatDate(date: Date) {
  return `${date.getFullYear()} 年 ${String(date.getMonth() + 1).padStart(2, '0')} 月 ${String(date.getDate()).padStart(2, '0')} 日`
}

function canEncode(font: PDFFont, text: string) {
  try {
    font.widthOfTextAtSize(text, 12)
    return true
  } catch {
    return false
  }
}

function toPdfSafeText(value: string) {
  return value.replace(/[^\x20-\x7E]/g, '?')
}
