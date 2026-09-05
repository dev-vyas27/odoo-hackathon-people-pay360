/**
 * Identity's controller: parse, delegate, return a Result.
 *
 * It does NOT touch cookies or Response — that is the route handler's job. This
 * keeps the controller callable from anywhere (the seed script, a test) and
 * keeps every route file down to the promised five lines.
 */
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
  loginSchema,
  setPasswordSchema,
  updateAccountSchema,
} from './auth.schema'

/**
 * Wiring, cached per process by `resolve`. Swapping in a fake repository for a
 * test is a matter of seeding the container, not of editing this file.
 */
const deps = () => ({
  accounts: resolve('identity.accounts', () => new PostgresAccountRepository()),
  hasher: resolve('identity.hasher', () => new BcryptHasher()),
  tokens: resolve('identity.setup-tokens', () => new PostgresSetupTokenRepository()),
  /**
   * Resolved per call, not cached: `delivery` registers the real mailer at
   * bootstrap, and the console fallback here keeps identity working (and
   * testable) if it ever has not.
   */
  mailer: portOr<MailerPort>(PORT_KEYS.mailer, {
    async send(message) {
      console.warn('[identity] no mailer registered; email dropped:', message.subject)
      return { to: message.to, sent: false, error: 'No mailer registered' }
    },
  }),
})

/** The account plus whatever happened to its invitation. */
export interface CreatedAccount extends AccountView {
  invite: InviteResult | null
}

/** Turn a zod failure into the same DomainError shape every other failure uses. */
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

/** `me` needs no use case: the actor IS the answer, straight from the token. */
export function me(actor: Actor | null): Result<CurrentUser> {
  if (!actor) return Err(DomainError.unauthorized('UNAUTHENTICATED', 'Sign in to continue'))
  return Ok({
    employeeId: actor.employeeId,
    role: actor.role,
    email: actor.email,
    name: actor.name,
  })
}

/**
 * Create the account, then optionally email the set-password link.
 *
 * The invitation is a SEPARATE step on purpose: if the mail server is down the
 * account still exists, and the response says the email did not go out and
 * hands back the link so the admin can pass it on another way. Rolling the
 * creation back because SMTP hiccuped would be worse for everyone.
 */
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
    // A failed invitation is reported, not thrown — the account is real either way.
    invite: invited.ok ? invited.value : null,
  })
}

/** Resend, or send for the first time if creation skipped it. */
export async function inviteAccount(
  actor: Actor,
  accountId: string,
  origin: string,
): Promise<Result<InviteResult>> {
  const { accounts, tokens, mailer } = deps()
  return new InviteAccountUseCase(accounts, tokens, mailer).execute({ actor, accountId, origin })
}

/** Public: redeem a link. The token is the authentication. */
export async function setPassword(body: unknown): Promise<Result<{ email: string }>> {
  const parsed = setPasswordSchema.safeParse(body)
  if (!parsed.success) return Err(invalid(parsed.error.issues))

  const { accounts, tokens, hasher } = deps()
  return new SetPasswordUseCase(accounts, tokens, hasher).execute({
    token: String((body as { token?: unknown }).token ?? ''),
    password: parsed.data.password,
  })
}

/** Public: is this link still good, and whose is it. */
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

// ── administration ───────────────────────────────────────────────────────────

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
    // '' means "leave the password alone", not "set it to empty".
    password: parsed.data.password || undefined,
  })
}

export function revokeLogin(actor: Actor, accountId: string): Promise<Result<AccountView>> {
  const { accounts } = deps()
  return new RevokeLoginUseCase(accounts).execute({ actor, accountId })
}
