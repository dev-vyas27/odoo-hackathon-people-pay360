


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


export function respond<T>(result: Result<T>, successStatus = 200): Response {
  if (!result.ok) return errorResponse(result.error)
  if (successStatus === 204) return new Response(null, { status: 204 })
  return Response.json({ data: result.value }, { status: successStatus })
}



export function handle(fn: () => Promise<Response>): Promise<Response> {
  return fn().catch((reason) => {
    if (DomainError.is(reason)) return errorResponse(reason)

    


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



function fromPostgresError(reason: unknown): DomainError | null {
  const code = (reason as { code?: unknown } | null)?.code
  if (typeof code !== 'string') return null

  switch (code) {
    case '23505': 
      return DomainError.conflict('ALREADY_EXISTS', 'A record with these details already exists.')
    case '23503': 
      return DomainError.validation(
        'RELATED_RECORD_NOT_FOUND',
        'This refers to a record that does not exist.',
      )
    case '23502': 
      return DomainError.validation('REQUIRED_FIELD_MISSING', 'A required field was not supplied.')
    case '23P01': 
      return DomainError.conflict(
        'OVERLAPPING_RECORD',
        'This overlaps a record that already exists for the same period.',
      )
    case '23514': 
      return DomainError.rule('CHECK_FAILED', 'That combination of values is not allowed.')
    case '22P02': 
      return DomainError.validation('MALFORMED_VALUE', 'One of the supplied values is malformed.')
    default:
      return null
  }
}


export function parseQuery(url: string): Record<string, string> {
  return Object.fromEntries(new URL(url).searchParams.entries())
}


const PAGING_KEYS = new Set(['page', 'limit', 'sort', 'order', 'search'])



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
