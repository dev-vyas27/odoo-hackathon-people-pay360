/**
 * Client-safe surface of `employment`.
 *
 * See modules/people/schemas.ts for why this file exists: importing
 * `@/modules/employment` from a client component would pull the Postgres
 * repositories, and with them `pg`, into the browser bundle.
 */
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

/**
 * Weekly-hours derivation, re-exported for the client.
 *
 * Pure arithmetic over the day pattern with no database and no framework, so it
 * is safe in the browser. The schedule form previews the number live using the
 * SAME function the repository persists with — a preview computed a second way
 * would eventually disagree with the stored value.
 */
export { computeWeeklyHours } from './domain/weekly-hours.service'

/** 0 = Sunday, matching Date#getUTCDay and the day_of_week column. */
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
