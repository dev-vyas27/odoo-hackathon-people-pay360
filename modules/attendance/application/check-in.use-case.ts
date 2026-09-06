/**
 * CheckInUseCase — an employee (or an HR user on their behalf) starts an
 * attendance record for the day.
 *
 * Authorization: check-in is the employee's own self-service action, so it is
 * authorized as `attendance:create` (row-scoped to the employee's own id),
 * the same permission the spec grants an `employee` role. Correcting a
 * record afterwards is a different action (`update`) and is deliberately not
 * reachable from here — see correct-attendance.use-case.ts.
 */
import {
  authorizeOwned,
  DomainError,
  Err,
  istDay,
  Ok,
  type Actor,
  type Result,
} from '@/modules/shared'
import { Attendance } from '../domain/attendance'
import type { WorkMode } from '../domain/work-mode'
import type { AttendanceRepositoryPort } from './ports/attendance-repository.port'
import type { ScheduleLookupPort } from './ports/schedule-lookup.port'
import type { AttendanceStatus } from '../domain/exception'

export interface CheckInInput {
  actor: Actor
  employeeId: string
  checkIn?: Date
  breakMinutes?: number
  /** Where they are working this shift. Asked at the moment of clocking in. */
  workMode?: WorkMode | null
}

export interface CheckInOutput {
  attendance: Attendance
  status: AttendanceStatus
}

export class CheckInUseCase {
  constructor(
    private readonly repo: AttendanceRepositoryPort,
    private readonly schedules: ScheduleLookupPort,
  ) {}

  async execute(input: CheckInInput): Promise<Result<CheckInOutput>> {
    const authz = authorizeOwned(input.actor, 'attendance', 'create', input.employeeId)
    if (!authz.ok) return authz

    const checkIn = input.checkIn ?? new Date()
    const today = new Date(`${istDay(checkIn)}T00:00:00.000Z`)

    /**
     * Close anything left open on an earlier day BEFORE looking for a clash.
     *
     * Without this, one forgotten check-out locks the employee out of the
     * feature permanently: every subsequent check-in is refused as
     * ALREADY_CHECKED_IN against a shift from a week ago, and the only way out
     * is an HR correction.
     */
    await this.repo.closeStaleOpenShifts(today)

    const existing = await this.repo.findForEmployeeOnDay(input.employeeId, today)

    /**
     * Already clocked in today and still open — nothing to do, and saying so is
     * better than silently starting the clock again.
     */
    if (existing && existing.attendance.isOpen) {
      return Err(
        DomainError.conflict(
          'ALREADY_CHECKED_IN',
          'You are already checked in. Check out before checking in again.',
        ),
      )
    }

    /**
     * Been in today and checked out — this is a return from lunch, not a new
     * day. The aggregate reopens the same record and turns the time away into
     * break minutes. See `Attendance.resume`.
     */
    const next = existing
      ? existing.attendance.resume(checkIn, input.workMode ?? null)
      : Attendance.checkIn({
          employeeId: input.employeeId,
          checkIn,
          breakMinutes: input.breakMinutes,
          workMode: input.workMode ?? null,
        })
    if (!next.ok) return next

    const schedule = await this.schedules.scheduleForDay(input.employeeId, checkIn)
    const status = next.value.status(schedule)
    const saved = await this.repo.save(next.value, status)

    return Ok({ attendance: saved, status })
  }
}
