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
import { CreateUserUseCase } from '../application/create-user.use-case'
import { ListUsersUseCase } from '../application/list-users.use-case'
import { PostgresUserRepository } from '../infrastructure/postgres-user.repository'
import { BcryptHasher } from '../infrastructure/bcrypt-hasher'
import type { UserView } from '../domain/user'
import { createUserSchema, loginSchema } from './auth.schema'

/**
 * Wiring, cached per process by `resolve`. Swapping in a fake repository for a
 * test is a matter of seeding the container, not of editing this file.
 */
const deps = () => ({
  users: resolve('identity.users', () => new PostgresUserRepository()),
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

  const { users, hasher } = deps()
  return new LoginUseCase(users, hasher).execute(parsed.data)
}

/** `me` needs no use case: the actor IS the answer, straight from the token. */
export function me(actor: Actor | null): Result<CurrentUser> {
  if (!actor) return Err(DomainError.unauthorized('UNAUTHENTICATED', 'Sign in to continue'))
  return Ok({
    userId: actor.userId,
    employeeId: actor.employeeId,
    role: actor.role,
    email: actor.email,
    name: actor.name,
  })
}

export async function createUser(actor: Actor, body: unknown): Promise<Result<UserView>> {
  const parsed = createUserSchema.safeParse(body)
  if (!parsed.success) return Err(invalid(parsed.error.issues))

  const { users, hasher } = deps()
  return new CreateUserUseCase(users, hasher).execute({ actor, ...parsed.data })
}

export async function listUsers(actor: Actor, query: PageQuery): Promise<Result<Paged<UserView>>> {
  const { users } = deps()
  return new ListUsersUseCase(users).execute({ actor, query })
}
