/**
 * The same employee paid twice for the same period.
 *
 * Two ways this happens: the same employee appears twice inside this run, or
 * another payrun already covers an overlapping period for them. Both are errors
 * rather than warnings — paying someone twice is the one payroll mistake that is
 * genuinely expensive to unwind.
 */
import type {
  IPayrollWarningCheck,
  PayrollWarning,
  PayrunWarningContext,
} from './warning.port'

export class DuplicatePayslipCheck implements IPayrollWarningCheck {
  readonly code = 'DUPLICATE_PAYSLIP'

  check({ payslips, payslipsElsewhere, period }: PayrunWarningContext): PayrollWarning[] {
    const warnings: PayrollWarning[] = []
    const seen = new Set<string>()

    for (const payslip of payslips) {
      if (seen.has(payslip.employeeId)) {
        warnings.push({
          code: this.code,
          severity: 'error',
          message: `${payslip.employeeName} appears more than once in this payrun.`,
          employeeId: payslip.employeeId,
          employeeName: payslip.employeeName,
        })
      }
      seen.add(payslip.employeeId)
    }

    for (const other of payslipsElsewhere) {
      if (!seen.has(other.employeeId)) continue
      if (!other.period.overlaps(period)) continue

      warnings.push({
        code: this.code,
        severity: 'error',
        message: `${other.employeeName} already has a payslip in "${other.payrunName}" covering ${other.period.toString()}.`,
        employeeId: other.employeeId,
        employeeName: other.employeeName,
      })
    }

    return warnings
  }
}
