type EnvConfig = Record<string, string>

const requiredKeys = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']

export function validateEnv(config: EnvConfig) {
  const missingKeys = requiredKeys.filter((key) => !config[key])

  if (missingKeys.length > 0) {
    throw new Error(`Missing required environment variables: ${missingKeys.join(', ')}`)
  }

  const port = Number(config.PORT ?? 3000)
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error('PORT must be a valid TCP port')
  }

  return {
    ...config,
    PORT: String(port),
    API_PREFIX: config.API_PREFIX ?? 'api',
    FRONTEND_ORIGIN: config.FRONTEND_ORIGIN ?? 'http://localhost:5173',
  }
}
