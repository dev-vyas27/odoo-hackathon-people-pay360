/**
 * DomainError — a business rule violation, not a crash.
 *
 * `kind` maps to an HTTP status at the edge (see lib/http.ts) so that domain
 * code never imports anything web-related. This is the seam that keeps
 * modules/ framework-free.
 */
export type ErrorKind =
  | 'validation'
  | 'not_found'
  | 'conflict'
  | 'forbidden'
  | 'unauthorized'
  | 'rule_violation'

/**
 * A brand, so recognising a DomainError does not depend on `instanceof`.
 *
 * `instanceof` compares constructor identity, and identity is per module
 * instance. Next bundles server code per route, so `@/modules/shared` can in
 * principle be evaluated more than once in one process — at which point a
 * DomainError thrown by a use case would not be an instance of the class the
 * route handler imported, and a clean 409 would reach the browser as a 500 with
 * the right message and the wrong status.
 *
 * To be clear about the history: that has not been observed here. It was the
 * suspected cause of a run of spurious 500s that turned out to be a stale dev
 * server. The brand stays because it costs nothing and removes a whole class of
 * failure that is invisible until it is not — but it is defence in depth, not a
 * fix for a bug this codebase had.
 *
 * Use `DomainError.is()`. Never write `err instanceof DomainError`.
 */
const DOMAIN_ERROR_BRAND = '__pp360_domain_error__' as const

export class DomainError extends Error {
  /** Present on every instance, regardless of which copy of the class made it. */
  readonly [DOMAIN_ERROR_BRAND] = true as const
  readonly kind: ErrorKind
  readonly code: string
  readonly details?: Record<string, unknown>

  constructor(kind: ErrorKind, code: string, message: string, details?: Record<string, unknown>) {
    super(message)
    this.name = 'DomainError'
    this.kind = kind
    this.code = code
    this.details = details
  }

  /**
   * The nominal-safe replacement for `instanceof DomainError`.
   * Also narrows `unknown`, which is what a `catch` binding is.
   */
  static is(value: unknown): value is DomainError {
    return (
      typeof value === 'object' &&
      value !== null &&
      (value as Record<string, unknown>)[DOMAIN_ERROR_BRAND] === true
    )
  }

  static validation(code: string, message: string, details?: Record<string, unknown>) {
    return new DomainError('validation', code, message, details)
  }
  static notFound(code: string, message: string, details?: Record<string, unknown>) {
    return new DomainError('not_found', code, message, details)
  }
  static conflict(code: string, message: string, details?: Record<string, unknown>) {
    return new DomainError('conflict', code, message, details)
  }
  static forbidden(code: string, message: string, details?: Record<string, unknown>) {
    return new DomainError('forbidden', code, message, details)
  }
  static unauthorized(code: string, message: string, details?: Record<string, unknown>) {
    return new DomainError('unauthorized', code, message, details)
  }
  /** An invariant of the business domain was broken. */
  static rule(code: string, message: string, details?: Record<string, unknown>) {
    return new DomainError('rule_violation', code, message, details)
  }
}
