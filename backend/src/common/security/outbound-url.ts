import { BadRequestException } from '@nestjs/common'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const BLOCKED_IPV4_RANGES: Array<[number, number]> = [
  [ipv4ToNumber('0.0.0.0'), ipv4ToNumber('0.255.255.255')],
  [ipv4ToNumber('10.0.0.0'), ipv4ToNumber('10.255.255.255')],
  [ipv4ToNumber('100.64.0.0'), ipv4ToNumber('100.127.255.255')],
  [ipv4ToNumber('127.0.0.0'), ipv4ToNumber('127.255.255.255')],
  [ipv4ToNumber('169.254.0.0'), ipv4ToNumber('169.254.255.255')],
  [ipv4ToNumber('172.16.0.0'), ipv4ToNumber('172.31.255.255')],
  [ipv4ToNumber('192.0.0.0'), ipv4ToNumber('192.0.0.255')],
  [ipv4ToNumber('192.0.2.0'), ipv4ToNumber('192.0.2.255')],
  [ipv4ToNumber('192.168.0.0'), ipv4ToNumber('192.168.255.255')],
  [ipv4ToNumber('198.18.0.0'), ipv4ToNumber('198.19.255.255')],
  [ipv4ToNumber('198.51.100.0'), ipv4ToNumber('198.51.100.255')],
  [ipv4ToNumber('203.0.113.0'), ipv4ToNumber('203.0.113.255')],
  [ipv4ToNumber('224.0.0.0'), ipv4ToNumber('255.255.255.255')],
]

export async function validatePublicHttpsUrl(value: string) {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw invalidUrl()
  }

  if (
    url.protocol !== 'https:'
    || (url.port && url.port !== '443')
    || url.username
    || url.password
    || isBlockedHostname(url.hostname)
  ) {
    throw invalidUrl()
  }

  await assertHostnameResolvesPublic(url.hostname)
  return url.href.endsWith('/') ? url.href : `${url.href}/`
}

export async function assertPublicOutboundUrl(value: string | URL) {
  const url = value instanceof URL ? value : new URL(value)
  if (url.protocol !== 'https:' || (url.port && url.port !== '443')) throw invalidUrl()
  await assertHostnameResolvesPublic(url.hostname)
  return url
}

async function assertHostnameResolvesPublic(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (isBlockedHostname(normalized)) throw invalidUrl()

  if (isIP(normalized)) {
    if (isBlockedIp(normalized)) throw invalidUrl()
    return
  }

  let addresses: Array<{ address: string }>
  try {
    addresses = await lookup(normalized, { all: true, verbatim: true })
  } catch {
    throw new BadRequestException('模型服务地址无法解析')
  }

  if (!addresses.length || addresses.some(({ address }) => isBlockedIp(address))) {
    throw invalidUrl()
  }
}

function isBlockedHostname(hostname: string) {
  const value = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  return value === 'localhost'
    || value.endsWith('.localhost')
    || value.endsWith('.local')
    || value.endsWith('.internal')
    || value.endsWith('.home.arpa')
}

function isBlockedIp(address: string): boolean {
  const family = isIP(address)
  if (family === 4) {
    const value = ipv4ToNumber(address)
    return BLOCKED_IPV4_RANGES.some(([start, end]) => value >= start && value <= end)
  }
  if (family !== 6) return true

  const value = address.toLowerCase()
  if (value === '::' || value === '::1') return true
  if (value.startsWith('fc') || value.startsWith('fd') || /^fe[89ab]/.test(value)) return true
  if (value.startsWith('ff')) return true
  if (value.startsWith('2001:db8:')) return true
  if (value.startsWith('::ffff:')) {
    const mapped = value.slice('::ffff:'.length)
    return isIP(mapped) !== 4 || isBlockedIp(mapped)
  }
  return false
}

function ipv4ToNumber(address: string) {
  return address.split('.').reduce((value, part) => (value * 256) + Number(part), 0) >>> 0
}

function invalidUrl() {
  return new BadRequestException('中转站 Base URL 必须是公开 HTTPS 地址，且仅允许 443 端口')
}
