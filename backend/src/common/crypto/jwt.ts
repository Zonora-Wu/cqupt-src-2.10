import { createHmac, timingSafeEqual } from 'node:crypto'

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

export type JwtPayload = {
  sub: string
  role: string
  type: 'access' | 'refresh'
  exp: number
  [key: string]: JsonValue
}

function base64Url(input: Buffer | string) {
  return Buffer.from(input)
    .toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
}

function base64UrlToBuffer(input: string) {
  const normalized = input.replaceAll('-', '+').replaceAll('_', '/')
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=')
  return Buffer.from(padded, 'base64')
}

function parseDurationSeconds(value: string | undefined, fallbackSeconds: number) {
  if (!value) {
    return fallbackSeconds
  }

  const match = /^(\d+)([smhd])$/.exec(value.trim())
  if (!match) {
    return fallbackSeconds
  }

  const amount = Number(match[1])
  const unit = match[2]

  if (unit === 's') return amount
  if (unit === 'm') return amount * 60
  if (unit === 'h') return amount * 60 * 60
  return amount * 24 * 60 * 60
}

export function getJwtExpiry(value: string | undefined, fallbackSeconds: number) {
  return Math.floor(Date.now() / 1000) + parseDurationSeconds(value, fallbackSeconds)
}

export function signJwt(payload: JwtPayload, secret: string) {
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = base64Url(JSON.stringify(payload))
  const signature = base64Url(createHmac('sha256', secret).update(`${header}.${body}`).digest())

  return `${header}.${body}.${signature}`
}

export function verifyJwt(token: string, secret: string) {
  const [header, body, signature] = token.split('.')

  if (!header || !body || !signature) {
    return null
  }

  const expectedSignature = base64Url(createHmac('sha256', secret).update(`${header}.${body}`).digest())
  const actual = Buffer.from(signature)
  const expected = Buffer.from(expectedSignature)

  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return null
  }

  try {
    const payload = JSON.parse(base64UrlToBuffer(body).toString('utf8')) as JwtPayload
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return null
    }

    return payload
  } catch {
    return null
  }
}
