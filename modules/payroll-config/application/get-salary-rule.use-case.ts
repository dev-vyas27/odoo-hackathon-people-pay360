import {
  authorize,
  DomainError,
  Err,
  Ok,
  type Actor,
  type Result,
  type UseCase,
} from '@/modules/shared'
import type { SalaryRule } from '../domain/salary-rule'
import type { SalaryRuleRepositoryPort } from './ports/salary-rule-repository.port'

export interface GetSalaryRuleInput {
  actor: Actor
  id: string
}

export class GetSalaryRuleUseCase implements UseCase<GetSalaryRuleInput, SalaryRule> {
  constructor(private readonly rules: SalaryRuleRepositoryPort) {}

  async execute({ actor, id }: GetSalaryRuleInput): Promise<Result<SalaryRule>> {
    const allowed = authorize(actor, 'salary_rule', 'read')
    if (!allowed.ok) return allowed

    const rule = await this.rules.findById(id)
    if (!rule) {
      return Err(DomainError.notFound('RULE_NOT_FOUND', 'That salary rule no longer exists.'))
    }
    return Ok(rule)
  }
}
