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
import type { SalaryStructureRepositoryPort } from './ports/salary-structure-repository.port'

export interface ArchiveSalaryRuleInput {
  actor: Actor
  id: string
}



export class ArchiveSalaryRuleUseCase implements UseCase<ArchiveSalaryRuleInput, SalaryRule> {
  constructor(
    private readonly rules: SalaryRuleRepositoryPort,
    private readonly structures: SalaryStructureRepositoryPort,
  ) {}

  async execute({ actor, id }: ArchiveSalaryRuleInput): Promise<Result<SalaryRule>> {
    const allowed = authorize(actor, 'salary_rule', 'delete')
    if (!allowed.ok) return allowed

    const rule = await this.rules.findById(id)
    if (!rule) {
      return Err(DomainError.notFound('RULE_NOT_FOUND', 'That salary rule no longer exists.'))
    }

    const usedBy = (await this.structures.findByRuleId(id)).filter((s) => s.active)
    if (usedBy.length) {
      return Err(
        DomainError.conflict(
          'RULE_IN_USE',
          `"${rule.name}" is still part of ${usedBy.map((s) => `"${s.name}"`).join(', ')}. Remove it from those structures first.`,
          { structures: usedBy.map((s) => ({ id: s.id, name: s.name })) },
        ),
      )
    }

    const archived = await this.rules.update(id, { active: false })
    if (!archived) {
      return Err(DomainError.notFound('RULE_NOT_FOUND', 'That salary rule no longer exists.'))
    }
    return Ok(archived)
  }
}
