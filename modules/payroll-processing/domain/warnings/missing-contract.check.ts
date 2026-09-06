


import type {
  IPayrollWarningCheck,
  PayrollWarning,
  PayrunWarningContext,
} from './warning.port'

export class MissingContractCheck implements IPayrollWarningCheck {
  readonly code = 'MISSING_CONTRACT'

  check({ employees, contracts, period }: PayrunWarningContext): PayrollWarning[] {
    return employees
      .filter((employee) => !contracts.get(employee.id))
      .map((employee) => ({
        code: this.code,
        severity: 'error' as const,
        message: `${employee.name} has no contract covering ${period.toString()}.`,
        employeeId: employee.id,
        employeeName: employee.name,
      }))
  }
}
