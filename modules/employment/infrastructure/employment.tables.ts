

import type { ScheduleType } from '../domain/working-schedule'

export interface ContractRow {
  id: string
  employee_id: string
  wage: number
  salary_structure_id: string | null
  working_schedule_id: string | null
  starts_on: Date
  ends_on: Date | null
  status: ContractStatus
  created_at: Date
  updated_at: Date
}

export const CONTRACT_STATUSES = ['draft', 'active', 'expired', 'cancelled'] as const
export type ContractStatus = (typeof CONTRACT_STATUSES)[number]

export const CONTRACTS_TABLE = 'contracts'
export const CONTRACT_COLUMNS = [
  'id',
  'employee_id',
  'wage',
  'salary_structure_id',
  'working_schedule_id',
  'starts_on',
  'ends_on',
  'status',
  'created_at',
  'updated_at',
] as const

export interface ScheduleRow {
  id: string
  name: string
  type: ScheduleType
  weekly_hours: number
  is_active: boolean
  created_at: Date
  updated_at: Date
}

export const SCHEDULES_TABLE = 'working_schedules'
export const SCHEDULE_COLUMNS = [
  'id',
  'name',
  'type',
  'weekly_hours',
  'is_active',
  'created_at',
  'updated_at',
] as const

export interface ScheduleDayRow {
  id: string
  working_schedule_id: string
  day_of_week: number
  starts_at: string
  ends_at: string
  break_minutes: number
}

export const SCHEDULE_DAYS_TABLE = 'working_schedule_days'

export function toClock(sqlTime: string): string {
  return sqlTime.slice(0, 5)
}

export function toSqlTime(clock: string): string {
  return clock.length === 5 ? `${clock}:00` : clock
}
