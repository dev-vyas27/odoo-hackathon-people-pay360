


import { DomainError, Err, Ok, type CurrentUser, type Result, type UseCase } from '@/modules/shared'
import type { AccountRepositoryPort } from './ports/account-repository.port'
import type { PasswordHasherPort } from './ports/password-hasher.port'
import { normalizeEmail } from '../domain/account'

export interface LoginInput {
  email: string
  password: string
}


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
