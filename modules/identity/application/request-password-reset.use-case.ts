


import { createHash, randomBytes } from 'node:crypto'
import { Ok, type MailerPort, type Result, type UseCase } from '@/modules/shared'
import { normalizeEmail } from '../domain/account'
import type { AccountRepositoryPort } from './ports/account-repository.port'
import type { SetupTokenRepositoryPort } from './ports/setup-token-repository.port'



const RESET_TTL_MINUTES = 60

export interface RequestPasswordResetInput {
  email: string
  
  origin: string
}



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

    


    return Ok({})
  }
}
