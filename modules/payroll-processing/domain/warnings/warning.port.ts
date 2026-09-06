


import type { Period } from '@/modules/shared'
import type { EmployeeSummary } from '@/modules/shared'
import type { ContractSnapshot } from '@/modules/shared'
import type { Payslip } from '../payslip'



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
  


  readonly payslipsElsewhere: readonly Payslip[]
}

export interface IPayrollWarningCheck {
  readonly code: string
  check(context: PayrunWarningContext): PayrollWarning[]
}
