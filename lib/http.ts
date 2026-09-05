/**
 * The HTTP edge: the ONLY place that knows both Result and Response.
 *
 * Route handlers stay ~5 lines and every error shape is identical across the
 * API, which means the frontend has exactly one error contract to handle.
 */
import { DomainError, type ErrorKind, type PageQuery, type Result } from '@/modules/shared'

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
 *
 * A thrown DomainError is not unexpected — aggregates throw them to enforce
 * invariants — so it is translated with the same status table as a returned
 * one. Without this, `payrun.markPaid()` on a draft would surface as a 500.
 */
export function handle(fn: () => Promise<Response>): Promise<Response> {
  return fn().catch((reason) => {
    if (reason instanceof DomainError) return errorResponse(reason)

    if (reason instanceof Error && reason.message === 'UNAUTHENTICATED') {
      return Response.json(
        { error: { code: 'UNAUTHENTICATED', message: 'Sign in to continue' } },
        { status: 401 },
      )
    }

    console.error('[api] unhandled error:', reason)
    const message = reason instanceof Error ? reason.message : 'Unexpected error'
    return Response.json({ error: { code: 'INTERNAL', message } }, { status: 500 })
  })
}

/** Next 16: searchParams arrive async and values are strings. */
export function parseQuery(url: string): Record<string, string> {
  return Object.fromEntries(new URL(url).searchParams.entries())
}

/** Reserved names that mean "paging", not "filter by a column of this name". */
const PAGING_KEYS = new Set(['page', 'limit', 'sort', 'order', 'search'])

/**
 * Turn a request URL into the `PageQuery` every list use case expects.
 *
 * Anything that is not a paging key becomes a filter, so `?status=approved`
 * lands in `filters.status` and `BaseSqlRepository.buildWhere` turns it into a
 * parameterised condition with no per-module plumbing. Empty values are dropped rather than filtering
 * everything away — a cleared <select> submits `''`.
 */
export function parsePageQuery(url: string): PageQuery {
  const params = new URL(url).searchParams
  const filters: Record<string, string> = {}

  for (const [key, value] of params.entries()) {
    if (PAGING_KEYS.has(key)) continue
    if (value !== '') filters[key] = value
  }

  const page = Number(params.get('page'))
  const limit = Number(params.get('limit'))
  const order = params.get('order')

  return {
    page: Number.isFinite(page) && page > 0 ? page : 1,
    limit: Number.isFinite(limit) && limit > 0 ? limit : undefined,
    sort: params.get('sort') ?? undefined,
    order: order === 'asc' || order === 'desc' ? order : undefined,
    search: params.get('search')?.trim() || undefined,
    filters,
  }
}
