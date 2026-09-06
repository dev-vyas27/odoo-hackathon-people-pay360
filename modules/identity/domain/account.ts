/**
 * Account — the login identity, which since 0010 IS an employee row.
 *
 * There is no `users` table any more. An administrator creates an employee and
 * that employee is the account; the credentials (`role`, `password_hash`) live
 * on the employee record. So this type has ONE id, and `employeeId` is an alias
 * for it rather than a separate nullable link.
 *
 * `passwordHash` is nullable, and that nullability is the feature: an employee
 * with no hash is an HR record that cannot sign in. That is how "on the payroll
 * but has no account" survives the merge.
 *
 * The hash lives on the entity because the login use case has to compare
 * against it, but it is deliberately absent from `toView()` — the only shape
 * that ever reaches a response body.
 */
import { DomainError, type Role, type CurrentUser } from '@/modules/shared'

export interface AccountProps {
  /** The employee id. There is no other identifier. */
  id: string
  email: string
  name: string
  role: Role
  /**
   * NULL for an employee who has never been given a login.
   *
   * Only `findByEmail` selects this. Every other projection leaves it out on
   * purpose, so do NOT infer `hasLogin` from it — see below.
   */
  passwordHash: string | null
  /**
   * Whether a hash exists, carried separately from the hash itself.
   *
   * This field exists because deriving `hasLogin` from `passwordHash` is wrong
   * for every read except the login lookup: the list and detail queries omit
   * the hash, so the derivation silently reported "no login" for everybody.
   * The repository selects `(password_hash IS NOT NULL)` instead, which is the
   * truth without ever putting a hash on the wire.
   */
  hasLogin?: boolean
  isActive: boolean
}

/** The safe projection: what a response body or a JWT may contain. */
export interface AccountView {
  id: string
  email: string
  name: string
  role: Role
  /** Whether this employee can actually sign in. */
  hasLogin: boolean
  isActive: boolean
}

export class Account {
  private constructor(private readonly props: AccountProps) {}

  static from(props: AccountProps): Account {
    return new Account({ ...props, email: normalizeEmail(props.email) })
  }

  get id(): string {
    return this.props.id
  }
  get email(): string {
    return this.props.email
  }
  get name(): string {
    return this.props.name
  }
  get role(): Role {
    return this.props.role
  }
  get isActive(): boolean {
    return this.props.isActive
  }
  get hasLogin(): boolean {
    // Prefer the explicit flag; fall back to the hash for callers that build an
    // Account from credentials they already hold (creation, login).
    return this.props.hasLogin ?? this.props.passwordHash !== null
  }

  /**
   * Only the login use case should read this, and only to hand it to a hasher.
   * It is not part of `AccountView`, so it cannot leak through a controller by
   * accident — `JSON.stringify(account.toView())` is always safe.
   */
  get passwordHash(): string | null {
    return this.props.passwordHash
  }

  /**
   * A deactivated employee must not be able to sign in even with the correct
   * password, and neither must one who was never given a login. Both are
   * checked in the domain so every future entry point inherits them.
   *
   * The two failures return the SAME message on purpose: telling an anonymous
   * caller "that account is deactivated" confirms the address exists.
   */
  assertCanSignIn(): void {
    if (!this.props.isActive || this.props.passwordHash === null) {
      throw DomainError.unauthorized('INVALID_CREDENTIALS', 'Email or password is incorrect')
    }
  }

  toView(): AccountView {
    const { id, email, name, role, isActive } = this.props
    return { id, email, name, role, hasLogin: this.hasLogin, isActive }
  }

  /** The claim set that becomes the session token. */
  toCurrentUser(): CurrentUser {
    return {
      employeeId: this.props.id,
      role: this.props.role,
      email: this.props.email,
      name: this.props.name,
    }
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}
