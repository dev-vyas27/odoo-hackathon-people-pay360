/**
 * GetTodayAttendanceUseCase — what the clock-in widget needs to render.
 *
 * One question: where does this employee stand right now? Checked in, checked
 * out, or not started. The widget cannot answer it from the attendance list,
 * because "today" is an IST day boundary and the list is a paged, filtered view
 * that may not contain today at all.
 *
 * Authorized as `attendance:read`, owned — the same permission that lets
 * somebody see their own attendance rows, since that is exactly what this is.
 *
 * ── Time comes from the server ─────────────────────────────────────────────
 *
 * `now` is included in the response rather than being read from `Date.now()` in
 * the browser. A laptop with a wrong clock would otherwise show a check-in time
 * that disagrees with the one that was actually stored, and the difference
 * would only surface later as an argument about hours worked.
 */
import {
  authorizeOwned,
  istDay,
  minutesBetween,
  Ok,
  type Actor,
  type Result,
} from '@/modules/shared'
import type { AttendanceRepositoryPort } from './ports/attendance-repository.port'
import type { WorkMode } from '../domain/work-mode'

export interface GetTodayAttendanceInput {
  actor: Actor
  employeeId: string
}

export interface TodayAttendance {
  /** The IST day this state describes, `YYYY-MM-DD`. */
  day: string
  /** Server time, ISO. The widget's clock, so it cannot drift from the record. */
  now: string
  state: 'not_started' | 'checked_in' | 'checked_out'
  attendanceId: string | null
  checkedInAt: string | null
  checkedOutAt: string | null
  workMode: WorkMode | null
  breakMinutes: number
  /**
   * Worked minutes so far, break already deducted.
   *
   * Live for an open shift — measured to `now`, so the check-out dialog can
   * state the total before anybody commits to it.
   */
  workedMinutes: number
}

export class GetTodayAttendanceUseCase {
  constructor(private readonly repo: AttendanceRepositoryPort) {}

  async execute(input: GetTodayAttendanceInput): Promise<Result<TodayAttendance>> {
    const authz = authorizeOwned(input.actor, 'attendance', 'read', input.employeeId)
    if (!authz.ok) return authz

    const now = new Date()
    const today = new Date(`${istDay(now)}T00:00:00.000Z`)

    /**
     * Swept on read as well as on check-in.
     *
     * Somebody who forgot to check out last night should open the page today
     * and see a clean slate, not yesterday's shift still running. Doing it here
     * means the correction happens when they look, without waiting for them to
     * press anything.
     */
    await this.repo.closeStaleOpenShifts(today)

    const record = await this.repo.findForEmployeeOnDay(input.employeeId, today)

    if (!record) {
      return Ok({
        day: istDay(now),
        now: now.toISOString(),
        state: 'not_started',
        attendanceId: null,
        checkedInAt: null,
        checkedOutAt: null,
        workMode: null,
        breakMinutes: 0,
        workedMinutes: 0,
      })
    }

    const { attendance } = record
    const open = attendance.isOpen
    const until = attendance.checkOut ?? now

    return Ok({
      day: istDay(now),
      now: now.toISOString(),
      state: open ? 'checked_in' : 'checked_out',
      attendanceId: attendance.id,
      checkedInAt: attendance.checkIn.toISOString(),
      checkedOutAt: attendance.checkOut ? attendance.checkOut.toISOString() : null,
      workMode: attendance.workMode,
      breakMinutes: attendance.breakMinutes,
      workedMinutes: Math.max(
        0,
        minutesBetween(attendance.checkIn, until) - attendance.breakMinutes,
      ),
    })
  }
}
