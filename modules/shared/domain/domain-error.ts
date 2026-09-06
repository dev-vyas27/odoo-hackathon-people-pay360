


export type ErrorKind =
  | 'validation'
  | 'not_found'
  | 'conflict'
  | 'forbidden'
  | 'unauthorized'
  | 'rule_violation'



const DOMAIN_ERROR_BRAND = '__pp360_domain_error__' as const

export class DomainError extends Error {
  
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
  
  static rule(code: string, message: string, details?: Record<string, unknown>) {
    return new DomainError('rule_violation', code, message, details)
  }
}
