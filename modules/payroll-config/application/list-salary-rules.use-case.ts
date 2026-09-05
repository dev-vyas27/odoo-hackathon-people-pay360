import {
  authorize,
  Ok,
  type Actor,
  type PageQuery,
  type Paged,
  type Result,
  type UseCase,
} from '@/modules/shared'
import type { SalaryRule } from '../domain/salary-rule'
import type { SalaryRuleRepositoryPort } from './ports/salary-rule-repository.port'

export interface ListSalaryRulesInput {
  actor: Actor
  query: PageQuery
}

export class ListSalaryRulesUseCase implements UseCase<ListSalaryRulesInput, Paged<SalaryRule>> {
  constructor(private readonly rules: SalaryRuleRepositoryPort) {}

  async execute({ actor, query }: ListSalaryRulesInput): Promise<Result<Paged<SalaryRule>>> {
    const allowed = authorize(actor, 'salary_rule', 'read')
    if (!allowed.ok) return allowed

    // Sequence order is the order the rules actually run in, so it is the only
    // listing order that helps someone reason about a structure. Applied only
    // when the caller did not ask for a sort of its own — spreading a default
    // BEFORE the query would let the query-string defaults silently undo it.
    return Ok(
      await this.rules.findMany(
        query.sort ? query : { ...query, sort: 'sequence', order: 'asc' },
      ),
    )
  }
}
