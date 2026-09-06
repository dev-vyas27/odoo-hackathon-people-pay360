

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
    
    
    workedHours: attendance.workedHoursOrNull(),
    status,
    manual: props.manual,
  }
}
