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

export class DomainError extends Error {
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
