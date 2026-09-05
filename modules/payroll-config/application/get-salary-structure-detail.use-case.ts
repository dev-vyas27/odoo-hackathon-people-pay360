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
import {
  inspectStructure,
  resolveStructure,
  type SalaryStructure,
  type StructureIssue,
} from '../domain/salary-structure'
import type { SalaryRuleRepositoryPort } from './ports/salary-rule-repository.port'
import type { SalaryStructureRepositoryPort } from './ports/salary-structure-repository.port'
import { attempt } from './attempt'

export interface GetSalaryStructureDetailInput {
  actor: Actor
  id: string
}

export interface SalaryStructureDetail {
  structure: SalaryStructure
  rules: Array<{ rule: SalaryRule; sequence: number }>
  /**
   * Ordering problems found by static analysis — a rule referencing something
   * that runs later, or a code that is not in the structure at all. Surfaced in
   * the form so they are fixed there rather than mid-payrun.
   */
  issues: StructureIssue[]
}

export class GetSalaryStructureDetailUseCase
  implements UseCase<GetSalaryStructureDetailInput, SalaryStructureDetail>
{
  constructor(
    private readonly structures: SalaryStructureRepositoryPort,
    private readonly rules: SalaryRuleRepositoryPort,
  ) {}

  async execute({
    actor,
    id,
  }: GetSalaryStructureDetailInput): Promise<Result<SalaryStructureDetail>> {
    const allowed = authorize(actor, 'salary_structure', 'read')
    if (!allowed.ok) return allowed

    const structure = await this.structures.findById(id)
    if (!structure) {
      return Err(
        DomainError.notFound('STRUCTURE_NOT_FOUND', 'That salary structure no longer exists.'),
      )
    }

    const rules = await this.rules.findManyByIds(structure.rules.map((r) => r.ruleId))
    const byId = new Map(rules.map((r) => [r.id, r]))

    const resolved = attempt(() => resolveStructure(structure, byId))
    if (!resolved.ok) return resolved

    return Ok({
      structure,
      rules: [...resolved.value.rules],
      issues: inspectStructure(resolved.value),
    })
  }
}
