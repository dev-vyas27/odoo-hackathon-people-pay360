/**
 * Public surface of the "attendance" module.  ·  Owner: Dev B
 *
 * Exposes aggregates only — never raw attendance records. Payroll has no
 * business iterating check-ins, and the dashboard should not count rows client
 * side.
 *
 * Consumers today: payroll-processing (Dev C), analytics (Dev A).
 */

// --- Published port ---------------------------------------------------------
export type {
  AttendanceStatsPort,
  AttendanceSummary,
} from './application/ports/attendance-stats.port'

// --- Implementation selection ----------------------------------------------
import { StubAttendanceStats } from './infrastructure/attendance-stats.stub'
import type { AttendanceStatsPort } from './application/ports/attendance-stats.port'

export function createAttendanceStats(): AttendanceStatsPort {
  return new StubAttendanceStats()
}
