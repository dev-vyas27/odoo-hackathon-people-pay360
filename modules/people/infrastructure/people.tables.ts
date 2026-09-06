

import type { EmployeeType } from '../domain/employee-type'

export interface EmployeeRow {
  id: string
  name: string
  email: string
  phone: string | null
  department_id: string | null
  job_position_id: string | null
  manager_id: string | null
  working_schedule_id: string | null
  employee_type: EmployeeType
  bank_account: string | null
  is_active: boolean
  created_at: Date
  updated_at: Date
}

export const EMPLOYEES_TABLE = 'employees'

export const NOT_AN_ADMIN = `role <> 'admin'`
export const EMPLOYEE_COLUMNS = [
  'id',
  'name',
  'email',
  'phone',
  'department_id',
  'job_position_id',
  'manager_id',
  'working_schedule_id',
  'employee_type',
  'bank_account',
  'is_active',
  'created_at',
  'updated_at',
] as const

export interface DepartmentRow {
  id: string
  name: string
  code: string
  manager_id: string | null
  is_active: boolean
  created_at: Date
  updated_at: Date
}

export const DEPARTMENTS_TABLE = 'departments'
export const DEPARTMENT_COLUMNS = [
  'id',
  'name',
  'code',
  'manager_id',
  'is_active',
  'created_at',
  'updated_at',
] as const

export interface JobPositionRow {
  id: string
  name: string
  department_id: string | null
  is_active: boolean
  created_at: Date
  updated_at: Date
}

export const JOB_POSITIONS_TABLE = 'job_positions'
export const JOB_POSITION_COLUMNS = [
  'id',
  'name',
  'department_id',
  'is_active',
  'created_at',
  'updated_at',
] as const

export const UNIQUE_VIOLATION = '23505'

export function isUniqueViolation(reason: unknown): boolean {
  return typeof reason === 'object' && reason !== null && 'code' in reason &&
    (reason as { code?: string }).code === UNIQUE_VIOLATION
}
