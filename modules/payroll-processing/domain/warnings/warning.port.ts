/**
 * Pre-finalisation warning checks.
 *
 * The spec requires problems to be surfaced BEFORE a payrun is validated —
 * missing bank details, duplicate payslips, contracts needing attention. Each
 * check is an object implementing this interface and is registered in an array,
 * so adding the fifth check never edits the validator or the use case (Open/
 * Closed, with the registry doing the composing).
 */
import type { Period } from '@/modules/shared'
import type { EmployeeSummary } from '@/modules/shared'
import type { ContractSnapshot } from '@/modules/shared'
import type { Payslip } from '../payslip'

/**
 * `error` blocks validation; `warning` is shown but may be accepted knowingly.
 * The distinction is what stops the warning panel from becoming noise a user
 * learns to click past.
 */
export type WarningSeverity = 'warning' | 'error'

export interface PayrollWarning {
  readonly code: string
  readonly severity: WarningSeverity
  readonly message: string
  readonly employeeId: string | null
  readonly employeeName: string | null
}

export interface PayrunWarningContext {
  readonly payrunId: string
  readonly period: Period
  readonly employees: readonly EmployeeSummary[]
  readonly contracts: ReadonlyMap<string, ContractSnapshot | null>
  readonly payslips: readonly Payslip[]
  /**
   * Payslips for the same employees and period that belong to OTHER payruns.
   * Supplied by the use case, because a duplicate cannot be detected from
   * inside a single run.
   */
  readonly payslipsElsewhere: readonly Payslip[]
}

export interface IPayrollWarningCheck {
  readonly code: string
  check(context: PayrunWarningContext): PayrollWarning[]
}
