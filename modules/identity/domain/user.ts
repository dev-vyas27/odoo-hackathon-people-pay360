/**
 * User — the login identity. Distinct from Employee on purpose.
 *
 * An Employee is an HR record; a User is a credential with a role. Not every
 * employee has a login, and an admin may have no employee record at all. Fusing
 * them is the shortcut that makes "deactivate the login but keep the payroll
 * history" impossible later.
 *
 * The password hash lives on the entity because the login use case has to
 * compare against it, but it is deliberately absent from `toView()` — the only
 * shape that ever reaches a response body.
 */
import { DomainError, type Role, type CurrentUser } from '@/modules/shared'

export interface UserProps {
  id: string
  email: string
  name: string
  role: Role
  /** Links the login to an HR record. Null for pure administrators. */
  employeeId: string | null
  passwordHash: string
  isActive: boolean
}

/** The safe projection: what a response body or a JWT may contain. */
export interface UserView {
  id: string
  email: string
  name: string
  role: Role
  employeeId: string | null
  isActive: boolean
}

export class User {
  private constructor(private readonly props: UserProps) {}

  static from(props: UserProps): User {
    return new User({ ...props, email: normalizeEmail(props.email) })
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
  get employeeId(): string | null {
    return this.props.employeeId
  }
  get isActive(): boolean {
    return this.props.isActive
  }

  /**
   * Only the login use case should read this, and only to hand it to a hasher.
   * It is not part of `UserView`, so it cannot leak through a controller by
   * accident — a `JSON.stringify(user.toView())` is always safe.
   */
  get passwordHash(): string {
    return this.props.passwordHash
  }

  /**
   * A deactivated account must not be able to sign in even with the correct
   * password. Checked in the domain so every future entry point inherits it.
   */
  assertCanSignIn(): void {
    if (!this.props.isActive) {
      throw DomainError.forbidden('USER_INACTIVE', 'This account has been deactivated')
    }
  }

  toView(): UserView {
    const { id, email, name, role, employeeId, isActive } = this.props
    return { id, email, name, role, employeeId, isActive }
  }

  /** The claim set that becomes the session token. */
  toCurrentUser(): CurrentUser {
    return {
      userId: this.props.id,
      employeeId: this.props.employeeId,
      role: this.props.role,
      email: this.props.email,
      name: this.props.name,
    }
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}
