


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



const INVITE_TTL_HOURS = 72

export interface InviteAccountInput {
  actor: Actor
  accountId: string
  
  purpose?: 'invite' | 'reset'
  
  origin: string
}

export interface InviteResult {
  email: string
  emailed: boolean
  
  link: string
  expiresAt: string
}


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
