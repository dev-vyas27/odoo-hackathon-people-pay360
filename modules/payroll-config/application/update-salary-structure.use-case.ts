import {
  authorize,
  DomainError,
  Err,
  Ok,
  type Actor,
  type Result,
  type UseCase,
} from '@/modules/shared'
import {
  createSalaryStructure,
  type SalaryStructure,
  type SalaryStructureInput,
} from '../domain/salary-structure'
import type { SalaryRuleRepositoryPort } from './ports/salary-rule-repository.port'
import type { SalaryStructureRepositoryPort } from './ports/salary-structure-repository.port'
import { attempt } from './attempt'
import { findMissingRuleIds } from './create-salary-structure.use-case'

export interface UpdateSalaryStructureInput {
  actor: Actor
  id: string
  data: Partial<Omit<SalaryStructureInput, 'id'>>
}

export class UpdateSalaryStructureUseCase
  implements UseCase<UpdateSalaryStructureInput, SalaryStructure>
{
  constructor(
    private readonly structures: SalaryStructureRepositoryPort,
    private readonly rules: SalaryRuleRepositoryPort,
  ) {}

  async execute({ actor, id, data }: UpdateSalaryStructureInput): Promise<Result<SalaryStructure>> {
    const allowed = authorize(actor, 'salary_structure', 'update')
    if (!allowed.ok) return allowed

    const current = await this.structures.findById(id)
    if (!current) {
      return Err(
        DomainError.notFound('STRUCTURE_NOT_FOUND', 'That salary structure no longer exists.'),
      )
    }

    const merged = attempt(() =>
      createSalaryStructure({ ...current, rules: [...current.rules], ...data, id }),
    )
    if (!merged.ok) return merged

    const missing = await findMissingRuleIds(this.rules, merged.value.rules.map((r) => r.ruleId))
    if (missing.length) {
      return Err(
        DomainError.validation(
          'STRUCTURE_RULE_MISSING',
          'This structure includes a salary rule that no longer exists.',
          { ruleIds: missing },
        ),
      )
    }

    const updated = await this.structures.update(id, merged.value)
    if (!updated) {
      return Err(
        DomainError.notFound('STRUCTURE_NOT_FOUND', 'That salary structure no longer exists.'),
      )
    }
    return Ok(updated)
  }
}
