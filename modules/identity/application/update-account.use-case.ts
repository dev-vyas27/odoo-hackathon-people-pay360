


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
import type { PasswordHasherPort } from './ports/password-hasher.port'
import type { AccountView } from '../domain/account'

export interface UpdateAccountInput {
  actor: Actor
  accountId: string
  name?: string
  role?: Role
  isActive?: boolean
  
  password?: string
}



function isSelf(actor: Actor, accountId: string): boolean {
  return actor.employeeId === accountId
}

export class UpdateAccountUseCase implements UseCase<UpdateAccountInput, AccountView> {
  constructor(
    private readonly accounts: AccountRepositoryPort,
    private readonly hasher: PasswordHasherPort,
  ) {}

  async execute(input: UpdateAccountInput): Promise<Result<AccountView>> {
    const allowed = authorize(input.actor, 'user', 'update')
    if (!allowed.ok) return allowed

    const account = await this.accounts.findById(input.accountId)
    if (!account) {
      return Err(DomainError.notFound('ACCOUNT_NOT_FOUND', 'That account does not exist'))
    }

    if (isSelf(input.actor, input.accountId)) {
      if (input.isActive === false) {
        return Err(
          DomainError.forbidden(
            'ACCOUNT_SELF_DEACTIVATE',
            'You cannot deactivate your own account. Ask another administrator.',
          ),
        )
      }
      if (input.role && input.role !== account.role) {
        return Err(
          DomainError.forbidden(
            'ACCOUNT_SELF_ROLE_CHANGE',
            'You cannot change your own role. Ask another administrator.',
          ),
        )
      }
    }

    const updated = await this.accounts.update(input.accountId, {
      name: input.name?.trim(),
      role: input.role,
      isActive: input.isActive,
      
      passwordHash: input.password ? await this.hasher.hash(input.password) : undefined,
    })

    if (!updated) {
      return Err(DomainError.notFound('ACCOUNT_NOT_FOUND', 'That account does not exist'))
    }
    return Ok(updated.toView())
  }
}

export interface RevokeLoginInput {
  actor: Actor
  accountId: string
}



export class RevokeLoginUseCase implements UseCase<RevokeLoginInput, AccountView> {
  constructor(private readonly accounts: AccountRepositoryPort) {}

  async execute(input: RevokeLoginInput): Promise<Result<AccountView>> {
    const allowed = authorize(input.actor, 'user', 'update')
    if (!allowed.ok) return allowed

    if (isSelf(input.actor, input.accountId)) {
      return Err(
        DomainError.forbidden(
          'ACCOUNT_SELF_REVOKE',
          'You cannot revoke your own login. Ask another administrator.',
        ),
      )
    }

    const account = await this.accounts.findById(input.accountId)
    if (!account) {
      return Err(DomainError.notFound('ACCOUNT_NOT_FOUND', 'That account does not exist'))
    }
    if (!account.hasLogin) {
      
      return Ok(account.toView())
    }

    const revoked = await this.accounts.revokeLogin(input.accountId)
    if (!revoked) {
      return Err(DomainError.notFound('ACCOUNT_NOT_FOUND', 'That account does not exist'))
    }
    return Ok(revoked.toView())
  }
}

export interface GetAccountInput {
  actor: Actor
  accountId: string
}

export class GetAccountUseCase implements UseCase<GetAccountInput, AccountView> {
  constructor(private readonly accounts: AccountRepositoryPort) {}

  async execute(input: GetAccountInput): Promise<Result<AccountView>> {
    const allowed = authorize(input.actor, 'user', 'read')
    if (!allowed.ok) return allowed

    const account = await this.accounts.findById(input.accountId)
    if (!account) {
      return Err(DomainError.notFound('ACCOUNT_NOT_FOUND', 'That account does not exist'))
    }
    return Ok(account.toView())
  }
}
