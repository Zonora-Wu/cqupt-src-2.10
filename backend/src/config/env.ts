type EnvConfig = Record<string, string>

const requiredKeys = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']

export function validateEnv(config: EnvConfig) {
  const missingKeys = requiredKeys.filter((key) => !config[key])

  if (missingKeys.length > 0) {
    throw new Error(`Missing required environment variables: ${missingKeys.join(', ')}`)
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
