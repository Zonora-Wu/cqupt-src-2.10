import { BadRequestException } from '@nestjs/common'
import {
  IssueCertificateBody,
  NormalizedIssueCertificateInput,
  NormalizedRevokeCertificateInput,
  RevokeCertificateBody,
} from './certificate.types'

export function normalizeIssueCertificateBody(body: IssueCertificateBody): NormalizedIssueCertificateInput {
  return {
    contribution: requireText(body.contribution, '贡献说明', 6, 1000),
    publicVerify: normalizeBoolean(body.publicVerify, true),
    vulnerabilityId: requireText(body.vulnerabilityId, '关联漏洞', 8, 80),
  }
}

export function normalizeRevokeCertificateBody(body: RevokeCertificateBody): NormalizedRevokeCertificateInput {
  return {
    reason: requireText(body.reason, '撤销原因', 4, 1000),
  }
}

export function normalizePublicCertificateNo(value: unknown) {
  if (typeof value !== 'string') throw new BadRequestException('证书编号格式不正确')
  const certificateNo = value.trim().toUpperCase()
  if (!/^CQUPT-SRC-CERT-\d{4}-[A-Z0-9]{6}$/.test(certificateNo)) {
    throw new BadRequestException('证书编号格式应为 CQUPT-SRC-CERT-年份-6位编号')
  }
  return certificateNo
}

function requireText(value: unknown, label: string, minLength: number, maxLength: number) {
  if (typeof value !== 'string') {
    throw new BadRequestException(`${label}格式不正确`)
  }

  const text = value.trim()
  if (text.length < minLength) {
    throw new BadRequestException(`${label}至少需要 ${minLength} 个字符`)
  }

  if (text.length > maxLength) {
    throw new BadRequestException(`${label}不能超过 ${maxLength} 个字符`)
  }

  return text
}

function normalizeBoolean(value: unknown, defaultValue: boolean) {
  if (value === undefined || value === null || value === '') {
    return defaultValue
  }

  if (typeof value !== 'boolean') {
    throw new BadRequestException('公开核验状态格式不正确')
  }

  return value
}
