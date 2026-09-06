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

export interface UpdateSalaryRuleInput {
  actor: Actor
  id: string
  data: Partial<Omit<SalaryRuleInput, 'id'>>
}

export class UpdateSalaryRuleUseCase implements UseCase<UpdateSalaryRuleInput, SalaryRule> {
  constructor(private readonly rules: SalaryRuleRepositoryPort) {}

  async execute({ actor, id, data }: UpdateSalaryRuleInput): Promise<Result<SalaryRule>> {
    const allowed = authorize(actor, 'salary_rule', 'update')
    if (!allowed.ok) return allowed

    const current = await this.rules.findById(id)
    if (!current) {
      return Err(DomainError.notFound('RULE_NOT_FOUND', 'That salary rule no longer exists.'))
    }

    
    
    const merged = attempt(() => createSalaryRule({ ...current, ...data, id }))
    if (!merged.ok) return merged

    if (merged.value.code !== current.code) {
      const clash = await this.rules.findByCode(merged.value.code)
      if (clash && clash.id !== id) {
        return Err(
          DomainError.conflict(
            'RULE_CODE_TAKEN',
            `Another salary rule already uses the code "${merged.value.code}".`,
            { code: merged.value.code },
          ),
        )
      }
    }

    const updated = await this.rules.update(id, merged.value)
    if (!updated) {
      return Err(DomainError.notFound('RULE_NOT_FOUND', 'That salary rule no longer exists.'))
    }
    return Ok(updated)
  }
}
