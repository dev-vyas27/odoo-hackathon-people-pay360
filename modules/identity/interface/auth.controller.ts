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
  type Actor,
  type CurrentUser,
  type PageQuery,
  type Paged,
  type Result,
} from '@/modules/shared'
import { LoginUseCase } from '../application/login.use-case'
import { CreateAccountUseCase } from '../application/create-account.use-case'
import { ListAccountsUseCase } from '../application/list-accounts.use-case'
import { PostgresAccountRepository } from '../infrastructure/postgres-account.repository'
import { BcryptHasher } from '../infrastructure/bcrypt-hasher'
import type { AccountView } from '../domain/account'
import { createAccountSchema, loginSchema } from './auth.schema'

/**
 * Wiring, cached per process by `resolve`. Swapping in a fake repository for a
 * test is a matter of seeding the container, not of editing this file.
 */
const deps = () => ({
  accounts: resolve('identity.accounts', () => new PostgresAccountRepository()),
  hasher: resolve('identity.hasher', () => new BcryptHasher()),
})

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

export async function createAccount(actor: Actor, body: unknown): Promise<Result<AccountView>> {
  const parsed = createAccountSchema.safeParse(body)
  if (!parsed.success) return Err(invalid(parsed.error.issues))

  const { accounts, hasher } = deps()
  return new CreateAccountUseCase(accounts, hasher).execute({ actor, ...parsed.data })
}

export async function listAccounts(
  actor: Actor,
  query: PageQuery,
): Promise<Result<Paged<AccountView>>> {
  const { accounts } = deps()
  return new ListAccountsUseCase(accounts).execute({ actor, query })
}
