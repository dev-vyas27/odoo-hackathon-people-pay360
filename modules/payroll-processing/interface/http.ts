/**
 * Edge helpers for this module's controllers.
 *
 * Mirrors payroll-config's copy deliberately: the two modules stay independent
 * of each other, and neither reaches into `lib/` for something that would then
 * be shared state across every team's code.
 */
import type { ZodType } from 'zod'
import { DomainError, Err, Ok, type Actor, type Result } from '@/modules/shared'
import { getActor } from '@/lib/auth'

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
