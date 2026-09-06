

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
import type { AccountRepositoryPort } from './ports/account-repository.port'
import type { AccountView } from '../domain/account'

export interface ListAccountsInput {
  actor: Actor
  query: PageQuery
}

export class ListAccountsUseCase implements UseCase<ListAccountsInput, Paged<AccountView>> {
  constructor(private readonly accounts: AccountRepositoryPort) {}

  async execute(input: ListAccountsInput): Promise<Result<Paged<AccountView>>> {
    const allowed = authorize(input.actor, 'user', 'read')
    if (!allowed.ok) return allowed

    const page = await this.accounts.findMany(input.query)
    return Ok(paged(page.items.map((a) => a.toView()), page.total, page.page, page.limit))
  }
}
