import {
  authorize,
  DomainError,
  Err,
  Ok,
  type Actor,
  type Result,
  type UseCase,
} from '@/modules/shared'
import type { SalaryStructure } from '../domain/salary-structure'
import type { SalaryStructureRepositoryPort } from './ports/salary-structure-repository.port'

export interface ArchiveSalaryStructureInput {
  actor: Actor
  id: string
}



export class ArchiveSalaryStructureUseCase
  implements UseCase<ArchiveSalaryStructureInput, SalaryStructure>
{
  constructor(private readonly structures: SalaryStructureRepositoryPort) {}

  async execute({ actor, id }: ArchiveSalaryStructureInput): Promise<Result<SalaryStructure>> {
    const allowed = authorize(actor, 'salary_structure', 'delete')
    if (!allowed.ok) return allowed

    const archived = await this.structures.update(id, { active: false })
    if (!archived) {
      return Err(
        DomainError.notFound('STRUCTURE_NOT_FOUND', 'That salary structure no longer exists.'),
      )
    }
    return Ok(archived)
  }
}
