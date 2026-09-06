


import { createHash } from 'node:crypto'
import { DomainError, Err, Ok, type Result, type UseCase } from '@/modules/shared'
import { checkPassword, describeProblems } from '../domain/password-policy'
import type { AccountRepositoryPort } from './ports/account-repository.port'
import type { PasswordHasherPort } from './ports/password-hasher.port'
import type { SetupTokenRepositoryPort } from './ports/setup-token-repository.port'

export interface SetPasswordInput {
  token: string
  password: string
}

export interface SetPasswordResult {
  email: string
}

const LINK_REJECTED =
  'This link is no longer valid. Ask an administrator to send a new one.'

export class SetPasswordUseCase implements UseCase<SetPasswordInput, SetPasswordResult> {
  constructor(
    private readonly accounts: AccountRepositoryPort,
    private readonly tokens: SetupTokenRepositoryPort,
    private readonly hasher: PasswordHasherPort,
  ) {}

  async execute(input: SetPasswordInput): Promise<Result<SetPasswordResult>> {
    


    const problems = checkPassword(input.password)
    if (problems.length > 0) {
      return Err(
        DomainError.validation('PASSWORD_TOO_WEAK', describeProblems(problems), {
          password: describeProblems(problems),
        }),
      )
    }

    const tokenHash = createHash('sha256').update(input.token).digest('hex')
    const token = await this.tokens.findByHash(tokenHash)

    if (!token || token.usedAt !== null || token.expiresAt.getTime() <= Date.now()) {
      return Err(DomainError.unauthorized('SETUP_LINK_INVALID', LINK_REJECTED))
    }

    const account = await this.accounts.findById(token.accountId)
    if (!account || !account.isActive) {
      return Err(DomainError.unauthorized('SETUP_LINK_INVALID', LINK_REJECTED))
    }

    


    const claimed = await this.tokens.markUsed(token.id)
    if (!claimed) {
      return Err(DomainError.unauthorized('SETUP_LINK_INVALID', LINK_REJECTED))
    }

    const updated = await this.accounts.update(account.id, {
      passwordHash: await this.hasher.hash(input.password),
    })
    if (!updated) {
      return Err(DomainError.notFound('ACCOUNT_NOT_FOUND', 'That account no longer exists'))
    }

    return Ok({ email: updated.email })
  }
}

export interface CheckSetupLinkInput {
  token: string
}

export interface SetupLinkStatus {
  valid: boolean
  
  name?: string
  email?: string
  purpose?: 'invite' | 'reset'
}



export class CheckSetupLinkUseCase implements UseCase<CheckSetupLinkInput, SetupLinkStatus> {
  constructor(
    private readonly accounts: AccountRepositoryPort,
    private readonly tokens: SetupTokenRepositoryPort,
  ) {}

  async execute(input: CheckSetupLinkInput): Promise<Result<SetupLinkStatus>> {
    const tokenHash = createHash('sha256').update(input.token).digest('hex')
    const token = await this.tokens.findByHash(tokenHash)

    if (!token || token.usedAt !== null || token.expiresAt.getTime() <= Date.now()) {
      return Ok({ valid: false })
    }

    const account = await this.accounts.findById(token.accountId)
    if (!account || !account.isActive) return Ok({ valid: false })

    return Ok({
      valid: true,
      name: account.name,
      email: account.email,
      purpose: token.purpose,
    })
  }
}
