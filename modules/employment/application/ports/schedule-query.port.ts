/**
 * ScheduleQueryPort — working-schedule facts other modules need.
 *
 * PUBLISHED BY: employment (Dev B)
 * CONSUMED BY:  payroll-processing (Dev C, proration), attendance (exception
 *               detection), analytics (Dev A, attendance coverage)
 *
 * `expectedHours` is what makes proration honest: a payslip for a part-time
 * employee must be measured against that employee's own schedule, not against
 * an assumed 40-hour week.
 */
import type { Period } from '@/modules/shared'

/** 0 = Sunday ... 6 = Saturday, matching JavaScript's getUTCDay(). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface ScheduleDay {
  day: Weekday
  /** "HH:mm", 24-hour. */
  start: string
  end: string
  breakMinutes: number
}

export interface ScheduleSnapshot {
  id: string
  name: string
  /** DERIVED from `days` — never entered by hand (spec A3). */
  weeklyHours: number
  days: ScheduleDay[]
}

export interface ScheduleQueryPort {
  findById(id: string): Promise<ScheduleSnapshot | null>

  /**
   * Hours this schedule expects across `period`, counting only the weekdays the
   * schedule actually covers. Used as the denominator when payroll prorates.
   */
  expectedHours(scheduleId: string, period: Period): Promise<number>

  /** Working days in the period — the denominator for day-based proration. */
  expectedDays(scheduleId: string, period: Period): Promise<number>
}
