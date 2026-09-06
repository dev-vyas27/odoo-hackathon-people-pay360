import {
  authorize,
  DomainError,
  Err,
  Ok,
  type Actor,
  type Result,
  type UseCase,
} from '@/modules/shared'
import { createSalaryRule, type SalaryRule, type SalaryRuleInput } from '../domain/salary-rule'
import type { SalaryRuleRepositoryPort } from './ports/salary-rule-repository.port'
import { attempt } from './attempt'

export interface CreateSalaryRuleInput {
  actor: Actor
  data: Omit<SalaryRuleInput, 'id'>
}

export class CreateSalaryRuleUseCase implements UseCase<CreateSalaryRuleInput, SalaryRule> {
  constructor(private readonly rules: SalaryRuleRepositoryPort) {}

  async execute({ actor, data }: CreateSalaryRuleInput): Promise<Result<SalaryRule>> {
    const allowed = authorize(actor, 'salary_rule', 'create')
    if (!allowed.ok) return allowed

    
    const candidate = attempt(() => createSalaryRule({ ...data, id: 'pending' }))
    if (!candidate.ok) return candidate

    const existing = await this.rules.findByCode(candidate.value.code)
    if (existing) {
      return Err(
        DomainError.conflict(
          'RULE_CODE_TAKEN',
          `Another salary rule already uses the code "${candidate.value.code}".`,
          { code: candidate.value.code },
        ),
      )
    }

    
    return Ok(await this.rules.create(candidate.value))
  }
}
