/**
 * The people tables as TypeScript sees them.
 *
 * The seam between the schema (migrations/0002_organisation.sql and
 * 0004_people.sql) and the domain: snake_case below, camelCase above, and the
 * translation happens in exactly one place.
 *
 * If you change a column here there is a migration to write — and the
 * migrations are owned by the platform developer, so the change starts as a
 * conversation, not as an edit to this file.
 */
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

/**
 * "An administrator is not a member of staff", as SQL.
 *
 * Migration 0010 made every login an employee row, so the account somebody
 * administers the system with now sits in the same table as real staff. It has
 * no department, no contract and no job position, because it is the operator
 * rather than a person on the payroll.
 *
 * This lives here, once, because the rule is needed in two places that would
 * otherwise drift: the employee list (see `buildWhere` in
 * postgres-employee.repository.ts) and the dashboard's people statistics. A
 * list showing eight beside a headcount reading nine is the kind of
 * disagreement that makes someone stop trusting both numbers.
 *
 * It is a constant, never interpolated from input, so it carries no injection
 * risk and `role` can stay out of `EMPLOYEE_COLUMNS` — and therefore off the
 * wire. Prefix it (`e.`) when the query joins.
 */
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

/**
 * Postgres unique-violation. Surfaced as a domain conflict rather than a 500 —
 * "that email is already taken" is a business answer, not a crash.
 */
export const UNIQUE_VIOLATION = '23505'

export function isUniqueViolation(reason: unknown): boolean {
  return typeof reason === 'object' && reason !== null && 'code' in reason &&
    (reason as { code?: string }).code === UNIQUE_VIOLATION
}
