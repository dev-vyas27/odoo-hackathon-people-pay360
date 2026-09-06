


import type {
  IPayrollWarningCheck,
  PayrollWarning,
  PayrunWarningContext,
} from './warning.port'
import { MissingBankDetailsCheck } from './missing-bank-details.check'
import { DuplicatePayslipCheck } from './duplicate-payslip.check'
import { MissingContractCheck } from './missing-contract.check'
import { ContractExpiringCheck } from './contract-expiring.check'

export const PAYROLL_WARNING_CHECKS: readonly IPayrollWarningCheck[] = [
  new MissingContractCheck(),
  new DuplicatePayslipCheck(),
  new MissingBankDetailsCheck(),
  new ContractExpiringCheck(),
]

export function runWarningChecks(
  context: PayrunWarningContext,
  checks: readonly IPayrollWarningCheck[] = PAYROLL_WARNING_CHECKS,
): PayrollWarning[] {
  return checks.flatMap((check) => check.check(context))
}


export function blockingWarnings(warnings: readonly PayrollWarning[]): PayrollWarning[] {
  return warnings.filter((w) => w.severity === 'error')
}
