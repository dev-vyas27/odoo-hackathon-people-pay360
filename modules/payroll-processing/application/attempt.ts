


import { DomainError, Err, Ok, type Result } from '@/modules/shared'

export function attempt<T>(fn: () => T): Result<T> {
  try {
    return Ok(fn())
  } catch (reason) {
    if (reason instanceof DomainError) return Err(reason)
    throw reason
  }
}
