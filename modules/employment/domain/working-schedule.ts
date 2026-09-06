

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

export function computeSchedule(
  data: Omit<WorkingSchedule, 'weeklyHours'>,
): WorkingSchedule {
  return { ...data, weeklyHours: computeWeeklyHours(data.days) }
}
