


import type { AttendanceStatus } from '../domain/exception'
import { istDay } from '@/modules/shared'
import type { WorkMode } from '../domain/work-mode'


export type StorableStatus = Exclude<AttendanceStatus, 'manual'>

export const STORABLE_STATUSES: readonly StorableStatus[] = [
  'present',
  'late',
  'absent',
  'overtime',
  'missing_checkout',
]

export interface AttendanceRow {
  id: string
  employee_id: string
  worked_on: Date
  checked_in_at: Date | null
  checked_out_at: Date | null
  break_minutes: number
  work_mode: WorkMode | null
  worked_hours: number
  status: StorableStatus
  is_manual: boolean
  created_at: Date
  updated_at: Date
}

export const ATTENDANCES_TABLE = 'attendances'
export const ATTENDANCE_COLUMNS = [
  'id',
  'employee_id',
  'worked_on',
  'checked_in_at',
  'checked_out_at',
  'break_minutes',
  'worked_hours',
  'status',
  'work_mode',
  'is_manual',
  'created_at',
  'updated_at',
] as const


export function toStoredStatus(status: AttendanceStatus): {
  status: StorableStatus
  isManual: boolean
} {
  if (status === 'manual') return { status: 'present', isManual: true }
  return { status, isManual: false }
}


export function toDomainStatus(status: StorableStatus, isManual: boolean): AttendanceStatus {
  return isManual ? 'manual' : status
}



export function workedOnFor(checkIn: Date): Date {
  


  return new Date(`${istDay(checkIn)}T00:00:00.000Z`)
}


export function isUniqueViolation(reason: unknown): boolean {
  return (
    typeof reason === 'object' &&
    reason !== null &&
    'code' in reason &&
    (reason as { code?: string }).code === '23505'
  )
}
