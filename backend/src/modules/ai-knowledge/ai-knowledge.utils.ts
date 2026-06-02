import { createHash } from 'crypto'

export function stableHash(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}
