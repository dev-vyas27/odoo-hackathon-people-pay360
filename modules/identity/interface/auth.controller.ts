


import {
  DomainError,
  Err,
  Ok,
  resolve,
  portOr,
  PORT_KEYS,
  type Actor,
  type CurrentUser,
  type PageQuery,
  type Paged,
  type MailerPort,
  type Result,
} from '@/modules/shared'
import { LoginUseCase } from '../application/login.use-case'
import { CreateAccountUseCase } from '../application/create-account.use-case'
import { RequestPasswordResetUseCase } from '../application/request-password-reset.use-case'
import {
  InviteAccountUseCase,
  type InviteResult,
} from '../application/invite-account.use-case'
import {
  CheckSetupLinkUseCase,
  SetPasswordUseCase,
  type SetupLinkStatus,
} from '../application/set-password.use-case'
import {
  GetAccountUseCase,
  RevokeLoginUseCase,
  UpdateAccountUseCase,
} from '../application/update-account.use-case'
import { ListAccountsUseCase } from '../application/list-accounts.use-case'
import { PostgresAccountRepository } from '../infrastructure/postgres-account.repository'
import { BcryptHasher } from '../infrastructure/bcrypt-hasher'
import { PostgresSetupTokenRepository } from '../infrastructure/postgres-setup-token.repository'
import type { AccountView } from '../domain/account'
import {
  createAccountSchema,
  forgotPasswordSchema,
  loginSchema,
  setPasswordSchema,
  updateAccountSchema,
} from './auth.schema'



const deps = () => ({
  accounts: resolve('identity.accounts', () => new PostgresAccountRepository()),
  hasher: resolve('identity.hasher', () => new BcryptHasher()),
  tokens: resolve('identity.setup-tokens', () => new PostgresSetupTokenRepository()),
  


  mailer: portOr<MailerPort>(PORT_KEYS.mailer, {
    async send(message) {
      console.warn('[identity] no mailer registered; email dropped:', message.subject)
      return { to: message.to, sent: false, error: 'No mailer registered' }
    },
  }),
})


export interface CreatedAccount extends AccountView {
  invite: InviteResult | null
}


function invalid(issues: { path: PropertyKey[]; message: string }[]): DomainError {
  const fieldErrors: Record<string, string> = {}
  for (const issue of issues) {
    const key = issue.path.map(String).join('.') || '_'
    fieldErrors[key] ??= issue.message
  }
  return DomainError.validation('VALIDATION_FAILED', 'Check the highlighted fields', fieldErrors)
}

export async function login(body: unknown): Promise<Result<CurrentUser>> {
  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) return Err(invalid(parsed.error.issues))

  const { accounts, hasher } = deps()
  return new LoginUseCase(accounts, hasher).execute(parsed.data)
}


export function me(actor: Actor | null): Result<CurrentUser> {
  if (!actor) return Err(DomainError.unauthorized('UNAUTHENTICATED', 'Sign in to continue'))
  return Ok({
    employeeId: actor.employeeId,
    role: actor.role,
    email: actor.email,
    name: actor.name,
  })
}



export async function createAccount(
  actor: Actor,
  body: unknown,
  origin: string,
): Promise<Result<CreatedAccount>> {
  const parsed = createAccountSchema.safeParse(body)
  if (!parsed.success) return Err(invalid(parsed.error.issues))

  const { accounts, tokens, mailer } = deps()

  const created = await new CreateAccountUseCase(accounts).execute({
    actor,
    name: parsed.data.name,
    email: parsed.data.email,
    role: parsed.data.role,
    isActive: parsed.data.isActive,
  })
  if (!created.ok) return created

  if (!parsed.data.sendInvite) {
    return Ok({ ...created.value, invite: null })
  }

  const invited = await new InviteAccountUseCase(accounts, tokens, mailer).execute({
    actor,
    accountId: created.value.id,
    purpose: 'invite',
    origin,
  })

  return Ok({
    ...created.value,
    
    invite: invited.ok ? invited.value : null,
  })
}


export async function inviteAccount(
  actor: Actor,
  accountId: string,
  origin: string,
): Promise<Result<InviteResult>> {
  const { accounts, tokens, mailer } = deps()
  return new InviteAccountUseCase(accounts, tokens, mailer).execute({ actor, accountId, origin })
}


export async function setPassword(body: unknown): Promise<Result<{ email: string }>> {
  const parsed = setPasswordSchema.safeParse(body)
  if (!parsed.success) return Err(invalid(parsed.error.issues))

  const { accounts, tokens, hasher } = deps()
  return new SetPasswordUseCase(accounts, tokens, hasher).execute({
    token: String((body as { token?: unknown }).token ?? ''),
    password: parsed.data.password,
  })
}


export async function checkSetupLink(token: string): Promise<Result<SetupLinkStatus>> {
  const { accounts, tokens } = deps()
  return new CheckSetupLinkUseCase(accounts, tokens).execute({ token })
}

export async function listAccounts(
  actor: Actor,
  query: PageQuery,
): Promise<Result<Paged<AccountView>>> {
  const { accounts } = deps()
  return new ListAccountsUseCase(accounts).execute({ actor, query })
}



export function getAccount(actor: Actor, accountId: string): Promise<Result<AccountView>> {
  const { accounts } = deps()
  return new GetAccountUseCase(accounts).execute({ actor, accountId })
}

export async function updateAccount(
  actor: Actor,
  accountId: string,
  body: unknown,
): Promise<Result<AccountView>> {
  const parsed = updateAccountSchema.safeParse(body)
  if (!parsed.success) return Err(invalid(parsed.error.issues))

  const { accounts, hasher } = deps()
  return new UpdateAccountUseCase(accounts, hasher).execute({
    actor,
    accountId,
    name: parsed.data.name,
    role: parsed.data.role,
    isActive: parsed.data.isActive,
    
    password: parsed.data.password || undefined,
  })
}

export function revokeLogin(actor: Actor, accountId: string): Promise<Result<AccountView>> {
  const { accounts } = deps()
  return new RevokeLoginUseCase(accounts).execute({ actor, accountId })
}



export async function requestPasswordReset(
  body: unknown,
  origin: string,
): Promise<Result<Record<string, never>>> {
  const parsed = forgotPasswordSchema.safeParse(body)
  if (!parsed.success) return Err(invalid(parsed.error.issues))

  const { accounts, tokens, mailer } = deps()
  return new RequestPasswordResetUseCase(accounts, tokens, mailer).execute({
    email: parsed.data.email,
    origin,
  })
}
