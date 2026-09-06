


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
  auto_approve: boolean
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
  'auto_approve',
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
  decided_by_employee_id: string | null
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
  'decided_by_employee_id',
  'decided_at',
  'created_at',
  'updated_at',
] as const



export function toUtcDate(value: Date | string): Date {
  if (typeof value === 'string') {
    const [y, m, d] = value.slice(0, 10).split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, d))
  }
  return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()))
}


export function toDateString(value: Date): string {
  return value.toISOString().slice(0, 10)
}


export function selection(columns: readonly string[]): string {
  return columns.map((c) => `"${c}"`).join(', ')
}
