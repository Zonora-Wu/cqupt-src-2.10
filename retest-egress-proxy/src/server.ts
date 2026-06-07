import { lookup } from 'node:dns/promises'
import { readdir, rm } from 'node:fs/promises'
import http from 'node:http'
import net from 'node:net'
import { Duplex } from 'node:stream'
import { EgressScope, evaluateDestination, normalizeScope } from './scope-policy.js'

const proxyPort = Number(process.env.PROXY_PORT || 8080)
const controlPort = Number(process.env.CONTROL_PORT || 8081)
const hermesForwardPort = Number(process.env.HERMES_FORWARD_PORT || 5002)
const hermesForwardTarget = new URL(process.env.HERMES_FORWARD_TARGET || 'tcp://hermes-retest-agent:5000')
const hermesSessionDir = process.env.HERMES_SESSION_DIR || '/opt/hermes-retest-data/sessions'
const controlToken = requireToken('EGRESS_CONTROL_TOKEN')
const proxyToken = requireToken('EGRESS_PROXY_TOKEN')
const infrastructureHosts = new Set(
  (process.env.EGRESS_INFRASTRUCTURE_HOSTS || '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean),
)
let activeScope: EgressScope | null = null
let eventSequence = 0
const egressEvents: EgressEvent[] = []
const maxEvents = 2_000

const proxy = http.createServer(async (req, res) => {
  if (!isProxyAuthorized(req.headers['proxy-authorization'])) return rejectProxy(res, 407, 'Proxy authentication required')
  let target: URL
  try {
    target = new URL(req.url || '')
  } catch {
    return rejectProxy(res, 400, 'Absolute target URL required')
  }
  const port = Number(target.port || (target.protocol === 'https:' ? 443 : 80))
  const ips = await resolveHost(target.hostname)
  const decision = evaluateRequest(target.hostname, port, ips)
  recordEgressEvent({
    allowed: decision.allowed,
    hostname: target.hostname,
    kind: 'HTTP_REQUEST',
    method: req.method || 'GET',
    port,
    reason: decision.reason,
    resolvedIps: ips,
    target: sanitizeTarget(target),
  })
  if (!decision.allowed) return rejectProxy(res, 403, `Destination blocked: ${decision.reason}`)

  const upstream = http.request(target, {
    headers: withoutProxyHeaders(req.headers),
    method: req.method,
  }, (upstreamResponse) => {
    const location = upstreamResponse.headers.location
    if (location) {
      recordEgressEvent({
        allowed: true,
        hostname: target.hostname,
        kind: 'HTTP_REDIRECT',
        method: req.method || 'GET',
        port,
        reason: 'REDIRECT_OBSERVED',
        redirectTo: sanitizeRedirect(location, target),
        resolvedIps: ips,
        statusCode: upstreamResponse.statusCode || 0,
        target: sanitizeTarget(target),
      })
    }
    res.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers)
    upstreamResponse.pipe(res)
  })
  upstream.on('error', () => rejectProxy(res, 502, 'Upstream connection failed'))
  req.pipe(upstream)
})

proxy.on('connect', async (req, clientSocket, head) => {
  if (!isProxyAuthorized(req.headers['proxy-authorization'])) return rejectConnect(clientSocket, 407)
  const [hostname, rawPort] = (req.url || '').split(':')
  const port = Number(rawPort || 443)
  const ips = await resolveHost(hostname)
  const decision = evaluateRequest(hostname, port, ips)
  recordEgressEvent({
    allowed: decision.allowed,
    hostname,
    kind: 'CONNECT',
    method: 'CONNECT',
    port,
    reason: decision.reason,
    resolvedIps: ips,
    target: `${hostname}:${port}`,
  })
  if (!decision.allowed) return rejectConnect(clientSocket, 403)

  const upstream = net.connect(port, ips[0], () => {
    clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
    if (head.length > 0) upstream.write(head)
    upstream.pipe(clientSocket)
    clientSocket.pipe(upstream)
  })
  upstream.on('error', () => rejectConnect(clientSocket, 502))
})

const control = http.createServer(async (req, res) => {
  if (req.headers.authorization !== `Bearer ${controlToken}`) return json(res, 401, { error: 'unauthorized' })
  if (req.method === 'GET' && req.url === '/health') return json(res, 200, { activeSessionId: activeScope?.sessionId || null, ok: true })
  if (req.method === 'GET' && req.url?.startsWith('/v1/events')) {
    const requestUrl = new URL(req.url, 'http://egress-control.local')
    const sessionId = requestUrl.searchParams.get('sessionId')?.trim()
    if (!sessionId) return json(res, 400, { error: 'sessionId is required' })
    const events = drainEvents(sessionId)
    return json(res, 200, { events, sessionId })
  }
  if (req.method === 'DELETE' && req.url === '/v1/scope') {
    activeScope = null
    return json(res, 200, { ok: true })
  }
  if (req.method === 'DELETE' && req.url === '/v1/session') {
    try {
      const body = JSON.parse(await readBody(req)) as { sessionId?: unknown }
      const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : ''
      if (!/^cqupt-retest-[a-zA-Z0-9_-]{8,200}$/.test(sessionId)) throw new Error('invalid sessionId')
      const removed = await cleanupHermesSession(sessionId)
      return json(res, 200, { removed, sessionId })
    } catch (error) {
      return json(res, 400, { error: error instanceof Error ? error.message : 'invalid cleanup request' })
    }
  }
  if (req.method === 'PUT' && req.url === '/v1/scope') {
    try {
      activeScope = normalizeScope(JSON.parse(await readBody(req)))
      return json(res, 200, { expiresAt: activeScope.expiresAt, sessionId: activeScope.sessionId })
    } catch (error) {
      return json(res, 400, { error: error instanceof Error ? error.message : 'invalid scope' })
    }
  }
  return json(res, 404, { error: 'not_found' })
})

const hermesForward = net.createServer((client) => {
  const upstream = net.connect(Number(hermesForwardTarget.port || 5000), hermesForwardTarget.hostname)
  upstream.on('connect', () => {
    client.pipe(upstream)
    upstream.pipe(client)
  })
  upstream.on('error', () => client.destroy())
  client.on('error', () => upstream.destroy())
})

proxy.listen(proxyPort, '0.0.0.0')
control.listen(controlPort, '0.0.0.0')
hermesForward.listen(hermesForwardPort, '0.0.0.0')

function isProxyAuthorized(value: string | undefined) {
  if (!value?.startsWith('Basic ')) return false
  try {
    const decoded = Buffer.from(value.slice(6), 'base64').toString('utf8')
    return decoded === `cqupt:${proxyToken}`
  } catch {
    return false
  }
}

function evaluateRequest(hostname: string, port: number, ips: string[]) {
  const host = hostname.trim().toLowerCase().replace(/\.$/, '')
  if (infrastructureHosts.has(host) && port === 443) {
    return evaluateDestination({
      allowAllPorts: false,
      allowedPorts: [443],
      approvedIps: [],
      domainSuffixes: [],
      exactHosts: [host],
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      sessionId: 'infrastructure',
    }, host, port, ips)
  }
  return evaluateDestination(activeScope, host, port, ips)
}

async function resolveHost(hostname: string) {
  try {
    return (await lookup(hostname, { all: true, verbatim: true })).map((entry) => entry.address)
  } catch {
    return []
  }
}

function withoutProxyHeaders(headers: http.IncomingHttpHeaders) {
  const copy = { ...headers }
  delete copy['proxy-authorization']
  delete copy['proxy-connection']
  delete copy.host
  return copy
}

function rejectProxy(res: http.ServerResponse, status: number, message: string) {
  if (!res.headersSent) res.writeHead(status, { 'Content-Type': 'text/plain' })
  res.end(message)
}

function rejectConnect(socket: Duplex, status: number) {
  if (!socket.destroyed) socket.end(`HTTP/1.1 ${status} Blocked\r\nConnection: close\r\n\r\n`)
}

function json(res: http.ServerResponse, status: number, body: Record<string, unknown>) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

async function readBody(req: http.IncomingMessage) {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk)
    size += buffer.length
    if (size > 64 * 1024) throw new Error('request body too large')
    chunks.push(buffer)
  }
  return Buffer.concat(chunks).toString('utf8')
}

function requireToken(name: string) {
  const value = process.env[name]?.trim()
  if (!value || value.length < 16) throw new Error(`${name} must be at least 16 characters`)
  return value
}

async function cleanupHermesSession(sessionId: string) {
  const files = await readdir(hermesSessionDir)
  const exact = `session_${sessionId}.json`
  const dumpPrefix = `request_dump_${sessionId}_`
  const matches = files.filter((file) => file === exact || (file.startsWith(dumpPrefix) && file.endsWith('.json')))
  await Promise.all(matches.map((file) => rm(`${hermesSessionDir}/${file}`, { force: true })))
  return matches.length
}

type EgressEvent = {
  id: number
  sessionId: string | null
  occurredAt: string
  kind: 'HTTP_REQUEST' | 'HTTP_REDIRECT' | 'CONNECT'
  method: string
  target: string
  hostname: string
  port: number
  resolvedIps: string[]
  allowed: boolean
  reason: string
  statusCode?: number
  redirectTo?: string
}

function recordEgressEvent(event: Omit<EgressEvent, 'id' | 'occurredAt' | 'sessionId'>) {
  egressEvents.push({
    ...event,
    id: ++eventSequence,
    occurredAt: new Date().toISOString(),
    sessionId: activeScope?.sessionId || null,
  })
  if (egressEvents.length > maxEvents) egressEvents.splice(0, egressEvents.length - maxEvents)
}

function drainEvents(sessionId: string) {
  const matches = egressEvents.filter((event) => event.sessionId === sessionId)
  if (matches.length === 0) return []
  const ids = new Set(matches.map((event) => event.id))
  for (let index = egressEvents.length - 1; index >= 0; index -= 1) {
    if (ids.has(egressEvents[index].id)) egressEvents.splice(index, 1)
  }
  return matches
}

function sanitizeTarget(target: URL) {
  return `${target.protocol}//${target.host}${target.pathname}`
}

function sanitizeRedirect(location: string, base: URL) {
  try {
    return sanitizeTarget(new URL(location, base))
  } catch {
    return '[invalid redirect]'
  }
}
