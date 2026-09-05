/**
 * Send someone a link to set their own password.
 *
 * Nobody but the account holder should ever know their password — not the
 * administrator who created them, and not whoever reads the server log. So the
 * admin creates the account without one, and this emails a single-use link.
 *
 * The token is 32 random bytes. Only its SHA-256 reaches the database, for the
 * same reason `password_hash` exists: reading the table must not let you sign
 * in as anybody.
 *
 * A failed send is NOT a failed invitation. The token is already issued, so the
 * result reports `emailed: false` and the admin can copy the link from the
 * response rather than being told to try again against a token that now exists.
 */
import { createHash, randomBytes } from 'node:crypto'
import {
  DomainError,
  Err,
  Ok,
  authorize,
  type Actor,
  type MailerPort,
  type Result,
  type UseCase,
} from '@/modules/shared'
import type { AccountRepositoryPort } from './ports/account-repository.port'
import type { SetupTokenRepositoryPort } from './ports/setup-token-repository.port'

/**
 * How long a link lives.
 *
 * Long enough to survive a weekend and a spam folder, short enough that an
 * invitation forgotten in a mailbox stops being a way in. Resending is one
 * click, so erring short costs nothing.
 */
const INVITE_TTL_HOURS = 72

export interface InviteAccountInput {
  actor: Actor
  accountId: string
  /** 'invite' for a new account, 'reset' when they already had a login. */
  purpose?: 'invite' | 'reset'
  /** Absolute origin, e.g. https://hr.company.com — used to build the link. */
  origin: string
}

export interface InviteResult {
  email: string
  emailed: boolean
  /** The full link. Returned so an admin can hand it over when mail is down. */
  link: string
  expiresAt: string
}

/** The DB stores this; the email carries the plaintext. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export class InviteAccountUseCase implements UseCase<InviteAccountInput, InviteResult> {
  constructor(
    private readonly accounts: AccountRepositoryPort,
    private readonly tokens: SetupTokenRepositoryPort,
    private readonly mailer: MailerPort,
  ) {}

  async execute(input: InviteAccountInput): Promise<Result<InviteResult>> {
    const allowed = authorize(input.actor, 'user', 'update')
    if (!allowed.ok) return allowed

    const account = await this.accounts.findById(input.accountId)
    if (!account) {
      return Err(DomainError.notFound('ACCOUNT_NOT_FOUND', 'That account does not exist'))
    }
    if (!account.isActive) {
      return Err(
        DomainError.rule(
          'ACCOUNT_INACTIVE',
          'Reactivate this account before inviting them to set a password',
        ),
      )
    }

    // 32 bytes, url-safe. base64url keeps the link short and copy-pasteable.
    const token = randomBytes(32).toString('base64url')
    const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000)

    await this.tokens.issue({
      accountId: account.id,
      tokenHash: hashToken(token),
      purpose: input.purpose ?? (account.hasLogin ? 'reset' : 'invite'),
      expiresAt,
    })

    const link = `${input.origin.replace(/\/$/, '')}/set-password?token=${token}`
    const isReset = account.hasLogin

    const { sent } = await this.mailer.send({
      to: account.email,
      subject: isReset
        ? 'Reset your PeoplePay360 password'
        : 'Set up your PeoplePay360 account',
      text: [
        `Hello ${account.name},`,
        '',
        isReset
          ? 'Someone asked to reset the password on your PeoplePay360 account.'
          : 'An account has been created for you on PeoplePay360.',
        '',
        'Choose a password using the link below:',
        link,
        '',
        `The link works once and expires in ${INVITE_TTL_HOURS} hours.`,
        '',
        isReset
          ? 'If you did not ask for this, ignore this email — your current password still works.'
          : 'If you were not expecting this, ignore this email.',
      ].join('\n'),
    })

    return Ok({
      email: account.email,
      emailed: sent,
      link,
      expiresAt: expiresAt.toISOString(),
    })
  }
}
