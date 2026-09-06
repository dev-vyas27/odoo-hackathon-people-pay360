

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
