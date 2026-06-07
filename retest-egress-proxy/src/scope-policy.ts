import { isIP } from 'node:net'

export type EgressScope = {
  sessionId: string
  exactHosts: string[]
  domainSuffixes: string[]
  approvedIps: string[]
  allowedPorts: number[]
  allowAllPorts: boolean
  expiresAt: string
}

export function normalizeScope(value: unknown): EgressScope {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('scope must be an object')
  const input = value as Record<string, unknown>
  const expiresAt = requireString(input.expiresAt, 'expiresAt')
  if (!Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= Date.now()) throw new Error('expiresAt must be in the future')
  const allowedPorts = requireArray(input.allowedPorts, 'allowedPorts')
    .map(Number)
    .filter((port) => Number.isInteger(port) && port >= 1 && port <= 65535)
  const allowAllPorts = input.allowAllPorts === true
  if (!allowAllPorts && allowedPorts.length === 0) throw new Error('allowedPorts must not be empty')
  return {
    allowAllPorts,
    allowedPorts: [...new Set(allowedPorts)],
    approvedIps: normalizeStrings(input.approvedIps).filter((value) => isIP(value) !== 0),
    domainSuffixes: normalizeStrings(input.domainSuffixes).map(normalizeHostname),
    exactHosts: normalizeStrings(input.exactHosts).map(normalizeHostname),
    expiresAt: new Date(expiresAt).toISOString(),
    sessionId: requireString(input.sessionId, 'sessionId').slice(0, 200),
  }
}

export function isDestinationAllowed(scope: EgressScope | null, hostname: string, port: number, resolvedIps: string[]) {
  if (!scope || Date.parse(scope.expiresAt) <= Date.now()) return false
  if (!scope.allowAllPorts && !scope.allowedPorts.includes(port)) return false
  const host = normalizeHostname(hostname)
  const hostAllowed =
    scope.exactHosts.includes(host) ||
    scope.domainSuffixes.some((suffix) => host === suffix || host.endsWith(`.${suffix}`)) ||
    scope.approvedIps.includes(host)
  if (!hostAllowed || resolvedIps.length === 0) return false
  return resolvedIps.every((ip) => scope.approvedIps.includes(ip) || !isPrivateOrSpecialIp(ip))
}

export function isPrivateOrSpecialIp(value: string) {
  if (isIP(value) === 4) {
    const [a, b] = value.split('.').map(Number)
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    )
  }
  if (isIP(value) === 6) {
    const normalized = value.toLowerCase()
    return (
      normalized === '::' ||
      normalized === '::1' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe8') ||
      normalized.startsWith('fe9') ||
      normalized.startsWith('fea') ||
      normalized.startsWith('feb')
    )
  }
  return true
}

function normalizeStrings(value: unknown) {
  return requireArray(value, 'array')
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizeHostname(value: string) {
  return value.trim().toLowerCase().replace(/\.$/, '')
}

function requireArray(value: unknown, name: string) {
  if (!Array.isArray(value)) throw new Error(`${name} must be an array`)
  return value
}

function requireString(value: unknown, name: string) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} must be a string`)
  return value.trim()
}
