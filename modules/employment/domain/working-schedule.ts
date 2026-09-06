/**
 * WorkingSchedule — aggregate root.
 *
 * `weeklyHours` is always the output of `computeWeeklyHours(days)` from
 * weekly-hours.service.ts; nothing in this module accepts it as raw input.
 *
 * `type` (spec A3: the list view must show "name, type, and weekly hours") is
 * a real, stored classification rather than something re-derived from
 * `weeklyHours` on every read. It is set explicitly when a schedule is
 * created or edited; see migration 0013 for how existing rows and any
 * insert that omits it (the seed script, notably) still get a sensible value.
 */
import { computeWeeklyHours, type ScheduleDayPattern } from './weekly-hours.service'

export const SCHEDULE_TYPES = ['full_time', 'part_time'] as const
export type ScheduleType = (typeof SCHEDULE_TYPES)[number]

export const SCHEDULE_TYPE_LABELS: Record<ScheduleType, string> = {
  full_time: 'Full time',
  part_time: 'Part time',
}

export interface WorkingSchedule {
  readonly id: string
  readonly name: string
  readonly type: ScheduleType
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
