/**
 * DocumentStoragePort — where a generated payslip is archived.
 *
 * Storage is deliberately OPTIONAL. `configured` is false when the bucket
 * environment variables are empty, which is the default and what a demo runs
 * with: the payslip still downloads, it simply is not archived anywhere. A
 * missing bucket must never be the reason an employee cannot get their payslip.
 *
 * `put` therefore reports failure in its RESULT rather than throwing. The
 * caller archives after the response has already been streamed, so there is
 * nobody left to show an error to — the only useful thing to do with a failure
 * is log it.
 */
export interface StoredDocument {
  ok: boolean
  /** The object key it was (or would have been) written to. */
  key: string
  /** Public/virtual-hosted URL when one can be derived; null otherwise. */
  url: string | null
  bytes: number
  /** Set when `ok` is false. */
  reason?: string
  /** True when storage is not configured and the upload was skipped, not failed. */
  skipped?: boolean
}

export interface DocumentStoragePort {
  /** False when the bucket env vars are empty. Callers may skip work entirely. */
  readonly configured: boolean
  put(key: string, body: Uint8Array, contentType: string): Promise<StoredDocument>
}
