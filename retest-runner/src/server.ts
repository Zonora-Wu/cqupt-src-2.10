import { createHash, randomUUID } from 'node:crypto'
import { lookup as lookupCallback, LookupOneOptions } from 'node:dns'
import { lookup } from 'node:dns/promises'
import { createServer, IncomingMessage, ServerResponse } from 'node:http'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { isIP } from 'node:net'
import { URL, pathToFileURL } from 'node:url'

const CONTRACT_VERSION = 'ai-retest-runner-v1'
const DEFAULT_PORT = 5015
const MAX_JSON_BODY_BYTES = Number(process.env.RETEST_RUNNER_MAX_JSON_BODY_BYTES ?? 1024 * 1024)
const DEFAULT_MAX_REDIRECTS = 2
const DEFAULT_USER_AGENT = 'CQUPT-SRC-AI-Retest-Runner/1.0'

const allowedTemplates = new Set([
  'http_head',
  'http_get',
  'http_options',
  'http_post_limited',
  'playwright_visit',
  'playwright_screenshot',
  'header_check',
  'cors_check',
  'clickjacking_check',
  'content_diff',
  'dns_canary_check',
])
const allowedMethods = new Set(['GET', 'HEAD', 'OPTIONS', 'POST'])
const activeExecutions = new Map<string, AbortController>()

type RunnerRequest = {
  version?: unknown
  traceId?: unknown
  step?: unknown
  budget?: unknown
  safety?: unknown
}

type StepInput = {
  method: string
  sequence: number
  targetUrl: string
  template: string
  title: string
}

type Budget = {
  maxConcurrentRequests: number
  maxRequestsPerJob: number
  maxRequestsPerStep: number
  maxResponseBytes: number
  requestTimeoutMs: number
  totalTimeoutMs: number
}

type Safety = {
  allowCredentials: boolean
  allowDatabaseAccess: boolean
  allowHermesScripts: boolean
  allowInternalNetwork: boolean
  allowMetadataNetwork: boolean
  allowRedirectOffOrigin: boolean
  allowShell: boolean
  allowedOrigin: string
  redactSensitiveOutput: boolean
}

type NetworkDecision = {
  allowed: boolean
  address?: string
  host: string
  reason: string
  url: string
}

type HttpResult = {
  bodyPreviewSanitized: string
  bodySha256: string
  durationMs: number
  finalUrl: string
  headersSummary: Record<string, string>
  networkDecisionLog: NetworkDecision[]
  redactionSummary: Record<string, number>
  redirectChain: string[]
  requestCount: number
  statusCode: number | null
  truncated: boolean
}

export function createRetestRunnerServer() {
  return createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && req.url === '/health') {
        sendJson(res, 200, { contract: CONTRACT_VERSION, status: 'ok' })
        return
      }

      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED', message: 'method not allowed' })
        return
      }
      if (!isAuthorized(req)) {
        sendJson(res, 401, { error: 'UNAUTHORIZED', message: 'invalid runner token' })
        return
      }

      if (req.url === '/v1/retests/steps:execute') {
        const body = await readJsonBody(req)
        const result = await executeStep(body as RunnerRequest)
        sendJson(res, 200, result)
        return
      }

      if (req.url === '/v1/retests/steps:cancel') {
        const body = await readJsonBody(req)
        const executionId = readString(body, 'executionId')
        if (executionId) activeExecutions.get(executionId)?.abort()
        sendJson(res, 200, { cancelled: Boolean(executionId), executionId })
        return
      }

      sendJson(res, 404, { error: 'NOT_FOUND', message: 'endpoint not found' })
    } catch (error) {
      const runnerError = normalizeError(error)
      sendJson(res, runnerError.statusCode, { error: runnerError.code, message: runnerError.message })
    }
  })
}

async function executeStep(raw: RunnerRequest) {
  const startedAt = Date.now()
  const executionId = `rr_${Date.now().toString(36)}_${randomUUID()}`
  const abortController = new AbortController()
  activeExecutions.set(executionId, abortController)

  try {
    const input = normalizeInput(raw)
    const timeout = setTimeout(() => abortController.abort(), input.budget.totalTimeoutMs)
    try {
      const result = input.step.template === 'dns_canary_check'
        ? await executeDnsCheck(input.step, input.safety)
        : await executeHttpTemplate(input.step, input.budget, input.safety, abortController.signal)
      const summary = buildSummary(input.step, result)
      return {
        artifacts: [{
          artifactType: 'runner_evidence_summary',
          mimeType: 'application/json',
          redactionSummary: result.redactionSummary,
          sanitizedPreview: JSON.stringify(summary).slice(0, 4000),
          sha256: createHash('sha256').update(JSON.stringify(summary)).digest('hex'),
          sizeBytes: Buffer.byteLength(JSON.stringify(summary), 'utf8'),
        }],
        durationMs: Date.now() - startedAt,
        executionId,
        requestCount: result.requestCount,
        status: 'SUCCEEDED',
        summary,
      }
    } finally {
      clearTimeout(timeout)
    }
  } catch (error) {
    const runnerError = normalizeError(error)
    return {
      artifacts: [],
      durationMs: Date.now() - startedAt,
      errorCode: runnerError.code,
      errorMessage: runnerError.message,
      executionId,
      requestCount: 0,
      status: abortController.signal.aborted ? 'CANCELLED' : 'FAILED',
      summary: { error: runnerError.code, message: runnerError.message },
    }
  } finally {
    activeExecutions.delete(executionId)
  }
}

async function executeDnsCheck(step: StepInput, safety: Safety): Promise<HttpResult> {
  const target = new URL(step.targetUrl)
  const networkDecisionLog: NetworkDecision[] = []
  await validateUrlAllowed(target, safety, networkDecisionLog)
  return {
    bodyPreviewSanitized: '',
    bodySha256: createHash('sha256').update('').digest('hex'),
    durationMs: 0,
    finalUrl: target.toString(),
    headersSummary: {},
    networkDecisionLog,
    redactionSummary: {},
    redirectChain: [],
    requestCount: 0,
    statusCode: null,
    truncated: false,
  }
}

async function executeHttpTemplate(step: StepInput, budget: Budget, safety: Safety, signal: AbortSignal): Promise<HttpResult> {
  let current = new URL(step.targetUrl)
  const redirectChain: string[] = []
  const networkDecisionLog: NetworkDecision[] = []
  let requestCount = 0
  const startedAt = Date.now()

  for (let redirect = 0; redirect <= DEFAULT_MAX_REDIRECTS; redirect += 1) {
    if (requestCount >= budget.maxRequestsPerStep) throw runnerError('REQUEST_BUDGET_EXHAUSTED', 'request budget exhausted', 400)
    await validateUrlAllowed(current, safety, networkDecisionLog)
    requestCount += 1
    const response = await performHttpRequest(current, step, budget, signal)
    if (isRedirect(response.statusCode) && response.location) {
      const next = new URL(response.location, current)
      if (!safety.allowRedirectOffOrigin && next.origin !== safety.allowedOrigin) {
        throw runnerError('REDIRECT_OFF_ORIGIN_BLOCKED', 'redirect left allowed origin', 400)
      }
      redirectChain.push(next.toString())
      current = next
      continue
    }

    const redacted = redactSensitiveText(response.bodyPreview)
    return {
      bodyPreviewSanitized: redacted.text,
      bodySha256: response.bodySha256,
      durationMs: Date.now() - startedAt,
      finalUrl: current.toString(),
      headersSummary: summarizeHeaders(response.headers),
      networkDecisionLog,
      redactionSummary: redacted.summary,
      redirectChain,
      requestCount,
      statusCode: response.statusCode,
      truncated: response.truncated,
    }
  }

  throw runnerError('TOO_MANY_REDIRECTS', 'too many redirects', 400)
}

function performHttpRequest(url: URL, step: StepInput, budget: Budget, signal: AbortSignal) {
  return new Promise<{
    bodyPreview: string
    bodySha256: string
    headers: Record<string, string>
    location: string | null
    statusCode: number
    truncated: boolean
  }>((resolve, reject) => {
    const method = methodForTemplate(step)
    const body = method === 'POST' ? Buffer.from('{}', 'utf8') : undefined
    const transport = url.protocol === 'https:' ? httpsRequest : httpRequest
    let timeout: NodeJS.Timeout

    const req = transport(url, {
      headers: {
        Accept: '*/*',
        'Content-Type': method === 'POST' ? 'application/json' : undefined,
        'User-Agent': DEFAULT_USER_AGENT,
      },
      lookup: asyncLookup,
      method,
      signal,
    }, (res) => {
      const chunks: Buffer[] = []
      let totalBytes = 0
      let truncated = false
      const hash = createHash('sha256')

      res.on('data', (chunk: Buffer) => {
        hash.update(chunk)
        totalBytes += chunk.length
        if (totalBytes <= budget.maxResponseBytes) {
          chunks.push(chunk)
        } else {
          truncated = true
          const remaining = Math.max(0, budget.maxResponseBytes - (totalBytes - chunk.length))
          if (remaining > 0) chunks.push(chunk.subarray(0, remaining))
          res.destroy()
        }
      })
      res.on('end', () => {
        clearTimeout(timeout)
        const headers = normalizeHeaders(res.headers)
        resolve({
          bodyPreview: Buffer.concat(chunks).toString('utf8'),
          bodySha256: hash.digest('hex'),
          headers,
          location: headers.location ?? null,
          statusCode: res.statusCode ?? 0,
          truncated,
        })
      })
      res.on('error', (error) => {
        clearTimeout(timeout)
        if (truncated) {
          const headers = normalizeHeaders(res.headers)
          resolve({
            bodyPreview: Buffer.concat(chunks).toString('utf8'),
            bodySha256: hash.digest('hex'),
            headers,
            location: headers.location ?? null,
            statusCode: res.statusCode ?? 0,
            truncated,
          })
          return
        }
        reject(error)
      })
    })

    req.on('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })
    timeout = setTimeout(() => {
      req.destroy(runnerError('REQUEST_TIMEOUT', 'request timed out', 408))
    }, budget.requestTimeoutMs)
    if (body) req.write(body)
    req.end()
  })
}

async function validateUrlAllowed(url: URL, safety: Safety, decisions: NetworkDecision[]) {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    decisions.push({ allowed: false, host: url.hostname, reason: 'blocked protocol', url: url.toString() })
    throw runnerError('TARGET_PROTOCOL_BLOCKED', 'only http/https targets are allowed', 400)
  }
  if (url.origin !== safety.allowedOrigin) {
    decisions.push({ allowed: false, host: url.hostname, reason: 'outside allowed origin', url: url.toString() })
    throw runnerError('TARGET_OUTSIDE_ALLOWED_ORIGIN', 'target is outside allowed origin', 400)
  }
  const addresses = await resolveAddresses(url.hostname)
  if (addresses.length === 0) {
    decisions.push({ allowed: false, host: url.hostname, reason: 'dns resolution failed', url: url.toString() })
    throw runnerError('DNS_RESOLUTION_FAILED', 'target DNS resolution failed', 400)
  }
  for (const address of addresses) {
    if (isBlockedAddress(address, safety)) {
      decisions.push({ address, allowed: false, host: url.hostname, reason: 'blocked internal/reserved address', url: url.toString() })
      throw runnerError('NETWORK_DESTINATION_BLOCKED', 'target resolved to blocked network destination', 400)
    }
    decisions.push({ address, allowed: true, host: url.hostname, reason: 'allowed public destination', url: url.toString() })
  }
}

function normalizeInput(raw: RunnerRequest) {
  if (!raw || typeof raw !== 'object') throw runnerError('INVALID_REQUEST', 'request must be an object', 400)
  if (raw.version !== CONTRACT_VERSION) throw runnerError('CONTRACT_VERSION_MISMATCH', 'invalid runner contract version', 400)
  const step = normalizeStep(raw.step)
  const budget = normalizeBudget(raw.budget)
  const safety = normalizeSafety(raw.safety, step.targetUrl)
  if (!allowedTemplates.has(step.template)) throw runnerError('TEMPLATE_NOT_ALLOWED', 'template is not allowed', 400)
  if (!allowedMethods.has(step.method)) throw runnerError('METHOD_NOT_ALLOWED', 'method is not allowed', 400)
  if (step.method === 'POST' && step.template !== 'http_post_limited') throw runnerError('POST_TEMPLATE_MISMATCH', 'POST requires http_post_limited template', 400)
  if (step.template === 'http_post_limited' && step.method !== 'POST') throw runnerError('POST_TEMPLATE_MISMATCH', 'http_post_limited requires POST', 400)
  return { budget, safety, step, traceId: String(raw.traceId ?? '') }
}

function normalizeStep(value: unknown): StepInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw runnerError('INVALID_STEP', 'step must be an object', 400)
  const record = value as Record<string, unknown>
  const targetUrl = readRequiredString(record, 'targetUrl')
  const template = readRequiredString(record, 'template')
  return {
    method: readRequiredString(record, 'method').toUpperCase(),
    sequence: readInteger(record.sequence, 1, 1, 100),
    targetUrl,
    template,
    title: readString(record, 'title')?.slice(0, 160) ?? template,
  }
}

function normalizeBudget(value: unknown): Budget {
  const record = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  return {
    maxConcurrentRequests: 1,
    maxRequestsPerJob: readInteger(record.maxRequestsPerJob, 30, 1, 30),
    maxRequestsPerStep: readInteger(record.maxRequestsPerStep, 1, 1, 5),
    maxResponseBytes: readInteger(record.maxResponseBytes, 65536, 1024, 65536),
    requestTimeoutMs: readInteger(record.requestTimeoutMs, 5000, 500, 10000),
    totalTimeoutMs: readInteger(record.totalTimeoutMs, 300000, 1000, 300000),
  }
}

function normalizeSafety(value: unknown, targetUrl: string): Safety {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw runnerError('INVALID_SAFETY', 'safety policy is required', 400)
  const record = value as Record<string, unknown>
  const allowedOrigin = readRequiredString(record, 'allowedOrigin')
  const target = new URL(targetUrl)
  if (allowedOrigin !== target.origin) throw runnerError('ALLOWED_ORIGIN_MISMATCH', 'allowedOrigin must match target origin', 400)
  for (const key of ['allowCredentials', 'allowDatabaseAccess', 'allowHermesScripts', 'allowInternalNetwork', 'allowMetadataNetwork', 'allowShell'] as const) {
    if (record[key] !== false) throw runnerError('UNSAFE_CAPABILITY_REQUESTED', `${key} must be false`, 400)
  }
  return {
    allowCredentials: false,
    allowDatabaseAccess: false,
    allowHermesScripts: false,
    allowInternalNetwork: false,
    allowMetadataNetwork: false,
    allowRedirectOffOrigin: record.allowRedirectOffOrigin === true,
    allowShell: false,
    allowedOrigin,
    redactSensitiveOutput: record.redactSensitiveOutput !== false,
  }
}

function buildSummary(step: StepInput, result: HttpResult) {
  const securityHeaders = analyzeSecurityHeaders(result.headersSummary)
  return {
    bodyPreviewSanitized: result.bodyPreviewSanitized,
    bodySha256: result.bodySha256,
    clickjacking: step.template === 'clickjacking_check' ? analyzeClickjacking(result.headersSummary) : undefined,
    cors: step.template === 'cors_check' ? analyzeCors(result.headersSummary) : undefined,
    durationMs: result.durationMs,
    finalUrl: result.finalUrl,
    headersSummary: result.headersSummary,
    networkDecisionLog: result.networkDecisionLog,
    playwright: step.template.startsWith('playwright_') ? { browserExecuted: false, note: 'MVP runner uses safe HTTP visit fallback; browser screenshot capture is disabled unless a browser runtime is added later.' } : undefined,
    redactionSummary: result.redactionSummary,
    redirectChain: result.redirectChain,
    reproduced: inferReproduced(step.template, result.statusCode, securityHeaders),
    requestCount: result.requestCount,
    securityHeaders,
    statusCode: result.statusCode,
    template: step.template,
    truncated: result.truncated,
  }
}

function inferReproduced(template: string, statusCode: number | null, securityHeaders: ReturnType<typeof analyzeSecurityHeaders>) {
  if (statusCode === null) return true
  if (template === 'header_check') return securityHeaders.missing.length > 0
  if (template === 'clickjacking_check') return !securityHeaders.present.includes('x-frame-options') && !securityHeaders.present.includes('content-security-policy')
  return statusCode >= 200 && statusCode < 500
}

function analyzeSecurityHeaders(headers: Record<string, string>) {
  const required = ['content-security-policy', 'x-content-type-options', 'x-frame-options', 'referrer-policy']
  return {
    missing: required.filter((key) => !headers[key]),
    present: required.filter((key) => Boolean(headers[key])),
  }
}

function analyzeClickjacking(headers: Record<string, string>) {
  return {
    cspFrameAncestors: headers['content-security-policy']?.match(/frame-ancestors\s+[^;]+/i)?.[0] ?? null,
    xFrameOptions: headers['x-frame-options'] ?? null,
  }
}

function analyzeCors(headers: Record<string, string>) {
  return {
    allowCredentials: headers['access-control-allow-credentials'] ?? null,
    allowOrigin: headers['access-control-allow-origin'] ?? null,
    permissiveOrigin: headers['access-control-allow-origin'] === '*',
  }
}

function methodForTemplate(step: StepInput) {
  if (step.template === 'header_check') return 'HEAD'
  if (step.template === 'cors_check') return 'OPTIONS'
  return step.method
}

async function resolveAddresses(hostname: string) {
  const ipVersion = isIP(hostname)
  if (ipVersion) return [hostname]
  const normalized = hostname.toLowerCase().replace(/\.$/, '')
  if (normalized === 'localhost' || normalized.endsWith('.localhost')) return ['127.0.0.1']
  try {
    const records = await lookup(normalized, { all: true, verbatim: true })
    return records.map((record) => record.address)
  } catch {
    return []
  }
}

function isBlockedAddress(address: string, safety: Safety) {
  const version = isIP(address)
  if (version === 4) return isBlockedIpv4(address, safety)
  if (version === 6) return isBlockedIpv6(address, safety)
  return true
}

function isBlockedIpv4(address: string, safety: Safety) {
  const parts = address.split('.').map((part) => Number(part))
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true
  const [a, b] = parts
  const internal = a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224
  const metadata = a === 169 && b === 254
  return (internal && !safety.allowInternalNetwork) || (metadata && !safety.allowMetadataNetwork)
}

function isBlockedIpv6(address: string, safety: Safety) {
  const host = address.toLowerCase()
  const internal = host === '::1' || host === '::' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe8') || host.startsWith('fe9') || host.startsWith('fea') || host.startsWith('feb')
  return internal && !safety.allowInternalNetwork
}

function redactSensitiveText(text: string) {
  const summary: Record<string, number> = {}
  let output = text
  output = replaceAndCount(output, /authorization\s*:\s*bearer\s+[a-z0-9._~+\/-]+=*/gi, '[AUTHORIZATION_REDACTED]', summary, 'authorization')
  output = replaceAndCount(output, /cookie\s*:\s*[^\n\r]+/gi, '[COOKIE_REDACTED]', summary, 'cookie')
  output = replaceAndCount(output, /\b(?:access[_-]?token|refresh[_-]?token|token|session|secret|password)\b\s*[:=]\s*[^\s&;,]+/gi, '[TOKEN_REDACTED]', summary, 'token')
  output = replaceAndCount(output, /\b1[3-9]\d{9}\b/g, '[PHONE_REDACTED]', summary, 'phone')
  output = replaceAndCount(output, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[EMAIL_REDACTED]', summary, 'email')
  output = replaceAndCount(output, /\b(?:10|127)\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[INTERNAL_IP]', summary, 'internalIp')
  output = replaceAndCount(output, /\b172\.(?:1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}\b/g, '[INTERNAL_IP]', summary, 'internalIp')
  output = replaceAndCount(output, /\b192\.168\.\d{1,3}\.\d{1,3}\b/g, '[INTERNAL_IP]', summary, 'internalIp')
  output = replaceAndCount(output, /\b169\.254\.\d{1,3}\.\d{1,3}\b/g, '[INTERNAL_IP]', summary, 'internalIp')
  return { summary, text: output.slice(0, 4000) }
}

function replaceAndCount(input: string, pattern: RegExp, replacement: string, summary: Record<string, number>, key: string) {
  let count = 0
  const output = input.replace(pattern, () => {
    count += 1
    return replacement
  })
  if (count > 0) summary[key] = (summary[key] ?? 0) + count
  return output
}

function normalizeHeaders(headers: NodeJS.Dict<string | string[]>) {
  const normalized: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    if (Array.isArray(value)) normalized[key.toLowerCase()] = value.join(', ')
    else if (value) normalized[key.toLowerCase()] = value
  }
  return normalized
}

function summarizeHeaders(headers: Record<string, string>) {
  const safeAllowlist = new Set([
    'access-control-allow-credentials',
    'access-control-allow-origin',
    'cache-control',
    'content-security-policy',
    'content-type',
    'location',
    'referrer-policy',
    'server',
    'strict-transport-security',
    'x-content-type-options',
    'x-frame-options',
    'x-powered-by',
  ])
  const output: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    if (safeAllowlist.has(key)) output[key] = redactSensitiveText(value).text.slice(0, 500)
  }
  return output
}

function isRedirect(statusCode: number) {
  return statusCode >= 300 && statusCode < 400
}

function readJsonBody(req: IncomingMessage) {
  return new Promise<unknown>((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_JSON_BODY_BYTES) {
        reject(runnerError('REQUEST_TOO_LARGE', 'request body too large', 413))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'))
      } catch {
        reject(runnerError('INVALID_JSON', 'request body must be JSON', 400))
      }
    })
    req.on('error', reject)
  })
}

function isAuthorized(req: IncomingMessage) {
  const configured = process.env.RETEST_RUNNER_TOKEN?.trim()
  if (!configured && process.env.RETEST_RUNNER_ALLOW_INSECURE_LOCAL === 'true') return true
  if (!configured) return false
  return req.headers.authorization === `Bearer ${configured}`
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown) {
  const body = JSON.stringify(payload)
  res.writeHead(statusCode, {
    'Content-Length': Buffer.byteLength(body),
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
  })
  res.end(body)
}

function readRequiredString(record: Record<string, unknown>, key: string) {
  const value = readString(record, key)
  if (!value) throw runnerError('INVALID_REQUEST_FIELD', `${key} is required`, 400)
  return value
}

function readString(record: unknown, key: string) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return null
  const value = (record as Record<string, unknown>)[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function readInteger(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(min, Math.min(max, Math.floor(parsed)))
}

function asyncLookup(hostname: string, _options: unknown, callback: (err: NodeJS.ErrnoException | null, address: string, family: number) => void) {
  const options: LookupOneOptions = { all: false, verbatim: true }
  lookupCallback(hostname, options, callback)
}

function runnerError(code: string, message: string, statusCode: number) {
  return Object.assign(new Error(message), { code, statusCode })
}

function normalizeError(error: unknown) {
  if (error && typeof error === 'object' && 'code' in error && 'statusCode' in error && 'message' in error) {
    const record = error as { code: unknown; message: unknown; statusCode: unknown }
    return {
      code: typeof record.code === 'string' ? record.code : 'RUNNER_ERROR',
      message: typeof record.message === 'string' ? record.message : 'runner error',
      statusCode: typeof record.statusCode === 'number' ? record.statusCode : 500,
    }
  }
  if (error instanceof Error && error.name === 'AbortError') return { code: 'CANCELLED', message: 'execution cancelled', statusCode: 499 }
  return { code: 'RUNNER_ERROR', message: error instanceof Error ? error.message : 'runner error', statusCode: 500 }
}

if (isDirectExecution()) {
  const port = Number(process.env.RETEST_RUNNER_PORT ?? DEFAULT_PORT)
  createRetestRunnerServer().listen(port, () => {
    console.log(`CQUPT-SRC restricted retest runner listening on ${port}`)
  })
}

function isDirectExecution() {
  return Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href
}
