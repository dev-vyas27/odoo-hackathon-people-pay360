/**
 * An employee with no bank account cannot actually be paid.
 *
 * A warning rather than an error: the run may still be validated and the detail
 * filled in before money moves. It is the single most common real-world payroll
 * blocker, which is why the spec calls it out by name.
 */
import type {
  IPayrollWarningCheck,
  PayrollWarning,
  PayrunWarningContext,
} from './warning.port'

export class MissingBankDetailsCheck implements IPayrollWarningCheck {
  readonly code = 'MISSING_BANK_DETAILS'

  check({ employees }: PayrunWarningContext): PayrollWarning[] {
    return employees
      .filter((employee) => !employee.bankAccount?.trim())
      .map((employee) => ({
        code: this.code,
        severity: 'warning' as const,
        message: `${employee.name} has no bank account on file and cannot be paid electronically.`,
        employeeId: employee.id,
        employeeName: employee.name,
      }))
  }
}
