


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



export {
  WORK_MODES,
  WORK_MODE_LABELS,
  isWorkMode,
  type WorkMode,
} from './domain/work-mode'


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
