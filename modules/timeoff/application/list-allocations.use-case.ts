


import {
  Ok,
  authorize,
  paged,
  type Actor,
  type LeaveUnit,
  type PageQuery,
  type Paged,
  type Result,
  type UseCase,
} from '@/modules/shared'
import type { AllocationStatus } from '../domain/allocation'
import type { UnitOfWorkPort } from './ports/unit-of-work.port'
import type { EmployeeLookupPort } from './ports/employee-lookup.port'
import { scopedQuery } from './list-leave-requests.use-case'

export interface AllocationListItem {
  id: string
  employeeId: string
  employeeName: string
  timeOffTypeId: string
  timeOffTypeName: string
  unit: LeaveUnit
  allocated: number
  taken: number
  remaining: number
  validFrom: string
  validTo: string
  status: AllocationStatus
  
  note?: string | null
}

export interface ListAllocationsInput {
  actor: Actor
  query: PageQuery
}

export class ListAllocationsUseCase
  implements UseCase<ListAllocationsInput, Paged<AllocationListItem>>
{
  constructor(
    private readonly uow: UnitOfWorkPort,
    private readonly employees: EmployeeLookupPort,
  ) {}

  async execute(input: ListAllocationsInput): Promise<Result<Paged<AllocationListItem>>> {
    const allowed = authorize(input.actor, 'allocation', 'read')
    if (!allowed.ok) return allowed

    const page = await this.uow.repos.allocations.findMany(scopedQuery(input.actor, input.query))

    if (page.items.length === 0) {
      return Ok(paged([], page.total, page.page, page.limit))
    }

    const [employees, types] = await Promise.all([
      this.employees.findManyByIds([...new Set(page.items.map((a) => a.employeeId))]),
      this.uow.repos.types.findAll(),
    ])

    const employeeNames = new Map(employees.map((e) => [e.id, e.name]))
    const typeNames = new Map(types.map((t) => [t.id, t.name]))

    const items = page.items.map((allocation) => ({
      ...allocation.toView(),
      employeeName: employeeNames.get(allocation.employeeId) ?? 'Unknown employee',
      timeOffTypeName: typeNames.get(allocation.timeOffTypeId) ?? 'Unknown type',
    }))

    return Ok(paged(items, page.total, page.page, page.limit))
  }
}
