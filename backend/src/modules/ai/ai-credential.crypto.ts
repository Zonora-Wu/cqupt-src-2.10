import { Injectable, ServiceUnavailableException } from '@nestjs/common'
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

@Injectable()
export class AiCredentialCrypto {
  encrypt(plaintext: string) {
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', this.getKey(), iv)
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    return {
      authTag: cipher.getAuthTag().toString('base64'),
      ciphertext: ciphertext.toString('base64'),
      iv: iv.toString('base64'),
    }
  }

  decrypt(value: { authTag: string; ciphertext: string; iv: string }) {
    const decipher = createDecipheriv('aes-256-gcm', this.getKey(), Buffer.from(value.iv, 'base64'))
    decipher.setAuthTag(Buffer.from(value.authTag, 'base64'))
    return Buffer.concat([
      decipher.update(Buffer.from(value.ciphertext, 'base64')),
      decipher.final(),
    ]).toString('utf8')
  }

  private getKey() {
    const raw = process.env.AI_CREDENTIAL_ENCRYPTION_KEY?.trim()
    if (!raw) throw new ServiceUnavailableException('未配置 AI_CREDENTIAL_ENCRYPTION_KEY')
    const key = /^[a-f\d]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64')
    if (key.length !== 32) {
      throw new ServiceUnavailableException('AI_CREDENTIAL_ENCRYPTION_KEY 必须为 32 字节')
    }
    return key
  }
}
