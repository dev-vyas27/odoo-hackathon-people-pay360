import {
  authorize,
  Ok,
  type Actor,
  type PageQuery,
  type Paged,
  type Result,
  type UseCase,
} from '@/modules/shared'
import type { SalaryStructureRepositoryPort } from './ports/salary-structure-repository.port'

export interface ListSalaryStructuresInput {
  actor: Actor
  query: PageQuery
}

/** The list row the Structures screen renders. */
export interface SalaryStructureListItem {
  id: string
  name: string
  code: string
  ruleCount: number
  active: boolean
}

export class ListSalaryStructuresUseCase
  implements UseCase<ListSalaryStructuresInput, Paged<SalaryStructureListItem>>
{
  constructor(private readonly structures: SalaryStructureRepositoryPort) {}

  async execute({
    actor,
    query,
  }: ListSalaryStructuresInput): Promise<Result<Paged<SalaryStructureListItem>>> {
    const allowed = authorize(actor, 'salary_structure', 'read')
    if (!allowed.ok) return allowed

    const page = await this.structures.findMany(
      query.sort ? query : { ...query, sort: 'name', order: 'asc' },
    )

    return Ok({
      ...page,
      items: page.items.map((structure) => ({
        id: structure.id,
        name: structure.name,
        code: structure.code,
        // Counted here rather than in the UI so the number cannot disagree with
        // what the engine will actually run.
        ruleCount: structure.rules.length,
        active: structure.active,
      })),
    })
  }
}
