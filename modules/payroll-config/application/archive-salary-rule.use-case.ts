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

/**
 * Rules are archived, never deleted.
 *
 * Historical payslips are a record of what an employee was actually paid and
 * they name the rules that produced each line. Hard-deleting a rule would leave
 * that history unexplainable, so `active: false` is the strongest thing a user
 * can do — and even that is refused while a live structure still includes it,
 * because silently dropping a line from the next payrun is worse than an error.
 */
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
