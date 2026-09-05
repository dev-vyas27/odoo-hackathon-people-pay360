/**
 * Small edge helpers shared by this module's controllers.
 *
 * `lib/http.ts` already owns Result -> Response; these cover the two things it
 * does not: turning a missing session into a proper 401, and turning a zod
 * failure into the same `{ error: { code, message, details } }` envelope every
 * other API failure uses, so the frontend has exactly one error shape to render.
 */
import type { ZodType } from 'zod'
import { DomainError, Err, Ok, type Actor, type Result } from '@/modules/shared'
import { getActor } from '@/lib/auth'

/**
 * The authenticated caller, or a Result the controller can return as-is.
 *
 * No explicit "connect" step: the Postgres pool in lib/db.ts connects lazily on
 * the first query and is shared across requests, so a controller never has to
 * think about connection lifecycle.
 */
export async function requireSession(): Promise<Result<Actor>> {
  const actor = await getActor()
  if (!actor) {
    return Err(DomainError.unauthorized('UNAUTHENTICATED', 'Sign in to continue.'))
  }
  return Ok(actor)
}

export async function parseJson<T>(request: Request, schema: ZodType<T>): Promise<Result<T>> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Err(DomainError.validation('BODY_NOT_JSON', 'The request body is not valid JSON.'))
  }
  return parseWith(schema, body)
}

export function parseWith<T>(schema: ZodType<T>, value: unknown): Result<T> {
  const parsed = schema.safeParse(value)
  if (parsed.success) return Ok(parsed.data)

  const fieldErrors: Record<string, string> = {}
  for (const issue of parsed.error.issues) {
    const path = issue.path.join('.') || '_'
    // Keep the first message per field: it is the one the user should fix first.
    fieldErrors[path] ??= issue.message
  }

  return Err(
    DomainError.validation(
      'VALIDATION_FAILED',
      parsed.error.issues[0]?.message ?? 'Some fields need attention.',
      { fieldErrors },
    ),
  )
}
