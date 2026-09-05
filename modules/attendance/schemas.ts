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
