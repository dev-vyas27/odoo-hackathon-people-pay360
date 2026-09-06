/**
 * The HTTP edge: the ONLY place that knows both Result and Response.
 *
 * Route handlers stay ~5 lines and every error shape is identical across the
 * API, which means the frontend has exactly one error contract to handle.
 */
import { ZodError } from 'zod'
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
    if (DomainError.is(reason)) return errorResponse(reason)

    /**
     * A ZodError is a malformed REQUEST, not a broken server.
     *
     * Routes are supposed to bridge zod into `Result` themselves (see
     * `parseWith`), but a handler that calls `schema.parse()` directly would
     * otherwise surface a user's typo as a 500 with no field information —
     * which is exactly what several routes did. Translating here means the
     * whole API answers a bad payload the same way whichever style a route
     * happens to use, and the client's one error contract keeps holding.
     */
    if (reason instanceof ZodError) {
      return errorResponse(
        DomainError.validation('VALIDATION_ERROR', 'The request payload is invalid', {
          issues: reason.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        }),
      )
    }

    const database = fromPostgresError(reason)
    if (database) return errorResponse(database)

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

/**
 * Last-resort translation of a Postgres constraint failure into a domain error.
 *
 * Repositories that care about a specific constraint still map it themselves,
 * with a message that names the actual business rule — that is better, and this
 * never sees those. What this catches is the long tail: posting a contract for
 * an employee id that does not exist used to reach the client as a 500 with the
 * raw constraint name in it, which is both unhelpful and a small information
 * leak. A referential mistake in a request is the client's problem to fix, so
 * it deserves a 4xx and a sentence a human can act on.
 */
function fromPostgresError(reason: unknown): DomainError | null {
  const code = (reason as { code?: unknown } | null)?.code
  if (typeof code !== 'string') return null

  switch (code) {
    case '23505': // unique_violation
      return DomainError.conflict('ALREADY_EXISTS', 'A record with these details already exists.')
    case '23503': // foreign_key_violation
      return DomainError.validation(
        'RELATED_RECORD_NOT_FOUND',
        'This refers to a record that does not exist.',
      )
    case '23502': // not_null_violation
      return DomainError.validation('REQUIRED_FIELD_MISSING', 'A required field was not supplied.')
    case '23P01': // exclusion_violation
      return DomainError.conflict(
        'OVERLAPPING_RECORD',
        'This overlaps a record that already exists for the same period.',
      )
    case '23514': // check_violation
      return DomainError.rule('CHECK_FAILED', 'That combination of values is not allowed.')
    case '22P02': // invalid_text_representation, e.g. a malformed uuid
      return DomainError.validation('MALFORMED_VALUE', 'One of the supplied values is malformed.')
    default:
      return null
  }
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
