


import type {
  IPayrollWarningCheck,
  PayrollWarning,
  PayrunWarningContext,
} from './warning.port'

const DAY_MS = 86_400_000


export const EXPIRY_HORIZON_DAYS = 30

export class ContractExpiringCheck implements IPayrollWarningCheck {
  readonly code = 'CONTRACT_EXPIRING'

  check({ employees, contracts, period }: PayrunWarningContext): PayrollWarning[] {
    const warnings: PayrollWarning[] = []
    const horizon = period.end.getTime() + EXPIRY_HORIZON_DAYS * DAY_MS

    for (const employee of employees) {
      const contract = contracts.get(employee.id)
      if (!contract?.end) continue

      const endsAt = contract.end.getTime()
      if (endsAt > horizon) continue

      const endsWithinPeriod = endsAt < period.end.getTime()
      warnings.push({
        code: this.code,
        severity: 'warning',
        message: endsWithinPeriod
          ? `${employee.name}'s contract ended on ${formatDay(contract.end)}, before the end of this period.`
          : `${employee.name}'s contract expires on ${formatDay(contract.end)}.`,
        employeeId: employee.id,
        employeeName: employee.name,
      })
    }

    return warnings
  }
}

function formatDay(date: Date): string {
  return date.toISOString().slice(0, 10)
}
