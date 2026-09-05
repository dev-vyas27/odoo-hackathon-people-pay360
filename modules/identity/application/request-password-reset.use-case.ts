/**
 * "I forgot my password." Public, unauthenticated, and deliberately incurious.
 *
 * ── The rule that shapes this whole file ────────────────────────────────────
 *
 * The response is IDENTICAL whether or not the address belongs to an account.
 * Anything else turns this endpoint into an account-enumeration oracle: feed it
 * a list of addresses, watch which ones come back "sent", and you have a
 * verified list of who works here. The login endpoint already refuses to
 * distinguish "unknown email" from "wrong password" for the same reason, and it
 * would be pointless to close that door and leave this one open.
 *
 * So every branch below returns the same `Ok`. The only place the difference is
 * visible is the server log.
 *
 * Three cases silently do nothing:
 *   no such email        nothing to reset
 *   no login yet         an HR record whose login an admin has NOT enabled;
 *                        letting anyone with mailbox access create one would
 *                        route around that decision
 *   deactivated          a suspended account must not be able to let itself
 *                        back in
 */
import { createHash, randomBytes } from 'node:crypto'
import { Ok, type MailerPort, type Result, type UseCase } from '@/modules/shared'
import { normalizeEmail } from '../domain/account'
import type { AccountRepositoryPort } from './ports/account-repository.port'
import type { SetupTokenRepositoryPort } from './ports/setup-token-repository.port'

/**
 * One hour.
 *
 * Much shorter than an invitation's 72, because the two are different events:
 * an invite is expected and may sit in a mailbox over a weekend, whereas a
 * reset is requested by somebody standing at the keyboard right now. A short
 * window means a link intercepted later is already dead, and asking again is
 * one click.
 */
const RESET_TTL_MINUTES = 60

export interface RequestPasswordResetInput {
  email: string
  /** Absolute origin, used to build the link. See lib/app-url.ts. */
  origin: string
}

/**
 * Deliberately carries nothing. There is no field here that could differ
 * between "we sent one" and "there was nobody to send to" — the type itself
 * enforces the non-disclosure rather than relying on every caller to remember.
 */
export type RequestPasswordResetResult = Record<string, never>

export class RequestPasswordResetUseCase
  implements UseCase<RequestPasswordResetInput, RequestPasswordResetResult>
{
  constructor(
    private readonly accounts: AccountRepositoryPort,
    private readonly tokens: SetupTokenRepositoryPort,
    private readonly mailer: MailerPort,
  ) {}

  async execute(input: RequestPasswordResetInput): Promise<Result<RequestPasswordResetResult>> {
    const email = normalizeEmail(input.email)
    const account = await this.accounts.findByEmail(email)

    if (!account || !account.hasLogin || !account.isActive) {
      // Logged, never returned. Whoever is running the app can see what
      // happened; whoever is probing it cannot.
      console.info(`[identity] password reset requested for ${email}: no action taken`)
      return Ok({})
    }

    const token = randomBytes(32).toString('base64url')
    const expiresAt = new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000)

    await this.tokens.issue({
      accountId: account.id,
      tokenHash: createHash('sha256').update(token).digest('hex'),
      purpose: 'reset',
      expiresAt,
    })

    const link = `${input.origin.replace(/\/$/, '')}/set-password?token=${token}`

    await this.mailer.send({
      to: account.email,
      subject: 'Reset your PeoplePay360 password',
      text: [
        `Hello ${account.name},`,
        '',
        'Someone asked to reset the password on your PeoplePay360 account.',
        '',
        'Choose a new password using the link below:',
        link,
        '',
        `The link works once and expires in ${RESET_TTL_MINUTES} minutes.`,
        '',
        'If you did not ask for this, ignore this email. Your current password',
        'still works and nothing has changed.',
      ].join('\n'),
    })

    /**
     * A send failure is swallowed on purpose. Reporting it would tell the
     * caller that the address exists — which is exactly the fact this endpoint
     * refuses to disclose. The failure is already on the server log, where the
     * person who can fix SMTP will see it.
     */
    return Ok({})
  }
}
