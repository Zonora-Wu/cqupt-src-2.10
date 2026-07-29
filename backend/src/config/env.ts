type EnvConfig = Record<string, string>

const requiredKeys = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'AI_CREDENTIAL_ENCRYPTION_KEY']
const PLACEHOLDER_PATTERN = /replace-with|change-me|example|^development(?:-|_).*secret$|^secret$/i

export function validateEnv(config: EnvConfig) {
  const missingKeys = requiredKeys.filter((key) => !config[key])

  if (missingKeys.length > 0) {
    throw new Error(`Missing required environment variables: ${missingKeys.join(', ')}`)
  }

  assertStrongSecret(config.JWT_ACCESS_SECRET, 'JWT_ACCESS_SECRET', 32)
  assertStrongSecret(config.JWT_REFRESH_SECRET, 'JWT_REFRESH_SECRET', 32)
  if (config.JWT_ACCESS_SECRET === config.JWT_REFRESH_SECRET) {
    throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different')
  }
  if (!isValidEncryptionKey(config.AI_CREDENTIAL_ENCRYPTION_KEY)) {
    throw new Error('AI_CREDENTIAL_ENCRYPTION_KEY must decode to exactly 32 bytes')
  }
  if (config.NODE_ENV === 'production' && !config.REDIS_URL) {
    throw new Error('REDIS_URL is required in production for shared rate limiting')
  }

  const port = Number(config.PORT ?? 3001)
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error('PORT must be a valid TCP port')
  }

  const chatQuota = Number(config.CHAT_DATABASE_QUOTA_BYTES ?? 5 * 1024 * 1024 * 1024)
  if (!Number.isSafeInteger(chatQuota) || chatQuota <= 0) {
    throw new Error('CHAT_DATABASE_QUOTA_BYTES must be a positive integer')
  }

  return {
    ...config,
    PORT: String(port),
    API_PREFIX: config.API_PREFIX ?? 'api',
    FRONTEND_ORIGIN: config.FRONTEND_ORIGIN ?? 'http://localhost:5173',
    CHAT_DATABASE_QUOTA_BYTES: String(chatQuota),
  }
}

function assertStrongSecret(value: string, name: string, minimumLength: number) {
  if (value.length < minimumLength || PLACEHOLDER_PATTERN.test(value)) {
    throw new Error(`${name} must be at least ${minimumLength} characters and not be a placeholder`)
  }
}

function isValidEncryptionKey(value: string) {
  if (PLACEHOLDER_PATTERN.test(value)) return false
  const key = /^[a-f\d]{64}$/i.test(value) ? Buffer.from(value, 'hex') : Buffer.from(value, 'base64')
  return key.length === 32
}
