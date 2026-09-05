/**
 * The ONLY file that imports the AWS SDK.
 *
 * Configured entirely from the environment, and DISABLED by default: with
 * `S3_BUCKET` empty every call short-circuits to `skipped`, nothing is uploaded
 * and no credentials are needed. That is the same shape as the SMTP settings —
 * a demo runs with the boilerplate untouched, and a real deployment fills four
 * variables in without a code change.
 *
 * `S3_ENDPOINT` is here so the same adapter drives Cloudflare R2, MinIO,
 * Backblaze B2 or any other S3-compatible store; leave it empty for AWS.
 *
 * Nothing here throws. An archive failure is reported in the result and logged
 * by the caller, because by the time this runs the payslip has already been
 * delivered to the browser and there is nobody left to show an error to.
 */
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import type {
  DocumentStoragePort,
  StoredDocument,
} from '../application/ports/document-storage.port'

interface S3Settings {
  bucket: string
  region: string
  accessKeyId: string
  secretAccessKey: string
  /** Custom endpoint for S3-compatible providers. Empty for AWS. */
  endpoint: string
  /** Overrides the derived object URL, e.g. a CDN in front of the bucket. */
  publicBaseUrl: string
  /** MinIO and most non-AWS providers need path-style addressing. */
  forcePathStyle: boolean
}

function readSettings(): S3Settings {
  const env = process.env
  return {
    bucket: (env.S3_BUCKET ?? '').trim(),
    region: (env.S3_REGION ?? '').trim() || 'us-east-1',
    accessKeyId: (env.S3_ACCESS_KEY_ID ?? '').trim(),
    secretAccessKey: (env.S3_SECRET_ACCESS_KEY ?? '').trim(),
    endpoint: (env.S3_ENDPOINT ?? '').trim(),
    publicBaseUrl: (env.S3_PUBLIC_BASE_URL ?? '').trim().replace(/\/+$/, ''),
    forcePathStyle: (env.S3_FORCE_PATH_STYLE ?? '').trim() === 'true',
  }
}

/**
 * The object's URL.
 *
 * Derived rather than returned by the SDK, and deliberately NOT presigned: a
 * bucket that is private (which it should be) simply yields a URL that requires
 * credentials to open. Wire a CDN or a presigner in later behind
 * `S3_PUBLIC_BASE_URL` if public links are ever wanted.
 */
function objectUrl(settings: S3Settings, key: string): string | null {
  if (settings.publicBaseUrl) return `${settings.publicBaseUrl}/${key}`
  if (settings.endpoint) {
    const base = settings.endpoint.replace(/\/+$/, '')
    return settings.forcePathStyle ? `${base}/${settings.bucket}/${key}` : `${base}/${key}`
  }
  return `https://${settings.bucket}.s3.${settings.region}.amazonaws.com/${key}`
}

export class S3DocumentStorage implements DocumentStoragePort {
  private readonly settings = readSettings()
  private client: S3Client | null = null

  /**
   * A bucket name is the switch. Credentials are intentionally NOT part of this
   * check — on ECS, EKS and Lambda they arrive from the instance role rather
   * than the environment, and demanding env keys there would disable storage on
   * exactly the deployments that have it configured properly.
   */
  get configured(): boolean {
    return this.settings.bucket !== ''
  }

  /** Built lazily and reused: an S3Client holds a connection pool. */
  private connect(): S3Client {
    if (this.client) return this.client

    const { region, endpoint, accessKeyId, secretAccessKey, forcePathStyle } = this.settings

    this.client = new S3Client({
      region,
      ...(endpoint ? { endpoint, forcePathStyle: true } : { forcePathStyle }),
      // Omitted entirely when unset, so the SDK's own credential chain (instance
      // role, SSO profile, ~/.aws/credentials) still applies.
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
        url: null,
        bytes: body.byteLength,
        reason: 'S3_BUCKET is empty — archiving is turned off.',
      }
    }

    try {
      await this.connect().send(
        new PutObjectCommand({
          Bucket: this.settings.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          // A payslip is a fixed historical document; caching it hard is safe
          // and the same key is overwritten on regeneration.
          CacheControl: 'private, max-age=31536000, immutable',
        }),
      )

      return {
        ok: true,
        key,
        url: objectUrl(this.settings, key),
        bytes: body.byteLength,
      }
    } catch (reason) {
      return {
        ok: false,
        key,
        url: null,
        bytes: body.byteLength,
        reason: reason instanceof Error ? reason.message : 'Unknown S3 error',
      }
    }
  }
}
