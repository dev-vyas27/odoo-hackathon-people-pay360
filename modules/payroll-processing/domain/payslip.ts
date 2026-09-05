/**
 * Payslip — AGGREGATE ROOT: what one employee was paid for one period, and why.
 *
 * A payslip stores its LINES, not just its totals. That is what makes the
 * computation auditable months later: the breakdown shows every rule that ran,
 * in sequence, with the code it was addressed by. Totals are derived from those
 * lines rather than stored independently, so they can never disagree with them.
 */
import { Money, type PayslipStatus, type Period } from '@/modules/shared'
import { totalForCategory, type ComputedLine } from '@/modules/payroll-config'

export type { PayslipStatus }

/**
 * The `payslips` table stores the employee, payrun, contract and structure as
 * foreign keys; the NAMES below are joined in on read because every screen that
 * shows a payslip shows them, and a second round trip per payslip to resolve a
 * name is not a trade worth making. They are read-only enrichment: the write
 * path persists the ids, never the names.
 */
export interface Payslip {
  readonly id: string
  readonly payrunId: string
  readonly payrunName: string
  readonly employeeId: string
  readonly employeeName: string
  readonly employeeEmail: string | null
  readonly departmentId: string | null
  /** The contract that APPLIED TO THE PERIOD — never "the current contract". */
  readonly contractId: string | null
  readonly structureId: string
  readonly structureName: string
  readonly period: Period
  readonly workedDays: number
  readonly lines: readonly ComputedLine[]
  readonly status: PayslipStatus
}

export interface PayslipTotals {
  readonly basic: Money
  readonly allowances: Money
  readonly gross: Money
  readonly deductions: Money
  readonly net: Money
}

/**
 * Totals by category.
 *
 * Every category is summed rather than "the first line of that category",
 * because a structure may legitimately hold several allowances or several
 * deductions. A structure with no NET rule reports zero net — which the
 * structure inspector flags long before a payrun gets here.
 */
export function totalsOf(payslip: Payslip): PayslipTotals {
  return {
    basic: totalForCategory(payslip.lines, 'basic'),
    allowances: totalForCategory(payslip.lines, 'allowance'),
    gross: totalForCategory(payslip.lines, 'gross'),
    deductions: totalForCategory(payslip.lines, 'deduction'),
    net: totalForCategory(payslip.lines, 'net'),
  }
}

/** Lines in the order they executed — the order that makes a payslip legible. */
export function linesInSequence(payslip: Payslip): ComputedLine[] {
  return [...payslip.lines].sort((a, b) => a.sequence - b.sequence)
}

export function withStatus(payslip: Payslip, status: PayslipStatus): Payslip {
  return { ...payslip, status }
}
