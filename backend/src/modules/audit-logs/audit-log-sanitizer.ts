const SENSITIVE_KEY_PATTERN =
  /(password|passwordHash|token|refreshToken|accessToken|secret|cookie|authorization|验证码|临时密码|密码|令牌)/i

const MAX_STRING_LENGTH = 1000

export function sanitizeAuditMetadata(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAuditMetadata(item))
  }

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, child]) => [
        key,
        SENSITIVE_KEY_PATTERN.test(key) ? '***已脱敏***' : sanitizeAuditMetadata(child),
      ]),
    )
  }

  if (typeof value === 'string' && value.length > MAX_STRING_LENGTH) {
    return `${value.slice(0, MAX_STRING_LENGTH)}...`
  }

  return value
}
