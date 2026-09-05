/**
 * Redeem a set-password link.
 *
 * Unauthenticated by necessity — the whole point is that the person cannot sign
 * in yet. The token IS the authentication, which is why every failure mode
 * below matters:
 *
 *   unknown hash   the link was never issued, or was superseded by a newer one
 *   already used   a link in an inbox is forever; redeeming twice must not work
 *   expired        an invitation forgotten for six months is not a way in
 *
 * All three return the SAME message. Distinguishing them tells someone probing
 * with random tokens which of their guesses corresponded to a real invitation,
 * and there is nothing a legitimate user can do differently in any of the three
 * cases anyway — they need a new link either way.
 */
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
    /**
     * Policy first, before the token is even looked up.
     *
     * A weak password should not consume the link. Checking the token first and
     * the password second would burn a single-use invitation on a typo.
     */
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

    /**
     * Claim the token BEFORE writing the password.
     *
     * `markUsed` is conditional on it still being unused, so two tabs
     * submitting at once cannot both succeed — the loser gets `false` here and
     * is told the link is spent, rather than both silently setting a password
     * and the second overwriting the first.
     */
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
  /** Only present when valid — so the page can greet them by name. */
  name?: string
  email?: string
  purpose?: 'invite' | 'reset'
}

/**
 * Is this link still good? Called when the page loads, so somebody clicking an
 * expired invitation is told immediately rather than after typing a password
 * twice.
 *
 * It reveals a name and email for a VALID token only, and a valid token is 256
 * bits of entropy that was emailed to that address — so holding it already
 * implies access to the mailbox.
 */
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
