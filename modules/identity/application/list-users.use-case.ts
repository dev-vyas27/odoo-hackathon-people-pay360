/**
 * The user administration list. Admin-only, and it returns `UserView` so a hash
 * cannot reach a response body even if a controller forgets to project.
 */
import {
  Ok,
  authorize,
  paged,
  type Actor,
  type PageQuery,
  type Paged,
  type Result,
  type UseCase,
} from '@/modules/shared'
import type { UserRepositoryPort } from './ports/user-repository.port'
import type { UserView } from '../domain/user'

export interface ListUsersInput {
  actor: Actor
  query: PageQuery
}

export class ListUsersUseCase implements UseCase<ListUsersInput, Paged<UserView>> {
  constructor(private readonly users: UserRepositoryPort) {}

  async execute(input: ListUsersInput): Promise<Result<Paged<UserView>>> {
    const allowed = authorize(input.actor, 'user', 'read')
    if (!allowed.ok) return allowed

    const page = await this.users.findMany(input.query)
    return Ok(paged(page.items.map((u) => u.toView()), page.total, page.page, page.limit))
  }
}
