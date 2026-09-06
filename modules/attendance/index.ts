


import { providePort, PORT_KEYS, type AttendanceStatsPort } from '@/modules/shared'
import { PostgresAttendanceStats } from './infrastructure/attendance-stats.adapter'


export { deriveStatus, type AttendanceStatus, type DailySchedule } from './domain/exception'
export { computeWorkedHours } from './domain/worked-hours.service'
export { Attendance } from './domain/attendance'
export { WORK_MODES, WORK_MODE_LABELS, type WorkMode } from './domain/work-mode'


export * from './interface/attendance.schema'


export { PostgresAttendanceRepository } from './infrastructure/postgres-attendance.repository'
export { PostgresAttendanceStats } from './infrastructure/attendance-stats.adapter'


export function registerAttendance(): void {
  providePort<AttendanceStatsPort>(
    PORT_KEYS.attendanceStats,
    () => new PostgresAttendanceStats(),
  )
}

export function createAttendanceStats(): AttendanceStatsPort {
  return new PostgresAttendanceStats()
}


import { resolve } from '@/modules/shared'
import { PostgresAttendanceRepository } from './infrastructure/postgres-attendance.repository'
import { EmployeeDirectoryAdapter } from './infrastructure/employee-directory.adapter'
import { ScheduleLookupAdapter } from './infrastructure/schedule-lookup.adapter'
import type { AttendanceRepositoryPort } from './application/ports/attendance-repository.port'
import type { ScheduleLookupPort } from './application/ports/schedule-lookup.port'
import { CheckInUseCase } from './application/check-in.use-case'
import { CheckOutUseCase } from './application/check-out.use-case'
import { CorrectAttendanceUseCase } from './application/correct-attendance.use-case'
import { ListAttendanceUseCase } from './application/list-attendance.use-case'
import { GetAttendanceUseCase } from './application/get-attendance.use-case'
import { GetTodayAttendanceUseCase } from './application/get-today-attendance.use-case'
import { DeleteAttendanceUseCase } from './application/delete-attendance.use-case'



function attendanceRepository(): AttendanceRepositoryPort {
  return resolve('attendance.repository', () => new PostgresAttendanceRepository())
}

function scheduleLookup(): ScheduleLookupPort {
  return resolve('attendance.schedule-lookup', () => {
    const directory = new EmployeeDirectoryAdapter()
    return new ScheduleLookupAdapter((employeeId) => directory.workingScheduleIdFor(employeeId))
  })
}

export function createCheckInUseCase(): CheckInUseCase {
  return new CheckInUseCase(attendanceRepository(), scheduleLookup())
}

export function createCheckOutUseCase(): CheckOutUseCase {
  return new CheckOutUseCase(attendanceRepository(), scheduleLookup())
}

export function createCorrectAttendanceUseCase(): CorrectAttendanceUseCase {
  return new CorrectAttendanceUseCase(attendanceRepository(), scheduleLookup())
}

export function createListAttendanceUseCase(): ListAttendanceUseCase {
  return new ListAttendanceUseCase(attendanceRepository())
}

export function createGetAttendanceUseCase(): GetAttendanceUseCase {
  return new GetAttendanceUseCase(attendanceRepository())
}

export function createGetTodayAttendanceUseCase(): GetTodayAttendanceUseCase {
  return new GetTodayAttendanceUseCase(attendanceRepository())
}

export function createDeleteAttendanceUseCase(): DeleteAttendanceUseCase {
  return new DeleteAttendanceUseCase(attendanceRepository())
}


export { toAttendanceView } from './interface/attendance.view'
export type { TodayAttendance } from './application/get-today-attendance.use-case'
