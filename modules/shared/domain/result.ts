/**
 * Result<T> — explicit success/failure without exceptions for expected errors.
 *
 * Use cases return Result. Only truly exceptional conditions (bugs, lost DB
 * connection) throw. This keeps controllers free of try/catch pyramids and makes
 * every failure mode visible in the type signature.
 */
import type { DomainError } from './domain-error'

export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: DomainError }

export const Ok = <T>(value: T): Result<T> => ({ ok: true, value })
export const Err = <T = never>(error: DomainError): Result<T> => ({ ok: false, error })

export function isOk<T>(r: Result<T>): r is { ok: true; value: T } {
  return r.ok
}

/** Unwrap or throw — only for code paths where failure is a genuine bug. */
export function unwrap<T>(r: Result<T>): T {
  if (!r.ok) throw new Error(`unwrap() on Err: ${r.error.code} ${r.error.message}`)
  return r.value
}

/** Collect many Results into one. Fails on the first error. */
export function all<T>(results: Result<T>[]): Result<T[]> {
  const values: T[] = []
  for (const r of results) {
    if (!r.ok) return r as Result<T[]>
    values.push(r.value)
  }
  return Ok(values)
}
