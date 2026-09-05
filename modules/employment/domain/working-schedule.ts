/**
 * WorkingSchedule — aggregate root.
 *
 * `weeklyHours` is always the output of `computeWeeklyHours(days)` from
 * weekly-hours.service.ts; nothing in this module accepts it as raw input.
 */
import { computeWeeklyHours, type ScheduleDayPattern } from './weekly-hours.service'

export interface WorkingSchedule {
  readonly id: string
  readonly name: string
  readonly days: readonly ScheduleDayPattern[]
  readonly weeklyHours: number
  readonly createdAt: Date
  readonly updatedAt: Date
}

/** Derive the computed `weeklyHours` field so no caller can set it by hand. */
export function computeSchedule(
  data: Omit<WorkingSchedule, 'weeklyHours'>,
): WorkingSchedule {
  return { ...data, weeklyHours: computeWeeklyHours(data.days) }
}
