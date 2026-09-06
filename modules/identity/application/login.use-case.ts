/**
 * Email + password -> session claims.
 *
 * Security note that is worth saying out loud in the demo: an unknown email and
 * a wrong password return the SAME error. Distinguishing them turns the login
 * form into an account-enumeration oracle. The hasher is also run against a
 * dummy hash when the user does not exist, so the response time does not leak
 * whether the address is registered either.
 */
import { DomainError, Err, Ok, type CurrentUser, type Result, type UseCase } from '@/modules/shared'
import type { AccountRepositoryPort } from './ports/account-repository.port'
import type { PasswordHasherPort } from './ports/password-hasher.port'
import { normalizeEmail } from '../domain/account'

export interface LoginInput {
  email: string
  password: string
}

/** A bcrypt hash of a random string. Never matches; costs the same to check. */
const DUMMY_HASH = '$2b$10$CwTycUXWue0Thq9StjUM0uJ8.Ux3Vh4pQ2qFqvIcS8B0eYbkVsKQK'

export class LoginUseCase implements UseCase<LoginInput, CurrentUser> {
  constructor(
    private readonly accounts: AccountRepositoryPort,
    private readonly hasher: PasswordHasherPort,
  ) {}

  async execute(input: LoginInput): Promise<Result<CurrentUser>> {
    const account = await this.accounts.findByEmail(normalizeEmail(input.email))

    const matches = await this.hasher.compare(
      input.password,
      // Null for an employee with no login, which must cost the same to reject as
      // a wrong password — otherwise the timing says who has an account.
      account?.passwordHash ?? DUMMY_HASH,
    )

    if (!account || !matches) {
      return Err(
        DomainError.unauthorized('INVALID_CREDENTIALS', 'Email or password is incorrect'),
      )
    }

    try {
      account.assertCanSignIn()
    } catch (reason) {
      if (DomainError.is(reason)) return Err(reason)
      throw reason
    }

    return Ok(account.toCurrentUser())
  }
}
