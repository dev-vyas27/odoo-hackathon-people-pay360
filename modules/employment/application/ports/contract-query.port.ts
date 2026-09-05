/**
 * ContractQueryPort — read-only view of contracts for OTHER modules.
 *
 * `findApplicableContract` is THE method Payroll is built on: it applies the
 * contract-resolution rules (spec A2) against the real data. Numeric `wage`
 * is major units on purpose -- consumers convert with `Money.of()` at their
 * own boundary rather than depending on this module's `Money` instances.
 */
import type { Period } from '@/modules/shared'

export interface ContractSnapshot {
  id: string
  employeeId: string
  wage: number
  salaryStructureId: string | null
  workingScheduleId: string | null
  departmentId: string | null
  jobPositionName: string | null
  start: Date
  end: Date | null
}

export interface ContractQueryPort {
  findApplicableContract(employeeId: string, period: Period): Promise<ContractSnapshot | null>
  findByEmployee(employeeId: string): Promise<ContractSnapshot[]>
}
