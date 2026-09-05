/**
 * The ONLY file that imports the AWS SDK.
 *
 * Set up the same way as the reference implementation in
 * odoo-hackathon-transit-ops: a PRIVATE bucket, and short-lived presigned URLs
 * as the entire read surface. The AWS secret lives here, server-side, and is
 * never sent to the browser.
 *
 * Two deliberate differences from that reference, because the use case differs:
 *
 *  - It presigns an UPLOAD url so a browser can PUT a user's file straight to
 *    S3, bypassing Vercel's 4.5 MB body cap. We have no such upload — the
 *    server generates the payslip itself — so uploads go through `put()` here
 *    and there is nothing for a browser to send.
 *  - It throws when any variable is missing. We keep archiving OPT-IN: an empty
 *    `AWS_S3_BUCKET` disables it and the payslip still downloads, so a demo
 *    needs no AWS account. A bucket that is set but half-configured is a
 *    different thing entirely and throws exactly as the reference does — a
 *    typo'd secret should not look identical to "archiving is off".
 */
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type {
  DocumentStoragePort,
  StoredDocument,
} from '../application/ports/document-storage.port'

/** How long a view link stays valid. Minutes, not hours — it is payroll data. */
const VIEW_URL_TTL_SECONDS = 300

interface S3Settings {
  bucket: string
  region: string
  accessKeyId: string
  secretAccessKey: string
}

const read = (name: string) => (process.env[name] ?? '').trim()

/**
 * Validated config, or a loud error — never a cryptic failure from an undefined
 * bucket.
 *
 * Credentials are NOT required: on ECS, EKS and Lambda they arrive from the
 * instance role rather than the environment, and demanding env keys there would
 * disable storage on exactly the deployments that have it set up properly. But
 * supplying ONE of the pair is always a mistake, so that is rejected.
 */
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

/**
 * Guard a key before it reaches S3.
 *
 * The reference calls this `isValidDocumentKey`, and it exists for the same
 * reason: without it a caller could hand in `../` or another prefix and be
 * given a signed URL for an object that is none of their business. Matches
 * `storageKeyFor` in the domain — payslips/<payrun uuid>/<payslip uuid>.pdf.
 */
export function isPayslipKey(key: unknown): key is string {
  return typeof key === 'string' && /^payslips\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.pdf$/i.test(key)
}

export class S3DocumentStorage implements DocumentStoragePort {
  private readonly settings = readSettings()
  private client: S3Client | null = null

  /**
   * The bucket name is the switch. Everything else is validated in
   * `readSettings`, so `configured` being true means genuinely usable rather
   * than merely partially filled in.
   */
  get configured(): boolean {
    return this.settings.bucket !== ''
  }

  /** Built lazily and reused: an S3Client holds a connection pool. */
  private connect(): S3Client {
    if (this.client) return this.client

    const { region, accessKeyId, secretAccessKey } = this.settings
    this.client = new S3Client({
      region,
      // Omitted entirely when unset, so the SDK's own credential chain
      // (instance role, SSO profile, ~/.aws/credentials) still applies.
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
          // A payslip is a fixed historical document; caching it hard is safe
          // and the same key is overwritten on regeneration.
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

  /** Signed, expiring, and minted per request. See the port for why. */
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
