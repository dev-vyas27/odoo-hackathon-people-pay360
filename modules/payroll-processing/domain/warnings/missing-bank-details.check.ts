


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
