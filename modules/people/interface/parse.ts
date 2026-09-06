import type { z } from 'zod'
import { DomainError, Err, Ok, type Result } from '@/modules/shared'

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
