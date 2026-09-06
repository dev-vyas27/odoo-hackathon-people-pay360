/**
 * ListAttendanceUseCase — paged, filterable by employee/date range/status.
 *
 * Row-level access: an `employee` role sees only their own attendance. We do
 * not trust a client-supplied `employeeId` filter for that role — it is
 * always overridden to the actor's own id, the same rule `authorizeOwned`
 * expresses everywhere else in this module.
 */
import { authorize, Ok, scopeToSelf, type Actor, type PageQuery, type Paged, type Result } from '@/modules/shared'
import type {
  AttendanceFilter,
  AttendanceRecord,
  AttendanceRepositoryPort,
} from './ports/attendance-repository.port'

export interface ListAttendanceInput {
  actor: Actor
  filter: AttendanceFilter
  page: PageQuery
}

export class ListAttendanceUseCase {
  constructor(private readonly repo: AttendanceRepositoryPort) {}

  async execute(input: ListAttendanceInput): Promise<Result<Paged<AttendanceRecord>>> {
    const authz = authorize(input.actor, 'attendance', 'read')
    if (!authz.ok) return authz

    const filter: AttendanceFilter = { ...input.filter }
    if (scopeToSelf(input.actor.role)) {
      filter.employeeId = input.actor.employeeId ?? '__none__'
    }

    const page = await this.repo.findMany(filter, input.page)
    return Ok(page)
  }
}
