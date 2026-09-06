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
import type { StructureEmployeeCountPort } from './ports/structure-employee-count.port'

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
  /** Distinct employees whose currently active contract references this structure. See StructureEmployeeCountPort. */
  employeeCount: number
  active: boolean
}

/** Degrades to zero counts for callers that only need ruleCount/active and predate this port. */
const NO_EMPLOYEE_COUNTS: StructureEmployeeCountPort = {
  async countByStructure() {
    return new Map()
  },
}

export class ListSalaryStructuresUseCase
  implements UseCase<ListSalaryStructuresInput, Paged<SalaryStructureListItem>>
{
  constructor(
    private readonly structures: SalaryStructureRepositoryPort,
    private readonly employeeCounts: StructureEmployeeCountPort = NO_EMPLOYEE_COUNTS,
  ) {}

  async execute({
    actor,
    query,
  }: ListSalaryStructuresInput): Promise<Result<Paged<SalaryStructureListItem>>> {
    const allowed = authorize(actor, 'salary_structure', 'read')
    if (!allowed.ok) return allowed

    const page = await this.structures.findMany(
      query.sort ? query : { ...query, sort: 'name', order: 'asc' },
    )

    // One batched query for the whole page rather than one per structure.
    const counts = await this.employeeCounts.countByStructure(page.items.map((s) => s.id))

    return Ok({
      ...page,
      items: page.items.map((structure) => ({
        id: structure.id,
        name: structure.name,
        code: structure.code,
        // Counted here rather than in the UI so the number cannot disagree with
        // what the engine will actually run.
        ruleCount: structure.rules.length,
        employeeCount: counts.get(structure.id) ?? 0,
        active: structure.active,
      })),
    })
  }
}
