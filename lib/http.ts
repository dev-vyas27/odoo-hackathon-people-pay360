/**
 * The HTTP edge: the ONLY place that knows both Result and Response.
 *
 * Route handlers stay ~5 lines and every error shape is identical across the
 * API, which means the frontend has exactly one error contract to handle.
 */
import type { DomainError, ErrorKind, Result } from '@/modules/shared'

const STATUS_BY_KIND: Record<ErrorKind, number> = {
  validation: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  rule_violation: 422,
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: Record<string, unknown> }
}

export function errorResponse(error: DomainError): Response {
  const body: ApiErrorBody = {
    error: { code: error.code, message: error.message, details: error.details },
  }
  return Response.json(body, { status: STATUS_BY_KIND[error.kind] ?? 500 })
}

/** Map a use-case Result onto an HTTP response. */
export function respond<T>(result: Result<T>, successStatus = 200): Response {
  if (!result.ok) return errorResponse(result.error)
  if (successStatus === 204) return new Response(null, { status: 204 })
  return Response.json({ data: result.value }, { status: successStatus })
}

/**
 * Wrap a handler so an unexpected throw becomes a clean 500 instead of an
 * HTML error page the frontend cannot parse.
 */
export function handle(fn: () => Promise<Response>): Promise<Response> {
  return fn().catch((reason) => {
    console.error('[api] unhandled error:', reason)
    const message = reason instanceof Error ? reason.message : 'Unexpected error'
    return Response.json({ error: { code: 'INTERNAL', message } }, { status: 500 })
  })
}

/** Next 16: searchParams arrive async and values are strings. */
export function parseQuery(url: string): Record<string, string> {
  return Object.fromEntries(new URL(url).searchParams.entries())
}
