/**
 * Client-safe surface of `attendance`.
 *
 * See modules/people/schemas.ts for why this file exists.
 */
export {
  ATTENDANCE_STATUSES,
  checkInSchema,
  checkOutSchema,
  correctAttendanceSchema,
  listAttendanceQuerySchema,
  type CheckInBody,
  type CheckOutBody,
  type CorrectAttendanceBody,
  type ListAttendanceQuery,
} from './interface/attendance.schema'

/**
 * Work mode is a pure value object — no database, no adapters — so it belongs
 * on the client barrel too. The check-in dialog needs the labels, and reaching
 * for `@/modules/attendance` to get them would pull the Postgres repository
 * (and therefore `pg`) into a browser bundle.
 */
export {
  WORK_MODES,
  WORK_MODE_LABELS,
  isWorkMode,
  type WorkMode,
} from './domain/work-mode'

/** The clock widget's state. See application/get-today-attendance.use-case.ts. */
export interface TodayAttendanceView {
  day: string
  now: string
  state: 'not_started' | 'checked_in' | 'checked_out'
  attendanceId: string | null
  checkedInAt: string | null
  checkedOutAt: string | null
  workMode: 'office' | 'home' | 'other' | null
  breakMinutes: number
  workedMinutes: number
}

export interface AttendanceListItem {
  id: string
  employeeId: string
  checkIn: string
  checkOut: string | null
  breakMinutes: number
  workedHours: number | null
  status: 'present' | 'late' | 'absent' | 'overtime' | 'missing_checkout' | 'manual'
  manual: boolean
}
