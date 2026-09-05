/**
 * Postgres implementation of the shared AttendanceStatsPort.
 *
 * Everything here is an aggregate computed by the database. Payroll has no
 * business iterating check-ins, and the dashboard should not pull 60 days of
 * rows to count them in JavaScript.
 *
 * `worked_on` (a date column, unique per employee per day) is what makes these
 * queries simple: "worked days" is a row count, not a date-truncation over
 * timestamps.
 *
 * Department filtering joins `employees` — unlike the Mongo version, the
 * attendances table does not denormalise department_id, and inventing a column
 * is not ours to do.
 */
import { query, queryOne } from '@/lib/db'
import type { AttendanceStatsPort, AttendanceSummary, Period } from '@/modules/shared'
import { ATTENDANCES_TABLE } from './attendance.table'

/** A day counts as worked once it has a check-out; an open record is not yet a day worked. */
const COMPLETED = 'a.checked_out_at IS NOT NULL'

export class PostgresAttendanceStats implements AttendanceStatsPort {
  async workedHours(employeeId: string, period: Period): Promise<number> {
    const row = await queryOne<{ total: number }>(
      `SELECT COALESCE(SUM(a.worked_hours), 0)::float8 AS total
         FROM "${ATTENDANCES_TABLE}" a
        WHERE a.employee_id = $1
          AND a.worked_on BETWEEN $2::date AND $3::date`,
      [employeeId, period.start, period.end],
    )
    return row?.total ?? 0
  }

  async workedDays(employeeId: string, period: Period): Promise<number> {
    const row = await queryOne<{ days: number }>(
      `SELECT COUNT(DISTINCT a.worked_on)::int AS days
         FROM "${ATTENDANCES_TABLE}" a
        WHERE a.employee_id = $1
          AND a.worked_on BETWEEN $2::date AND $3::date
          AND ${COMPLETED}`,
      [employeeId, period.start, period.end],
    )
    return row?.days ?? 0
  }

  /**
   * ONE query for the whole payrun batch.
   *
   * A 200-employee payrun calling workedDays() in a loop would be 200 round
   * trips to a hosted database — several seconds of a five-minute demo spent
   * waiting. GROUP BY does it in one.
   */
  async workedDaysForMany(employeeIds: string[], period: Period): Promise<Map<string, number>> {
    const result = new Map<string, number>()
    if (employeeIds.length === 0) return result

    const rows = await query<{ employee_id: string; days: number }>(
      `SELECT a.employee_id, COUNT(DISTINCT a.worked_on)::int AS days
         FROM "${ATTENDANCES_TABLE}" a
        WHERE a.employee_id = ANY($1::uuid[])
          AND a.worked_on BETWEEN $2::date AND $3::date
          AND ${COMPLETED}
        GROUP BY a.employee_id`,
      [employeeIds, period.start, period.end],
    )

    for (const row of rows) result.set(row.employee_id, row.days)
    // Employees with no attendance at all are absent from the result set, but
    // callers expect a number for everyone they asked about.
    for (const id of employeeIds) if (!result.has(id)) result.set(id, 0)

    return result
  }

  /**
   * The dashboard's Attendance Overview, as a single pass over the period.
   *
   * FILTER (WHERE ...) gives one conditional count per status without five
   * separate queries or any client-side counting.
   */
  async summary(period: Period, departmentId?: string): Promise<AttendanceSummary> {
    const values: unknown[] = [period.start, period.end]
    let departmentJoin = ''
    let departmentFilter = ''

    if (departmentId) {
      values.push(departmentId)
      departmentJoin = 'JOIN employees e ON e.id = a.employee_id'
      departmentFilter = `AND e.department_id = $${values.length}`
    }

    const row = await queryOne<{
      present: number
      late: number
      absent: number
      overtime_hours: number
      missing_checkouts: number
      manual_edits: number
    }>(
      `SELECT
         COUNT(*) FILTER (WHERE a.status = 'present')::int          AS present,
         COUNT(*) FILTER (WHERE a.status = 'late')::int             AS late,
         COUNT(*) FILTER (WHERE a.status = 'absent')::int           AS absent,
         COALESCE(SUM(a.worked_hours) FILTER (WHERE a.status = 'overtime'), 0)::float8
                                                                    AS overtime_hours,
         COUNT(*) FILTER (WHERE a.status = 'missing_checkout')::int AS missing_checkouts,
         COUNT(*) FILTER (WHERE a.is_manual)::int                   AS manual_edits
       FROM "${ATTENDANCES_TABLE}" a
       ${departmentJoin}
       WHERE a.worked_on BETWEEN $1::date AND $2::date
       ${departmentFilter}`,
      values,
    )

    return {
      present: row?.present ?? 0,
      late: row?.late ?? 0,
      absent: row?.absent ?? 0,
      overtimeHours: row?.overtime_hours ?? 0,
      missingCheckouts: row?.missing_checkouts ?? 0,
      manualEdits: row?.manual_edits ?? 0,
    }
  }
}
