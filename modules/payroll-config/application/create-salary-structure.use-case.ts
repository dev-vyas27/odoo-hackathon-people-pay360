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

export interface CreateSalaryStructureInput {
  actor: Actor
  data: Omit<SalaryStructureInput, 'id'>
}

export class CreateSalaryStructureUseCase
  implements UseCase<CreateSalaryStructureInput, SalaryStructure>
{
  constructor(
    private readonly structures: SalaryStructureRepositoryPort,
    private readonly rules: SalaryRuleRepositoryPort,
  ) {}

  async execute({ actor, data }: CreateSalaryStructureInput): Promise<Result<SalaryStructure>> {
    const allowed = authorize(actor, 'salary_structure', 'create')
    if (!allowed.ok) return allowed

    const candidate = attempt(() => createSalaryStructure({ ...data, id: 'pending' }))
    if (!candidate.ok) return candidate

    const missing = await findMissingRuleIds(this.rules, candidate.value.rules.map((r) => r.ruleId))
    if (missing.length) {
      return Err(
        DomainError.validation(
          'STRUCTURE_RULE_MISSING',
          'This structure includes a salary rule that no longer exists.',
          { ruleIds: missing },
        ),
      )
    }

    return Ok(await this.structures.create(candidate.value))
  }
}


export async function findMissingRuleIds(
  rules: SalaryRuleRepositoryPort,
  ruleIds: string[],
): Promise<string[]> {
  if (!ruleIds.length) return []
  const found = await rules.findManyByIds(ruleIds)
  const foundIds = new Set(found.map((r) => r.id))
  return ruleIds.filter((id) => !foundIds.has(id))
}
