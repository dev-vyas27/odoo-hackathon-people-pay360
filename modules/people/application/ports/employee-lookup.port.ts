/**
 * EmployeeLookupPort — what the rest of the system is allowed to know about an
 * employee.
 *
 * PUBLISHED BY: people (Dev B)
 * CONSUMED BY:  timeoff (Dev A), payroll-processing (Dev C), analytics (Dev A)
 *
 * This is deliberately a read-only projection, not the Employee aggregate.
 * Other modules get the fields they genuinely need and nothing more, so People
 * can restructure its internals without breaking Payroll (Interface Segregation
 * and Dependency Inversion doing real work).
 *
 * CHANGING THIS INTERFACE BREAKS TWO OTHER DEVELOPERS. Announce it first.
 */
import type { EmployeeType } from '../../domain/employee-type'

export interface EmployeeSummary {
  id: string
  name: string
  email: string
  departmentId: string | null
  departmentName: string | null
  jobPositionName: string | null
  employeeType: EmployeeType
  managerId: string | null
  workingScheduleId: string | null
  /** Null when unset — Payroll raises the "missing bank details" warning on it. */
  bankAccount: string | null
  isActive: boolean
}

export interface EligibilityFilter {
  departmentId?: string
  employeeType?: EmployeeType
  /** Only employees active on this date are eligible. */
  activeOn: Date
}

export interface EmployeeLookupPort {
  findById(employeeId: string): Promise<EmployeeSummary | null>

  /** Batch form — avoids N+1 lookups when Payroll builds a run of 200 payslips. */
  findManyByIds(ids: string[]): Promise<EmployeeSummary[]>

  /** Drives step 2 of the Payrun wizard: who may be included in this run. */
  findEligible(filter: EligibilityFilter): Promise<EmployeeSummary[]>
}
