/**
 * The registry: an array, on purpose.
 *
 * Adding a fifth check is one import and one array entry. Neither the validate
 * use case nor the processing screen changes, because both ask the registry
 * rather than knowing which checks exist.
 */
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

/** Errors block validation; warnings do not. */
export function blockingWarnings(warnings: readonly PayrollWarning[]): PayrollWarning[] {
  return warnings.filter((w) => w.severity === 'error')
}
