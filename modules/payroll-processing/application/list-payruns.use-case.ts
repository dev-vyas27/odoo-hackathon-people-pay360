import {
  authorize,
  Ok,
  type Actor,
  type PageQuery,
  type Paged,
  type Result,
  type UseCase,
} from '@/modules/shared'
import type { Payrun } from '../domain/payrun'
import type { PayrunRepositoryPort } from './ports/payrun-repository.port'

export interface ListPayrunsInput {
  actor: Actor
  query: PageQuery
}

export class ListPayrunsUseCase implements UseCase<ListPayrunsInput, Paged<Payrun>> {
  constructor(private readonly payruns: PayrunRepositoryPort) {}

  async execute({ actor, query }: ListPayrunsInput): Promise<Result<Paged<Payrun>>> {
    const allowed = authorize(actor, 'payrun', 'read')
    if (!allowed.ok) return allowed

    
    return Ok(
      await this.payruns.findMany(
        query.sort ? query : { ...query, sort: 'periodStart', order: 'desc' },
      ),
    )
  }
}
