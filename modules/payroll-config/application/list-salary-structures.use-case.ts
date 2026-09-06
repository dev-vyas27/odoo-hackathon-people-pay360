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


export interface SalaryStructureListItem {
  id: string
  name: string
  code: string
  ruleCount: number
  
  employeeCount: number
  active: boolean
}


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

    
    const counts = await this.employeeCounts.countByStructure(page.items.map((s) => s.id))

    return Ok({
      ...page,
      items: page.items.map((structure) => ({
        id: structure.id,
        name: structure.name,
        code: structure.code,
        
        
        ruleCount: structure.rules.length,
        employeeCount: counts.get(structure.id) ?? 0,
        active: structure.active,
      })),
    })
  }
}
