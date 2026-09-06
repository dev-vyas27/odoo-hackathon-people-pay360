/**
 * DocumentStoragePort — where a generated payslip is archived, and how it is
 * read back.
 *
 * Storage is deliberately OPTIONAL. `configured` is false when the bucket
 * environment variable is empty, which is the default and what a demo runs
 * with: the payslip still downloads, it simply is not archived anywhere. A
 * missing bucket must never be the reason an employee cannot get their payslip.
 *
 * `put` therefore reports failure in its RESULT rather than throwing. The
 * caller archives after the response has already been streamed, so there is
 * nobody left to show an error to — the only useful thing to do with a failure
 * is log it. A bucket that is set but MISCONFIGURED is different and does
 * throw; see the adapter.
 */
export interface StoredDocument {
  ok: boolean
  /** The object key it was (or would have been) written to. */
  key: string
  bytes: number
  /** Set when `ok` is false. */
  reason?: string
  /** True when storage is not configured and the upload was skipped, not failed. */
  skipped?: boolean
}

export interface DocumentStoragePort {
  /** False when the bucket env var is empty. Callers may skip work entirely. */
  readonly configured: boolean

  put(key: string, body: Uint8Array, contentType: string): Promise<StoredDocument>

  /**
   * A short-lived signed URL for reading an archived payslip back.
   *
   * There is no unsigned alternative on purpose. A payslip carries salary,
   * address and bank details, so the bucket is private — which means a plain
   * object URL either 403s (private, correct) or exposes everyone's pay to
   * anyone holding a link (public, indefensible). Signing on DEMAND rather than
   * at upload time is the other half of that: a URL minted when the object was
   * written would have expired long before anybody clicked it.
   *
   * Returns null when storage is not configured.
   */
  viewUrl(key: string): Promise<string | null>
}
