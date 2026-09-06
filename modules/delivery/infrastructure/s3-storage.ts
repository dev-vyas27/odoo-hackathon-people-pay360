

import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type {
  DocumentStoragePort,
  StoredDocument,
} from '../application/ports/document-storage.port'

const VIEW_URL_TTL_SECONDS = 300

interface S3Settings {
  bucket: string
  region: string
  accessKeyId: string
  secretAccessKey: string
}

const read = (name: string) => (process.env[name] ?? '').trim()

function readSettings(): S3Settings {
  const bucket = read('AWS_S3_BUCKET')
  const region = read('AWS_REGION')
  const accessKeyId = read('AWS_ACCESS_KEY_ID')
  const secretAccessKey = read('AWS_SECRET_ACCESS_KEY')

  if (bucket && !region) {
    throw new Error(
      'S3 is half-configured — AWS_S3_BUCKET is set but AWS_REGION is not. ' +
        'Set AWS_REGION, or clear AWS_S3_BUCKET to turn payslip archiving off.',
    )
  }

  if (bucket && Boolean(accessKeyId) !== Boolean(secretAccessKey)) {
    throw new Error(
      'S3 is half-configured — set BOTH AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY, ' +
        'or neither (to use the instance role / ~/.aws/credentials).',
    )
  }

  return { bucket, region, accessKeyId, secretAccessKey }
}

export function isPayslipKey(key: unknown): key is string {
  return typeof key === 'string' && /^payslips\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.pdf$/i.test(key)
}

export class S3DocumentStorage implements DocumentStoragePort {
  private readonly settings = readSettings()
  private client: S3Client | null = null

  

  get configured(): boolean {
    return this.settings.bucket !== ''
  }

  
  private connect(): S3Client {
    if (this.client) return this.client

    const { region, accessKeyId, secretAccessKey } = this.settings
    this.client = new S3Client({
      region,
      
      
      ...(accessKeyId && secretAccessKey
        ? { credentials: { accessKeyId, secretAccessKey } }
        : {}),
    })
    return this.client
  }

  async put(key: string, body: Uint8Array, contentType: string): Promise<StoredDocument> {
    if (!this.configured) {
      return {
        ok: false,
        skipped: true,
        key,
        bytes: body.byteLength,
        reason: 'AWS_S3_BUCKET is empty — archiving is turned off.',
      }
    }

    if (!isPayslipKey(key)) {
      return { ok: false, key, bytes: body.byteLength, reason: `Refusing to write key "${key}"` }
    }

    try {
      await this.connect().send(
        new PutObjectCommand({
          Bucket: this.settings.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          
          
          CacheControl: 'private, max-age=31536000, immutable',
        }),
      )

      return { ok: true, key, bytes: body.byteLength }
    } catch (reason) {
      return {
        ok: false,
        key,
        bytes: body.byteLength,
        reason: reason instanceof Error ? reason.message : 'Unknown S3 error',
      }
    }
  }

  
  async viewUrl(key: string): Promise<string | null> {
    if (!this.configured) return null
    if (!isPayslipKey(key)) return null

    return getSignedUrl(
      this.connect(),
      new GetObjectCommand({ Bucket: this.settings.bucket, Key: key }),
      { expiresIn: VIEW_URL_TTL_SECONDS },
    )
  }
}
