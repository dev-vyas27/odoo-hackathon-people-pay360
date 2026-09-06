


import { DomainError, type Role, type CurrentUser } from '@/modules/shared'

export interface AccountProps {
  
  id: string
  email: string
  name: string
  role: Role
  


  passwordHash: string | null
  


  hasLogin?: boolean
  isActive: boolean
}


export interface AccountView {
  id: string
  email: string
  name: string
  role: Role
  
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
    
    
    return this.props.hasLogin ?? this.props.passwordHash !== null
  }

  


  get passwordHash(): string | null {
    return this.props.passwordHash
  }

  


  assertCanSignIn(): void {
    if (!this.props.isActive || this.props.passwordHash === null) {
      throw DomainError.unauthorized('INVALID_CREDENTIALS', 'Email or password is incorrect')
    }
  }

  toView(): AccountView {
    const { id, email, name, role, isActive } = this.props
    return { id, email, name, role, hasLogin: this.hasLogin, isActive }
  }

  
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
