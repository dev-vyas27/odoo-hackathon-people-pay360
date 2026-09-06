/**
 * Administer an existing account: rename, change role, activate/deactivate,
 * reset the password, or take the login away entirely.
 *
 * ── The rule that makes this safe ───────────────────────────────────────────
 *
 * An administrator must not be able to lock themselves out. Three of the
 * actions here can do it — deactivating yourself, demoting yourself out of
 * `admin`, and revoking your own login — and all three are silent: the request
 * succeeds, and the damage only shows up on the next page load, by which point
 * you cannot get back in to undo it.
 *
 * If yours is the only admin account, nobody can. So the guard is not a
 * courtesy, it is the difference between a recoverable mistake and a support
 * ticket against a hackathon database at midnight.
 *
 * The check is HERE rather than in the screen because the screen is not the
 * only caller — a curl against PATCH /api/users/:id has to hit it too.
 */
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
  /** Omit to leave the password alone. Supplying it is a reset. */
  password?: string
}

/**
 * True when the actor is acting on their own account.
 *
 * Since 0010 an account IS an employee row, so `employeeId` is the account id —
 * there is no separate user identifier to compare against.
 */
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
      // `undefined` leaves the hash untouched; the repository COALESCEs it.
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

/**
 * Take away the ability to sign in, without deleting anything.
 *
 * This is the action the merged account model made possible: clearing
 * `password_hash` leaves the employee record — their contracts, payslips and
 * leave history — completely intact, but they can no longer authenticate. It is
 * what "they left the company" should do. Deleting the row would orphan a
 * decade of payroll.
 */
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
      // Idempotent rather than an error: the desired end state already holds.
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
