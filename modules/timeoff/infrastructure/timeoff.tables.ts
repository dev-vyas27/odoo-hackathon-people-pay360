/**
 * The three Time Off tables as TypeScript sees them.
 *
 * The seam between migrations/0008_timeoff.sql and the domain. Below this line
 * everything is snake_case because that is what the database calls these;
 * above it everything is camelCase. Doing the translation in exactly one place
 * is what stops `timeoff_type_id` leaking into a React component.
 *
 * If you change a column here, there is a migration to write. If there is no
 * migration, this file is lying.
 */
import type { LeaveStatus, LeaveUnit } from '@/modules/shared'
import type { AllocationStatus } from '../domain/allocation'

export const TIMEOFF_TYPES_TABLE = 'timeoff_types'
export const ALLOCATIONS_TABLE = 'timeoff_allocations'
export const REQUESTS_TABLE = 'timeoff_requests'

export interface TimeOffTypeRow {
  id: string
  name: string
  code: string
  unit: LeaveUnit
  requires_allocation: boolean
  is_paid: boolean
  is_active: boolean
  created_at: Date
  updated_at: Date
}

export const TIMEOFF_TYPE_COLUMNS = [
  'id',
  'name',
  'code',
  'unit',
  'requires_allocation',
  'is_paid',
  'is_active',
  'created_at',
  'updated_at',
] as const

export interface AllocationRow {
  id: string
  employee_id: string
  timeoff_type_id: string
  unit: LeaveUnit
  allocated: number
  taken: number
  /** `date` columns come back as JS Dates at local midnight — see toUtcDate. */
  valid_from: Date
  valid_to: Date
  status: AllocationStatus
  note: string | null
  created_at: Date
  updated_at: Date
}

export const ALLOCATION_COLUMNS = [
  'id',
  'employee_id',
  'timeoff_type_id',
  'unit',
  'allocated',
  'taken',
  'valid_from',
  'valid_to',
  'status',
  'note',
  'created_at',
  'updated_at',
] as const

export interface LeaveRequestRow {
  id: string
  employee_id: string
  timeoff_type_id: string
  starts_on: Date
  ends_on: Date
  unit: LeaveUnit
  duration: number
  reason: string | null
  status: LeaveStatus
  allocation_id: string | null
  decided_by_user_id: string | null
  decided_at: Date | null
  created_at: Date
  updated_at: Date
}

export const REQUEST_COLUMNS = [
  'id',
  'employee_id',
  'timeoff_type_id',
  'starts_on',
  'ends_on',
  'unit',
  'duration',
  'reason',
  'status',
  'allocation_id',
  'decided_by_user_id',
  'decided_at',
  'created_at',
  'updated_at',
] as const

/**
 * A `date` column has no timezone, but node-postgres hands it back as a Date at
 * LOCAL midnight. `Period` works in UTC midnight, so 2026-03-02 read in IST
 * would become 2026-03-01T18:30Z and every comparison would be a day out.
 *
 * Rebuilding from the local Y/M/D components — which are the values Postgres
 * actually sent — puts it back on UTC midnight without guessing at offsets.
 */
export function toUtcDate(value: Date | string): Date {
  if (typeof value === 'string') {
    const [y, m, d] = value.slice(0, 10).split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, d))
  }
  return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()))
}

/** The inverse: a Date to the 'YYYY-MM-DD' a `date` column expects. */
export function toDateString(value: Date): string {
  return value.toISOString().slice(0, 10)
}

/** `columns.map(quote).join()` for a SELECT list. */
export function selection(columns: readonly string[]): string {
  return columns.map((c) => `"${c}"`).join(', ')
}
