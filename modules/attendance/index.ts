/**
 * Public surface of the "attendance" module.
 *
 * Everything other modules (and route handlers under app/) are allowed to
 * use is re-exported HERE and nowhere else. Internals under domain/,
 * application/, infrastructure/ and interface/ are private and the ESLint
 * boundary rule will reject imports that reach in.
 *
 * Owner: see docs/plans/ — do not add exports for another team's module.
 */
import { CheckInUseCase } from './application/check-in.use-case'
import { CheckOutUseCase } from './application/check-out.use-case'
import { CorrectAttendanceUseCase } from './application/correct-attendance.use-case'
import { ListAttendanceUseCase } from './application/list-attendance.use-case'
import { GetAttendanceUseCase } from './application/get-attendance.use-case'
import { DeleteAttendanceUseCase } from './application/delete-attendance.use-case'
import { MongoAttendanceRepository } from './infrastructure/mongo-attendance.repository'
import { ScheduleLookupAdapter } from './infrastructure/schedule-lookup.adapter'
import { EmployeeDirectoryAdapter } from './infrastructure/employee-directory.adapter'
import { AttendanceStatsAdapter } from './infrastructure/attendance-stats.adapter'
import type { AttendanceRepositoryPort } from './application/ports/attendance-repository.port'
import type { ScheduleLookupPort } from './application/ports/schedule-lookup.port'
import type { AttendanceStatsPort } from './application/ports/attendance-stats.port'

// --- Types other modules / route handlers are allowed to see -------------

export type { Attendance } from './domain/attendance'
export type { AttendanceStatus, DailySchedule } from './domain/exception'
export type { AttendanceStatsPort, AttendanceSummary } from './application/ports/attendance-stats.port'
export type { AttendanceFilter, AttendanceRepositoryPort } from './application/ports/attendance-repository.port'
export type { ScheduleLookupPort } from './application/ports/schedule-lookup.port'
export type { EmployeeDirectoryPort } from './application/ports/employee-directory.port'

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

// --- Composition -------------------------------------------------------
//
// Lazily built, cached on globalThis so Next's dev hot-reload does not
// rebuild the graph on every edit (same reasoning as modules/shared/container.ts,
// kept local because that file's `resolve` helper is not part of shared's
// public surface).

interface AttendanceComposition {
  employeeDirectory: EmployeeDirectoryAdapter
  repository: AttendanceRepositoryPort
  scheduleLookup: ScheduleLookupPort
  stats: AttendanceStatsPort
}

declare global {
  var __pp360_attendance: AttendanceComposition | undefined
}

function composition(): AttendanceComposition {
  if (!global.__pp360_attendance) {
    const employeeDirectory = new EmployeeDirectoryAdapter()
    const repository = new MongoAttendanceRepository(employeeDirectory)
    const scheduleLookup = new ScheduleLookupAdapter((employeeId) => employeeDirectory.workingScheduleIdFor(employeeId))
    const stats = new AttendanceStatsAdapter()
    global.__pp360_attendance = { employeeDirectory, repository, scheduleLookup, stats }
  }
  return global.__pp360_attendance
}

function attendanceRepository(): AttendanceRepositoryPort {
  return composition().repository
}

function scheduleLookup(): ScheduleLookupPort {
  return composition().scheduleLookup
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

export function createDeleteAttendanceUseCase(): DeleteAttendanceUseCase {
  return new DeleteAttendanceUseCase(attendanceRepository())
}

/** The real AttendanceStatsPort adapter — payroll's "Worked Days" and the dashboard depend on this. */
export function createAttendanceStats(): AttendanceStatsPort {
  return composition().stats
}
