/**
 * ContractQueryPort — the contract that applies to a payroll period.
 *
 * PUBLISHED BY: employment (Dev B)
 * CONSUMED BY:  payroll-processing (Dev C), analytics (Dev A)
 *
 * `findApplicableContract` is the single most important method in this codebase.
 * The spec returns to it in sections 1, 2, A2 and 5: an employee may hold many
 * contracts over time, and payroll must use the one valid for the period being
 * run — never simply "the latest" and never "the currently active one".
 *
 * Payroll depends on this interface, not on the Contract aggregate, so the
 * resolution rule lives in one place and cannot be reimplemented (differently,
 * subtly wrongly) inside the payslip engine.
 *
 * CHANGING THIS INTERFACE BREAKS PAYROLL. Announce it first.
 */
import type { Period } from '@/modules/shared'

export interface ContractSnapshot {
  id: string
  employeeId: string
  /** Major units (e.g. 50000.00). Convert with Money.of() at the domain boundary. */
  wage: number
  salaryStructureId: string | null
  workingScheduleId: string | null
  departmentId: string | null
  jobPositionName: string | null
  start: Date
  /** Null means open-ended. */
  end: Date | null
}

export interface ContractQueryPort {
  /**
   * The contract covering `period`, or null when the employee has none.
   *
   * Resolution rules (implemented in domain/contract-resolution.ts):
   *  1. the contract's validity range must overlap `period`
   *  2. when several overlap, prefer the one covering the period END
   *  3. tie-break on the latest start date
   *
   * Returning null is a legitimate answer, not an error: Payroll turns it into
   * a "missing contract" warning rather than a crash.
   */
  findApplicableContract(employeeId: string, period: Period): Promise<ContractSnapshot | null>

  /** Full history for an employee, newest first. Powers the Contracts smart button. */
  findByEmployee(employeeId: string): Promise<ContractSnapshot[]>
}
