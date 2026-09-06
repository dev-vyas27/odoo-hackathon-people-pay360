/**
 * The one fetch wrapper. Every client-side request in the app goes through it.
 *
 * Two jobs: unwrap the `{ data }` / `{ error }` envelope that `lib/http.ts`
 * always produces, and turn a failure into a typed `ApiError` carrying the
 * server's own code and message. Without this, error handling is 40 copies of
 * `if (!res.ok) throw new Error('failed')` and the user sees "failed".
 */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    /** Field-level messages from zod, keyed by field name. */
    readonly details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

interface Envelope<T> {
  data?: T
  error?: { code: string; message: string; details?: Record<string, unknown> }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
    // Session lives in an httpOnly cookie; without this, mutations are anonymous.
    credentials: 'same-origin',
  })

  if (response.status === 204) return undefined as T

  const body = (await response.json().catch(() => ({}))) as Envelope<T>

  if (!response.ok) {
    const error = body.error
    throw new ApiError(
      response.status,
      error?.code ?? 'UNKNOWN',
      error?.message ?? response.statusText,
      error?.details,
    )
  }

  return body.data as T
}

/** Build `?a=1&b=2`, dropping empty values so a cleared filter disappears. */
export function toQueryString(params: Record<string, unknown> = {}): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    search.set(key, String(value))
  }
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}
