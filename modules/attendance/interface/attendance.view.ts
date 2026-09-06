/**
 * The ONE wire shape for an attendance record.
 *
 * Every attendance endpoint returns this — list, get, check-in, check-out and
 * correct alike. That is the whole point: the resource has one shape, and a
 * screen that can read the list can read the detail.
 *
 * It exists because the routes used to return whatever their use case happened
 * to produce. The list gave `Paged<Attendance>` (no `status`, no
 * `workedHours`), the detail gave the bare aggregate, and check-out gave
 * `{ attendance, status }`. Each broke a different part of the UI in the same
 * way — `StatusBadge` calling `.replace()` on `undefined` — and each was fixed
 * separately until this file made it one problem instead of four.
 *
 * A use case's return type is a convenience for the application layer. It is
 * not a wire format, and the boundary is where the two meet.
 */
import type { Attendance } from '../domain/attendance'
import type { AttendanceStatus } from '../domain/exception'
import type { AttendanceListItem } from '../schemas'

export function toAttendanceView(
  attendance: Attendance,
  status: AttendanceStatus,
): AttendanceListItem {
  const props = attendance.toProps()
  return {
    id: props.id,
    employeeId: props.employeeId,
    checkIn: props.checkIn.toISOString(),
    checkOut: props.checkOut ? props.checkOut.toISOString() : null,
    breakMinutes: props.breakMinutes,
    // Null until they check out — the screen renders a dash rather than a zero,
    // because zero hours and "still clocked in" are not the same thing.
    workedHours: attendance.workedHoursOrNull(),
    status,
    manual: props.manual,
  }
}
