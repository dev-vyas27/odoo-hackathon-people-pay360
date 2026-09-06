


import {
  DomainError,
  Err,
  Ok,
  authorize,
  type Actor,
  type Result,
  type Role,
  type UseCase,
} from '@/modules/shared'
import type { AccountRepositoryPort } from './ports/account-repository.port'
import { normalizeEmail, type AccountView } from '../domain/account'

export interface CreateAccountInput {
  actor: Actor
  email: string
  name: string
  role: Role
  isActive?: boolean
}

export class CreateAccountUseCase implements UseCase<CreateAccountInput, AccountView> {
  constructor(private readonly accounts: AccountRepositoryPort) {}

  async execute(input: CreateAccountInput): Promise<Result<AccountView>> {
    const allowed = authorize(input.actor, 'user', 'create')
    if (!allowed.ok) return allowed

    const email = normalizeEmail(input.email)
    const existing = await this.accounts.findByEmail(email)
    


    const passwordHash = null

    if (existing) {
      
      
      if (existing.hasLogin) {
        return Err(
          DomainError.conflict(
            'ACCOUNT_ALREADY_EXISTS',
            `${email} can already sign in. Reset the password instead of creating a second account.`,
            { email },
          ),
        )
      }

      const granted = await this.accounts.update(existing.id, {
        name: input.name.trim(),
        role: input.role,
        isActive: input.isActive ?? true,
      })
      if (!granted) {
        return Err(
          DomainError.notFound('EMPLOYEE_NOT_FOUND', 'That employee record no longer exists.'),
        )
      }
      return Ok(granted.toView())
    }

    const created = await this.accounts.create({
      email,
      name: input.name.trim(),
      role: input.role,
      passwordHash,
      isActive: input.isActive ?? true,
    })

    return Ok(created.toView())
  }
}
