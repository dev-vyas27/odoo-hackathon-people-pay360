/**
 * Repository port for the Attendance aggregate.
 *
 * Deliberately narrower than the generic `IRepository` from the shared kernel:
 * attendance is never "updated" with a partial bag of fields — it is
 * checked-out or corrected, both of which produce a whole new `Attendance`
 * instance via the aggregate's own methods. The port only moves that instance
 * in and out of storage.
 */
import type { Paged, PageQuery } from '@/modules/shared'
import type { Attendance } from '../../domain/attendance'
import type { AttendanceStatus } from '../../domain/exception'

export interface AttendanceFilter {
  employeeId?: string
  /** Inclusive day range, compared against checkIn. */
  from?: Date
  to?: Date
  status?: AttendanceStatus
}

export interface AttendanceRepositoryPort {
  findById(id: string): Promise<Attendance | null>
  /** The employee's most recent open (no check-out yet) record, if any. */
  findOpenForEmployee(employeeId: string): Promise<Attendance | null>
  /**
   * Persist the aggregate. `status` is supplied by the use case (which has
   * already resolved the employee's schedule) and stored alongside so that
   * `findMany` can filter by status without recomputing it per row.
   */
  save(attendance: Attendance, status: AttendanceStatus): Promise<Attendance>
  findMany(filter: AttendanceFilter, page: PageQuery): Promise<Paged<Attendance>>
  deleteById(id: string): Promise<boolean>
}
