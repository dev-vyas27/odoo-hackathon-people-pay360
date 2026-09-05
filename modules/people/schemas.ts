/**
 * Client-safe surface of `people`.
 *
 * `@/modules/people` (index.ts) reaches the Postgres repositories, so importing
 * that barrel from a `'use client'` file drags the `pg` driver into the browser
 * bundle and the page dies at module evaluation.
 *
 * The zod schemas are what both sides genuinely share: the form validates with
 * them and the route handler validates with them, so client and server cannot
 * drift. They depend on nothing but zod and the shared contracts.
 */
/**
 * The employee-type vocabulary, re-exported for the client.
 *
 * A closed string union and its labels — pure data, no database. Client code
 * MUST take it from here rather than from '@/modules/people', which reaches the
 * Postgres repositories and would drag `pg` into the browser bundle.
 */
export {
  EMPLOYEE_TYPES,
  EMPLOYEE_TYPE_LABELS,
  isEmployeeType,
  type EmployeeType,
} from './domain/employee-type'

export {
  employeeTypeSchema,
  createEmployeeSchema,
  updateEmployeeSchema,
  employeeQuerySchema,
  type CreateEmployeeBody,
  type UpdateEmployeeBody,
  type EmployeeQuery,
} from './interface/employee.schema'

export {
  createDepartmentSchema,
  updateDepartmentSchema,
  type CreateDepartmentBody,
  type UpdateDepartmentBody,
} from './interface/department.schema'

export {
  createJobPositionSchema,
  updateJobPositionSchema,
  type CreateJobPositionBody,
  type UpdateJobPositionBody,
} from './interface/job-position.schema'

/**
 * Row shapes the API returns. Declared here rather than inferred from the
 * domain classes: a table should be typed against the JSON it actually
 * receives, and Employee's private constructor does not survive serialisation.
 */
export interface EmployeeListItem {
  id: string
  name: string
  email: string
  departmentId: string | null
  jobPositionId: string | null
  managerId: string | null
  workingScheduleId: string | null
  employeeType: 'full_time' | 'part_time' | 'contract' | 'intern'
  bankAccount: string | null
  isActive: boolean
}

/** What the employee form's related-record counters show (spec B2). */
export interface EmployeeDetailView extends EmployeeListItem {
  counts: {
    contracts: number
    attendance: number
    timeOff: number
    allocations: number
  }
}

export interface DepartmentListItem {
  id: string
  name: string
  managerId: string | null
  parentDepartmentId: string | null
}

export interface JobPositionListItem {
  id: string
  title: string
  departmentId: string | null
}
