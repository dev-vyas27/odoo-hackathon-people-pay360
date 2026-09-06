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

    
    
    
    
    return Ok(
      await this.rules.findMany(
        query.sort ? query : { ...query, sort: 'sequence', order: 'asc' },
      ),
    )
  }
}
