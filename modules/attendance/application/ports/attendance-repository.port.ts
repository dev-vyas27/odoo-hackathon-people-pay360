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

/**
 * A stored record as the list path needs it: the aggregate plus the status that
 * was persisted beside it.
 *
 * `Attendance` cannot derive `late` or `overtime` on its own — that needs the
 * employee's schedule, which `save` had and a list query does not. Returning
 * the stored value keeps the list honest without re-resolving a schedule per
 * row, which is what the note on `save` below always intended.
 */
export interface AttendanceRecord {
  attendance: Attendance
  status: AttendanceStatus
}

export interface AttendanceRepositoryPort {
  /**
   * Returns the RECORD, not the bare aggregate — same reason as `findMany`.
   * `late` and `overtime` cannot be derived without the employee's schedule,
   * which only `save` had; the stored status is the honest answer, and a
   * caller that only wants the aggregate reads `.attendance`.
   */
  findById(id: string): Promise<AttendanceRecord | null>
  /** The employee's most recent open (no check-out yet) record, if any. */
  findOpenForEmployee(employeeId: string): Promise<Attendance | null>
  /**
   * The record for one employee on one IST day, open or closed.
   *
   * Distinct from `findOpenForEmployee` because resuming after lunch means
   * finding a CLOSED record — an open-only lookup returns nothing at exactly
   * the moment the answer matters.
   */
  findForEmployeeOnDay(employeeId: string, workedOn: Date): Promise<AttendanceRecord | null>
  /**
   * Close shifts still open on a day that has already ended, at 23:59:59 of
   * that day. Returns how many were closed. See the implementation for why
   * this is lazy rather than scheduled.
   */
  closeStaleOpenShifts(before: Date): Promise<number>
  /**
   * Persist the aggregate. `status` is supplied by the use case (which has
   * already resolved the employee's schedule) and stored alongside so that
   * `findMany` can filter by status without recomputing it per row.
   */
  save(attendance: Attendance, status: AttendanceStatus): Promise<Attendance>
  findMany(filter: AttendanceFilter, page: PageQuery): Promise<Paged<AttendanceRecord>>
  deleteById(id: string): Promise<boolean>
}
