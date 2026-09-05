/**
 * ScheduleQueryPort — read-only view of working schedules for OTHER modules.
 *
 * `expectedHours`/`expectedDays` are payroll's proration denominators: how
 * much of a payroll period a schedule actually covers. Both count only the
 * weekdays the schedule's day pattern covers, never a flat calendar count.
 */
import type { Period } from '@/modules/shared'

export interface ScheduleSnapshot {
  id: string
  name: string
  weeklyHours: number
  days: Array<{ day: 0 | 1 | 2 | 3 | 4 | 5 | 6; start: string; end: string; breakMinutes: number }>
}

export interface ScheduleQueryPort {
  findById(id: string): Promise<ScheduleSnapshot | null>
  expectedHours(scheduleId: string, period: Period): Promise<number>
  expectedDays(scheduleId: string, period: Period): Promise<number>
}
