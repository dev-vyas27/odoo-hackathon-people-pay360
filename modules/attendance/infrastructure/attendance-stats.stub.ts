/**
 * Temporary stub for AttendanceStatsPort.
 *
 * Lets Dev C compute payslips (Worked Days) and Dev A build dashboard cards
 * before attendance persistence exists. Replaced in Phase 3, then deleted.
 */
import type {
  AttendanceStatsPort,
  AttendanceSummary,
} from '../application/ports/attendance-stats.port'

function pending(method: string): never {
  throw new Error(
    `AttendanceStatsPort.${method}() is not implemented yet (owner: Dev B, attendance module). ` +
      `Expected in Phase 3. If you need it sooner, ask rather than working around it.`,
  )
}

export class StubAttendanceStats implements AttendanceStatsPort {
  async workedHours(): Promise<number> {
    return pending('workedHours')
  }

  async workedDays(): Promise<number> {
    return pending('workedDays')
  }

  async workedDaysForMany(): Promise<Map<string, number>> {
    return pending('workedDaysForMany')
  }

  async summary(): Promise<AttendanceSummary> {
    return pending('summary')
  }
}
