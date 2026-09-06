/**
 * The `attendances` table as TypeScript sees it.
 * Schema source of truth: migrations/0007_attendance.sql.
 *
 * THE IMPORTANT MISMATCH — read before touching status handling:
 *
 * Our domain treats `manual` as an AttendanceStatus with the highest
 * precedence: a corrected record reports as 'manual' whatever the numbers say.
 * The table cannot store that. Its CHECK constraint allows only
 * ('present','late','absent','overtime','missing_checkout') and records
 * correction separately in the `is_manual` boolean.
 *
 * So the mapping is:
 *   write:  status 'manual'  ->  is_manual = true, status = 'present'
 *   read:   is_manual = true ->  status 'manual'
 *
 * The round trip preserves domain behaviour exactly, and `is_manual` remains
 * the source of truth for the dashboard's "manual edits" count. The schema is
 * owned by the platform developer; this is us conforming to it, not a
 * workaround to be tidied away.
 */
import type { AttendanceStatus } from '../domain/exception'
import { istDay } from '@/modules/shared'
import type { WorkMode } from '../domain/work-mode'

/** The statuses the column will actually accept. */
export type StorableStatus = Exclude<AttendanceStatus, 'manual'>

export const STORABLE_STATUSES: readonly StorableStatus[] = [
  'present',
  'late',
  'absent',
  'overtime',
  'missing_checkout',
]

export interface AttendanceRow {
  id: string
  employee_id: string
  worked_on: Date
  checked_in_at: Date | null
  checked_out_at: Date | null
  break_minutes: number
  work_mode: WorkMode | null
  worked_hours: number
  status: StorableStatus
  is_manual: boolean
  created_at: Date
  updated_at: Date
}

export const ATTENDANCES_TABLE = 'attendances'
export const ATTENDANCE_COLUMNS = [
  'id',
  'employee_id',
  'worked_on',
  'checked_in_at',
  'checked_out_at',
  'break_minutes',
  'worked_hours',
  'status',
  'work_mode',
  'is_manual',
  'created_at',
  'updated_at',
] as const

/** Domain status -> what the column can hold, plus the manual flag. */
export function toStoredStatus(status: AttendanceStatus): {
  status: StorableStatus
  isManual: boolean
} {
  if (status === 'manual') return { status: 'present', isManual: true }
  return { status, isManual: false }
}

/** Column + flag -> domain status. Manual wins, matching deriveStatus's precedence. */
export function toDomainStatus(status: StorableStatus, isManual: boolean): AttendanceStatus {
  return isManual ? 'manual' : status
}

/**
 * The calendar day a check-in belongs to, in UTC.
 *
 * `worked_on` carries the UNIQUE (employee_id, worked_on) constraint, so this
 * function decides what "one record per day" means. Period is UTC day-granular
 * throughout the app, so this matches.
 */
export function workedOnFor(checkIn: Date): Date {
  /**
   * The IST day, not the UTC one.
   *
   * The company works to an Indian clock, so a shift starting at 02:00 IST
   * belongs to that morning — but 02:00 IST is 20:30 UTC the PREVIOUS day, so
   * a UTC-derived value filed it against yesterday. That also put the
   * auto-close boundary in the wrong place: an evening shift would be treated
   * as stale and closed while the person was still working.
   */
  return new Date(`${istDay(checkIn)}T00:00:00.000Z`)
}

/** Postgres unique_violation — surfaced as a domain conflict, never a 500. */
export function isUniqueViolation(reason: unknown): boolean {
  return (
    typeof reason === 'object' &&
    reason !== null &&
    'code' in reason &&
    (reason as { code?: string }).code === '23505'
  )
}
