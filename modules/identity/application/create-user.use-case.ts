/**
 * Create a login. Admin-only, and the check lives here rather than in the route
 * so that the seed script and any future CLI inherit the same rule.
 */
import {
  DomainError,
  Err,
  Ok,
  authorize,
  type Actor,
  type Result,
  type Role,
  type UseCase,
} from '@/modules/shared'
import type { UserRepositoryPort } from './ports/user-repository.port'
import type { PasswordHasherPort } from './ports/password-hasher.port'
import { normalizeEmail, type UserView } from '../domain/user'

export interface CreateUserInput {
  actor: Actor
  email: string
  name: string
  password: string
  role: Role
  employeeId?: string | null
  isActive?: boolean
}

export class CreateUserUseCase implements UseCase<CreateUserInput, UserView> {
  constructor(
    private readonly users: UserRepositoryPort,
    private readonly hasher: PasswordHasherPort,
  ) {}

  async execute(input: CreateUserInput): Promise<Result<UserView>> {
    const allowed = authorize(input.actor, 'user', 'create')
    if (!allowed.ok) return allowed

    const email = normalizeEmail(input.email)

    if (await this.users.findByEmail(email)) {
      return Err(
        DomainError.conflict('USER_EMAIL_TAKEN', `A user with ${email} already exists`, { email }),
      )
    }

    const user = await this.users.create({
      email,
      name: input.name.trim(),
      role: input.role,
      employeeId: input.employeeId ?? null,
      passwordHash: await this.hasher.hash(input.password),
      isActive: input.isActive ?? true,
    })

    return Ok(user.toView())
  }
}
