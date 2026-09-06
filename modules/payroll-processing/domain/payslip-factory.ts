/**
 * (employee, contract, structure, period) -> Payslip.
 *
 * Pure: it receives snapshots and returns an aggregate. No repository, no
 * database, no HTTP — which is why the whole computation can be tested with
 * literals in milliseconds, and why "which contract applies" is decided by the
 * CALLER (through ContractQueryPort) rather than guessed at here.
 */
import { Money, type Period } from '@/modules/shared'
import { runRuleEngine, type ResolvedSalaryStructure } from '@/modules/payroll-config'
import type { Payslip } from './payslip'

export interface PayslipFactoryInput {
  id: string
  payrunId: string
  payrunName: string
  employeeId: string
  employeeName: string
  employeeEmail?: string | null
  departmentId: string | null
  /** The contract resolved for THIS period, not the employee's latest. */
  contract: { id: string; wage: number }
  structure: ResolvedSalaryStructure
  period: Period
  /** Time actually worked and expected, in the same unit. Drives WORKED_RATIO. */
  workedDays: number
  workedUnits: number
  expectedUnits: number
}

export function createPayslip(input: PayslipFactoryInput): Payslip {
  const lines = runRuleEngine({
    rules: input.structure.rules,
    contractWage: Money.of(input.contract.wage),
    prorationRatio: prorationRatio(input.workedUnits, input.expectedUnits),
    workedDays: input.workedDays,
  })

  return {
    id: input.id,
    payrunId: input.payrunId,
    payrunName: input.payrunName,
    employeeId: input.employeeId,
    employeeName: input.employeeName,
    employeeEmail: input.employeeEmail ?? null,
    departmentId: input.departmentId,
    contractId: input.contract.id,
    structureId: input.structure.id,
    structureName: input.structure.name,
    period: input.period,
    workedDays: input.workedDays,
    lines,
    status: 'computed',
  }
}

/**
 * A schedule that expects nothing in the period means there is nothing to
 * prorate against — pay the full amount rather than zero, because dividing by
 * an absent denominator should not silently wipe out someone's salary.
 */
function prorationRatio(worked: number, expected: number): number {
  if (expected <= 0) return 1
  return worked / expected
}
