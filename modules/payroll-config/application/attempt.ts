/**
 * Bridge between the domain's throwing factories and the application's Result.
 *
 * Domain invariants throw (a half-valid SalaryRule must not exist), while use
 * cases return Result so controllers stay free of try/catch. This converts one
 * to the other — and deliberately rethrows anything that is NOT a DomainError,
 * because a TypeError is a bug, not a business outcome, and swallowing it would
 * turn a crash into a confusing 400.
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
