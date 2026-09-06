

import { query, queryOne } from '@/lib/db'
import type { AttendanceStatsPort, AttendanceSummary, Period } from '@/modules/shared'
import { ATTENDANCES_TABLE } from './attendance.table'

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
    
    
    for (const id of employeeIds) if (!result.has(id)) result.set(id, 0)

    return result
  }

  

  async summary(period: Period, departmentId?: string, employeeType?: string): Promise<AttendanceSummary> {
    const values: unknown[] = [period.start, period.end]
    
    
    
    const needsEmployeeJoin = Boolean(departmentId || employeeType)
    const employeeJoin = needsEmployeeJoin ? 'JOIN employees e ON e.id = a.employee_id' : ''
    let extraFilters = ''

    if (departmentId) {
      values.push(departmentId)
      extraFilters += ` AND e.department_id = $${values.length}`
    }
    if (employeeType) {
      values.push(employeeType)
      extraFilters += ` AND e.employee_type = $${values.length}`
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
       ${employeeJoin}
       WHERE a.worked_on BETWEEN $1::date AND $2::date
       ${extraFilters}`,
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
