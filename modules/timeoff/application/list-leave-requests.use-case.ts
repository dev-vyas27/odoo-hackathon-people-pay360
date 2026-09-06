


import {
  Ok,
  authorize,
  paged,
  scopeToSelf,
  type Actor,
  type LeaveStatus,
  type LeaveUnit,
  type PageQuery,
  type Paged,
  type Result,
  type UseCase,
} from '@/modules/shared'
import type { UnitOfWorkPort } from './ports/unit-of-work.port'
import type { EmployeeLookupPort } from './ports/employee-lookup.port'


export interface LeaveRequestListItem {
  id: string
  employeeId: string
  employeeName: string
  timeOffTypeId: string
  timeOffTypeName: string
  start: string
  end: string
  unit: LeaveUnit
  duration: number
  status: LeaveStatus
  reason: string | null
  allocationId: string | null
  decidedAt: string | null
}

export interface ListLeaveRequestsInput {
  actor: Actor
  query: PageQuery
}

export class ListLeaveRequestsUseCase
  implements UseCase<ListLeaveRequestsInput, Paged<LeaveRequestListItem>>
{
  constructor(
    private readonly uow: UnitOfWorkPort,
    private readonly employees: EmployeeLookupPort,
  ) {}

  async execute(input: ListLeaveRequestsInput): Promise<Result<Paged<LeaveRequestListItem>>> {
    const allowed = authorize(input.actor, 'leave_request', 'read')
    if (!allowed.ok) return allowed

    const query = scopedQuery(input.actor, input.query)
    const page = await this.uow.repos.requests.findMany(query)

    const items = await this.decorate(page.items)
    return Ok(paged(items, page.total, page.page, page.limit))
  }

  private async decorate(
    requests: Awaited<ReturnType<UnitOfWorkPort['repos']['requests']['findMany']>>['items'],
  ): Promise<LeaveRequestListItem[]> {
    if (requests.length === 0) return []

    
    const [employees, types] = await Promise.all([
      this.employees.findManyByIds([...new Set(requests.map((r) => r.employeeId))]),
      this.uow.repos.types.findAll(),
    ])

    const employeeNames = new Map(employees.map((e) => [e.id, e.name]))
    const typeNames = new Map(types.map((t) => [t.id, t.name]))

    return requests.map((request) => {
      const view = request.toView()
      return {
        ...view,
        employeeName: employeeNames.get(request.employeeId) ?? 'Unknown employee',
        timeOffTypeName: typeNames.get(request.timeOffTypeId) ?? 'Unknown type',
      }
    })
  }
}



export function scopedQuery(actor: Actor, query: PageQuery): PageQuery {
  if (!scopeToSelf(actor.role)) return query

  return {
    ...query,
    filters: {
      ...query.filters,
      
      
      
      employeeId: actor.employeeId ?? '00000000-0000-4000-8000-000000000000',
    },
  }
}
