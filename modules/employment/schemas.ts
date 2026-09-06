


import type { ScheduleType } from './domain/working-schedule'

export {
  createContractSchema,
  updateContractSchema,
  type CreateContractBody,
  type UpdateContractBody,
} from './interface/contract.schema'

export {
  createScheduleSchema,
  updateScheduleSchema,
  type CreateScheduleBody,
  type UpdateScheduleBody,
} from './interface/schedule.schema'



export { computeWeeklyHours } from './domain/weekly-hours.service'



export {
  SCHEDULE_TYPES,
  SCHEDULE_TYPE_LABELS,
  type ScheduleType,
} from './domain/working-schedule'



export const FULL_TIME_MIN_WEEKLY_HOURS = 35

export function isFullTimeSchedule(weeklyHours: number): boolean {
  return weeklyHours >= FULL_TIME_MIN_WEEKLY_HOURS
}


export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface ScheduleDayValues {
  day: Weekday
  start: string
  end: string
  breakMinutes: number
}

export interface ContractListItem {
  id: string
  employeeId: string
  wage: number
  salaryStructureId: string | null
  workingScheduleId: string | null
  departmentId: string | null
  jobPositionName: string | null
  start: string
  end: string | null
}

export interface ScheduleListItem {
  id: string
  name: string
  type: ScheduleType
  weeklyHours: number
  days: ScheduleDayValues[]
}

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
}
