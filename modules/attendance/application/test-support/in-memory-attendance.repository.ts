/**
 * In-memory fake of AttendanceRepositoryPort for use-case tests.
 *
 * Never used outside tests — no database, no mongoose, matches the project
 * rule that use cases are tested against hand-written fakes.
 */
import type { Paged, PageQuery } from '@/modules/shared'
import { paged } from '@/modules/shared'
import { Attendance } from '../../domain/attendance'
import type {
  AttendanceFilter,
  AttendanceRecord,
  AttendanceRepositoryPort,
} from '../ports/attendance-repository.port'
import type { AttendanceStatus } from '../../domain/exception'

interface Row {
  attendance: Attendance
  status: AttendanceStatus
}

let nextId = 1

export class InMemoryAttendanceRepository implements AttendanceRepositoryPort {
  private rows = new Map<string, Row>()

  async findById(id: string): Promise<Attendance | null> {
    return this.rows.get(id)?.attendance ?? null
  }

  async findOpenForEmployee(employeeId: string): Promise<Attendance | null> {
    for (const row of this.rows.values()) {
      if (row.attendance.employeeId === employeeId && !row.attendance.checkOut) {
        return row.attendance
      }
    }
    return null
  }

  async save(attendance: Attendance, status: AttendanceStatus): Promise<Attendance> {
    const props = attendance.toProps()
    const id = props.id || `att-${nextId++}`
    const withId = Attendance.reconstitute({ ...props, id })
    this.rows.set(id, { attendance: withId, status })
    return withId
  }

  async findMany(filter: AttendanceFilter, page: PageQuery): Promise<Paged<AttendanceRecord>> {
    let items = [...this.rows.values()]
    if (filter.employeeId) items = items.filter((r) => r.attendance.employeeId === filter.employeeId)
    if (filter.status) items = items.filter((r) => r.status === filter.status)
    if (filter.from) items = items.filter((r) => r.attendance.checkIn.getTime() >= filter.from!.getTime())
    if (filter.to) items = items.filter((r) => r.attendance.checkIn.getTime() <= filter.to!.getTime())

    const pageNum = page.page ?? 1
    const limit = page.limit ?? 20
    const start = (pageNum - 1) * limit
    const slice = items.slice(start, start + limit)
    return paged(slice, items.length, pageNum, limit)
  }

  async deleteById(id: string): Promise<boolean> {
    return this.rows.delete(id)
  }

  clear() {
    this.rows.clear()
  }
}
