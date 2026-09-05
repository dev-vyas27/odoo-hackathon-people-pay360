/**
 * Bridge between the domain's throwing invariants and the application's Result.
 *
 * Anything that is not a DomainError is rethrown: an illegal state transition is
 * a business outcome, a TypeError is a bug, and turning the second into a 400
 * would hide it.
 */
import { DomainError, Err, Ok, type Result } from '@/modules/shared'

export function attempt<T>(fn: () => T): Result<T> {
  try {
    return Ok(fn())
  } catch (reason) {
    if (reason instanceof DomainError) return Err(reason)
    throw reason
  }
}
