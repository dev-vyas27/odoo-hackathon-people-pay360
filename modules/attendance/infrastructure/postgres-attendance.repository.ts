/**
 * Postgres implementation of AttendanceRepositoryPort.
 *
 * Written by hand rather than extending BaseSqlRepository: the port's shape is
 * its own (`save`, `findOpenForEmployee`, a typed filter) and the status column
 * needs the manual-flag translation on every read and write, which a generic
 * projection cannot express.
 */
import { query, queryOne } from '@/lib/db'
import {
  DomainError,
  normalizePageQuery,
  paged,
  type PageQuery,
  type Paged,
} from '@/modules/shared'
import type {
  AttendanceFilter,
  AttendanceRecord,
  AttendanceRepositoryPort,
} from '../application/ports/attendance-repository.port'
import { Attendance } from '../domain/attendance'
import type { AttendanceStatus } from '../domain/exception'
import {
  ATTENDANCES_TABLE,
  ATTENDANCE_COLUMNS,
  isUniqueViolation,

  toStoredStatus,
  toDomainStatus,
  workedOnFor,
  type AttendanceRow,
} from './attendance.table'

const SELECTION = ATTENDANCE_COLUMNS.map((c) => `"${c}"`).join(', ')

function toDomain(row: AttendanceRow): Attendance {
  return Attendance.reconstitute({
    id: row.id,
    employeeId: row.employee_id,
    // checked_in_at is nullable in the schema (an absence has no check-in) but
    // the domain requires one; worked_on is the honest fallback.
    checkIn: row.checked_in_at ?? row.worked_on,
    checkOut: row.checked_out_at,
    breakMinutes: row.break_minutes,
    workMode: row.work_mode,
    manual: row.is_manual,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })
}

export class PostgresAttendanceRepository implements AttendanceRepositoryPort {
  async findById(id: string): Promise<AttendanceRecord | null> {
    const row = await queryOne<AttendanceRow>(
      `SELECT ${SELECTION} FROM "${ATTENDANCES_TABLE}" WHERE id = $1`,
      [id],
    )
    if (!row) return null
    return { attendance: toDomain(row), status: toDomainStatus(row.status, row.is_manual) }
  }

  /** The employee's outstanding check-in, if any — drives check-out. */
  async findOpenForEmployee(employeeId: string): Promise<Attendance | null> {
    const row = await queryOne<AttendanceRow>(
      `SELECT ${SELECTION} FROM "${ATTENDANCES_TABLE}"
        WHERE employee_id = $1 AND checked_out_at IS NULL
        ORDER BY worked_on DESC LIMIT 1`,
      [employeeId],
    )
    return row ? toDomain(row) : null
  }

  /**
   * The record for one employee on one IST day, open or closed.
   *
   * `findOpenForEmployee` cannot answer this: coming back from lunch means
   * finding a CLOSED record and reopening it, and an open-only lookup returns
   * nothing at exactly the moment the answer matters.
   */
  async findForEmployeeOnDay(employeeId: string, workedOn: Date): Promise<AttendanceRecord | null> {
    const row = await queryOne<AttendanceRow>(
      `SELECT ${SELECTION} FROM "${ATTENDANCES_TABLE}"
        WHERE employee_id = $1 AND worked_on = $2`,
      [employeeId, workedOn],
    )
    if (!row) return null
    return { attendance: toDomain(row), status: toDomainStatus(row.status, row.is_manual) }
  }

  /**
   * Close shifts left open on a day that has already ended.
   *
   * Somebody who forgets to check out would otherwise carry one open record
   * forever: every later check-in would be refused as ALREADY_CHECKED_IN, and
   * their worked hours would never be computable. So an open shift from a past
   * IST day is closed at 23:59:59 of the day it belongs to.
   *
   * Done lazily, on read and before check-in, rather than by a scheduler —
   * there is no job runner in this deployment, and a sweep that only runs when
   * somebody looks is still correct: the value written depends on the shift's
   * own day, never on when the sweep happened to fire.
   *
   * `worked_hours` is recomputed here in SQL rather than round-tripping through
   * the aggregate, because this can touch many employees at once and none of
   * them are the caller.
   */
  async closeStaleOpenShifts(before: Date): Promise<number> {
    const result = await query<{ id: string }>(
      `UPDATE "${ATTENDANCES_TABLE}"
          SET checked_out_at = (worked_on + interval '23 hours 59 minutes 59 seconds'),
              worked_hours = GREATEST(
                0,
                EXTRACT(EPOCH FROM (
                  (worked_on + interval '23 hours 59 minutes 59 seconds') - checked_in_at
                )) / 3600.0 - (break_minutes / 60.0)
              )
        WHERE checked_out_at IS NULL
          AND checked_in_at IS NOT NULL
          AND worked_on < $1::date
        RETURNING id`,
      [before],
    )
    return result.length
  }

  /**
   * Insert or update in one statement.
   *
   * ON CONFLICT turns the UNIQUE (employee_id, worked_on) constraint from an
   * error into the intended behaviour for a same-day re-save, while a genuine
   * duplicate from a different record still surfaces as a domain conflict.
   *
   * `worked_hours` and `status` are denormalised at write time — they were
   * already computed by the use case, and storing them keeps the stats
   * aggregations from re-deriving exception logic per row.
   */
  async save(attendance: Attendance, status: AttendanceStatus): Promise<Attendance> {
    const stored = toStoredStatus(status)
    const workedOn = workedOnFor(attendance.checkIn)
    const hours = attendance.workedHoursOrNull() ?? 0

    const params = [
      attendance.employeeId,
      workedOn,
      attendance.checkIn,
      attendance.checkOut,
      attendance.breakMinutes,
      hours,
      stored.status,
      attendance.workMode,
      stored.isManual || attendance.manual,
    ]

    try {
      if (attendance.id) {
        const row = await queryOne<AttendanceRow>(
          `UPDATE "${ATTENDANCES_TABLE}"
              SET employee_id = $1, worked_on = $2, checked_in_at = $3, checked_out_at = $4,
                  break_minutes = $5, worked_hours = $6, status = $7, work_mode = $8,
                  is_manual = $9
            WHERE id = $10
            RETURNING ${SELECTION}`,
          [...params, attendance.id],
        )
        if (!row) {
          throw DomainError.notFound('ATTENDANCE_NOT_FOUND', 'Attendance record no longer exists')
        }
        return toDomain(row)
      }

      const row = await queryOne<AttendanceRow>(
        `INSERT INTO "${ATTENDANCES_TABLE}"
           (employee_id, worked_on, checked_in_at, checked_out_at,
            break_minutes, worked_hours, status, work_mode, is_manual)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (employee_id, worked_on) DO UPDATE SET
           checked_in_at = EXCLUDED.checked_in_at,
           checked_out_at = EXCLUDED.checked_out_at,
           break_minutes = EXCLUDED.break_minutes,
           worked_hours = EXCLUDED.worked_hours,
           status = EXCLUDED.status,
           work_mode = EXCLUDED.work_mode,
           is_manual = EXCLUDED.is_manual
         RETURNING ${SELECTION}`,
        params,
      )
      return toDomain(row as AttendanceRow)
    } catch (reason) {
      if (isUniqueViolation(reason)) {
        throw DomainError.conflict(
          'ATTENDANCE_ALREADY_EXISTS',
          'This employee already has an attendance record for that day',
        )
      }
      throw reason
    }
  }

  async findMany(filter: AttendanceFilter, pageQuery: PageQuery): Promise<Paged<AttendanceRecord>> {
    const q = normalizePageQuery(pageQuery)
    const conditions: string[] = []
    const values: unknown[] = []

    if (filter.employeeId) {
      values.push(filter.employeeId)
      conditions.push(`employee_id = $${values.length}`)
    }
    if (filter.from) {
      values.push(filter.from)
      conditions.push(`worked_on >= $${values.length}::date`)
    }
    if (filter.to) {
      values.push(filter.to)
      conditions.push(`worked_on <= $${values.length}::date`)
    }
    if (filter.status) {
      // 'manual' is a flag in the table, not a status value.
      if (filter.status === 'manual') {
        conditions.push('is_manual = true')
      } else {
        values.push(filter.status)
        conditions.push(`status = $${values.length} AND is_manual = false`)
      }
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    // Sort column arrives from a query string, so it is chosen from a fixed set
    // rather than interpolated — an identifier cannot be a bind parameter.
    const sortable = new Set(['worked_on', 'created_at', 'status'])
    const sort = q.sort && sortable.has(q.sort) ? q.sort : 'worked_on'
    const direction = q.order === 'asc' ? 'ASC' : 'DESC'

    const [rows, total] = await Promise.all([
      query<AttendanceRow>(
        `SELECT ${SELECTION} FROM "${ATTENDANCES_TABLE}" ${where}
          ORDER BY "${sort}" ${direction}
          LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        [...values, q.limit, (q.page - 1) * q.limit],
      ),
      queryOne<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM "${ATTENDANCES_TABLE}" ${where}`,
        values,
      ),
    ])

    return paged(
      rows.map((row) => ({
        attendance: toDomain(row),
        // is_manual wins, matching deriveStatus's precedence — see attendance.table.ts.
        status: toDomainStatus(row.status, row.is_manual),
      })),
      total?.count ?? 0,
      q.page,
      q.limit,
    )
  }

  async deleteById(id: string): Promise<boolean> {
    const rows = await query<{ id: string }>(
      `DELETE FROM "${ATTENDANCES_TABLE}" WHERE id = $1 RETURNING id`,
      [id],
    )
    return rows.length > 0
  }
}
