/**
 * Give someone a login. Admin-only, and the check lives here rather than in the
 * route so that the seed script and any future CLI inherit the same rule.
 *
 * Two shapes, because an account is now an employee row:
 *
 *   the email is unknown          -> create the employee AND its credentials
 *   the email is a known employee -> grant that person a login
 *
 * The second case used to be an `EMAIL_TAKEN` conflict, and rejecting it would
 * now be wrong: "this person exists in HR and needs an account" is the ordinary
 * request, not a mistake. Granting a login to someone who already has one is
 * still a conflict — that is a password reset, and it should say so.
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
import { normalizeEmail, type AccountView } from '../domain/account'

export interface CreateAccountInput {
  actor: Actor
  email: string
  name: string
  password: string
  role: Role
  isActive?: boolean
}

export class CreateAccountUseCase implements UseCase<CreateAccountInput, AccountView> {
  constructor(
    private readonly accounts: AccountRepositoryPort,
    private readonly hasher: PasswordHasherPort,
  ) {}

  async execute(input: CreateAccountInput): Promise<Result<AccountView>> {
    const allowed = authorize(input.actor, 'user', 'create')
    if (!allowed.ok) return allowed

    const email = normalizeEmail(input.email)
    const existing = await this.accounts.findByEmail(email)
    const passwordHash = await this.hasher.hash(input.password)

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
        passwordHash,
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
