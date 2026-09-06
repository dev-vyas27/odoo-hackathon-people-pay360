

import type { DomainError } from './domain-error'

export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: DomainError }

export const Ok = <T>(value: T): Result<T> => ({ ok: true, value })
export const Err = <T = never>(error: DomainError): Result<T> => ({ ok: false, error })

export function isOk<T>(r: Result<T>): r is { ok: true; value: T } {
  return r.ok
}

export function unwrap<T>(r: Result<T>): T {
  if (!r.ok) throw new Error(`unwrap() on Err: ${r.error.code} ${r.error.message}`)
  return r.value
}

export function all<T>(results: Result<T>[]): Result<T[]> {
  const values: T[] = []
  for (const r of results) {
    if (!r.ok) return r as Result<T[]>
    values.push(r.value)
  }
  return Ok(values)
}
