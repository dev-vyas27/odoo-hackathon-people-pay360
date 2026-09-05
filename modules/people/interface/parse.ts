import type { z } from 'zod'
import { DomainError, Err, Ok, type Result } from '@/modules/shared'

/**
 * Bridges zod's throw-based parsing to the Result-based world use cases and
 * `respond()` expect, so a malformed request becomes a clean 400 through the
 * normal error channel instead of a 500 from an uncaught ZodError.
 */
export function parseWith<T>(schema: z.ZodType<T>, data: unknown): Result<T> {
  const result = schema.safeParse(data)
  if (!result.success) {
    return Err(
      DomainError.validation('VALIDATION_ERROR', 'The request payload is invalid', {
        issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      }),
    )
  }
  return Ok(result.data)
}
