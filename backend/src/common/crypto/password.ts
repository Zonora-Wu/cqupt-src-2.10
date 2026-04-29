import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const KEY_LENGTH = 64

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const derivedKey = scryptSync(password, salt, KEY_LENGTH).toString('hex')

  return `scrypt:${salt}:${derivedKey}`
}

export function verifyPassword(password: string, passwordHash: string) {
  const [algorithm, salt, expectedKey] = passwordHash.split(':')
  if (algorithm !== 'scrypt' || !salt || !expectedKey) {
    return false
  }

  const actual = Buffer.from(scryptSync(password, salt, KEY_LENGTH).toString('hex'), 'hex')
  const expected = Buffer.from(expectedKey, 'hex')

  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
