import { createHash, createHmac } from 'node:crypto'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { URL } from 'node:url'
import { Injectable, InternalServerErrorException } from '@nestjs/common'

type PutObjectInput = {
  body: Buffer
  contentType: string
  key: string
}

type GetObjectResult = {
  body: Buffer
  contentType: string
}

@Injectable()
export class S3StorageService {
  private readonly accessKey = process.env.MINIO_ACCESS_KEY ?? 'minioadmin'
  private readonly bucket = process.env.MINIO_BUCKET ?? 'cqupt-src'
  private readonly endpoint = process.env.MINIO_ENDPOINT ?? 'localhost'
  private readonly port = Number(process.env.MINIO_PORT ?? 9000)
  private readonly protocol = process.env.MINIO_USE_SSL === 'true' ? 'https:' : 'http:'
  private readonly region = process.env.MINIO_REGION ?? 'us-east-1'
  private readonly secretKey = process.env.MINIO_SECRET_KEY ?? 'minioadmin'

  async ensureBucket() {
    const exists = await this.request({
      expectedStatuses: [200, 404],
      method: 'HEAD',
      path: `/${this.bucket}`,
    })

    if (exists.statusCode === 200) {
      return
    }

    const created = await this.request({
      expectedStatuses: [200],
      method: 'PUT',
      path: `/${this.bucket}`,
    })

    if (created.statusCode !== 200) {
      throw new InternalServerErrorException('对象存储 Bucket 初始化失败')
    }
  }

  async putObject(input: PutObjectInput) {
    await this.ensureBucket()
    await this.request({
      body: input.body,
      contentType: input.contentType,
      expectedStatuses: [200],
      method: 'PUT',
      path: `/${this.bucket}/${encodeObjectKey(input.key)}`,
    })
  }

  async getObject(key: string): Promise<GetObjectResult> {
    const result = await this.request({
      expectedStatuses: [200],
      method: 'GET',
      path: `/${this.bucket}/${encodeObjectKey(key)}`,
    })

    return {
      body: result.body,
      contentType: result.headers['content-type'] ?? 'application/pdf',
    }
  }

  private request(input: {
    body?: Buffer
    contentType?: string
    expectedStatuses: number[]
    method: 'GET' | 'HEAD' | 'PUT'
    path: string
  }) {
    const body = input.body ?? Buffer.alloc(0)
    const now = new Date()
    const amzDate = toAmzDate(now)
    const dateStamp = amzDate.slice(0, 8)
    const host = `${this.endpoint}:${this.port}`
    const payloadHash = sha256Hex(body)
    const headers: Record<string, string> = {
      host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
    }

    if (input.contentType) {
      headers['content-type'] = input.contentType
    }

    if (body.length > 0) {
      headers['content-length'] = String(body.length)
    }

    const signedHeaders = Object.keys(headers).sort().join(';')
    const canonicalHeaders = Object.keys(headers)
      .sort()
      .map((key) => `${key}:${headers[key]}\n`)
      .join('')
    const canonicalRequest = [
      input.method,
      input.path,
      '',
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n')
    const credentialScope = `${dateStamp}/${this.region}/s3/aws4_request`
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      sha256Hex(Buffer.from(canonicalRequest)),
    ].join('\n')
    const signingKey = getSignatureKey(this.secretKey, dateStamp, this.region, 's3')
    const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex')

    headers.authorization = [
      `AWS4-HMAC-SHA256 Credential=${this.accessKey}/${credentialScope}`,
      `SignedHeaders=${signedHeaders}`,
      `Signature=${signature}`,
    ].join(', ')

    const url = new URL(`${this.protocol}//${host}${input.path}`)
    const transport = this.protocol === 'https:' ? httpsRequest : httpRequest

    return new Promise<{ body: Buffer; headers: Record<string, string>; statusCode: number }>((resolve, reject) => {
      const req = transport(
        url,
        {
          headers,
          method: input.method,
        },
        (res) => {
          const chunks: Buffer[] = []
          res.on('data', (chunk: Buffer) => chunks.push(chunk))
          res.on('end', () => {
            const responseBody = Buffer.concat(chunks)
            const statusCode = res.statusCode ?? 0

            if (!input.expectedStatuses.includes(statusCode)) {
              reject(new InternalServerErrorException(`对象存储请求失败：${statusCode} ${responseBody.toString('utf8')}`))
              return
            }

            resolve({
              body: responseBody,
              headers: normalizeHeaders(res.headers),
              statusCode,
            })
          })
        },
      )

      req.on('error', () => reject(new InternalServerErrorException('对象存储服务不可用')))
      if (body.length > 0) {
        req.write(body)
      }
      req.end()
    })
  }
}

function encodeObjectKey(key: string) {
  return key.split('/').map((part) => encodeURIComponent(part)).join('/')
}

function getSignatureKey(secretKey: string, dateStamp: string, regionName: string, serviceName: string) {
  const kDate = hmac(Buffer.from(`AWS4${secretKey}`), dateStamp)
  const kRegion = hmac(kDate, regionName)
  const kService = hmac(kRegion, serviceName)
  return hmac(kService, 'aws4_request')
}

function hmac(key: Buffer, data: string) {
  return createHmac('sha256', key).update(data).digest()
}

function normalizeHeaders(headers: NodeJS.Dict<string | string[]>) {
  const normalized: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      normalized[key.toLowerCase()] = value.join(', ')
    } else if (value) {
      normalized[key.toLowerCase()] = value
    }
  }
  return normalized
}

function sha256Hex(body: Buffer) {
  return createHash('sha256').update(body).digest('hex')
}

function toAmzDate(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '')
}
