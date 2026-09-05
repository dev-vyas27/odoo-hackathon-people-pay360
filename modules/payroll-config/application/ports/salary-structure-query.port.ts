/**
 * SalaryStructureQueryPort — the read model payroll processing computes from.
 *
 * PUBLISHED BY: payroll-config (Dev C)
 * CONSUMED BY:  payroll-processing (Dev C)
 *
 * Payroll processing needs exactly one thing from configuration: a structure
 * with its rules resolved and ordered, ready to hand to the rule engine. It gets
 * that and nothing else, so the config module can restructure its persistence
 * without the payslip engine noticing.
 */
import type { ResolvedSalaryStructure } from '../../domain/salary-structure'

export interface SalaryStructureQueryPort {
  /**
   * The structure with every rule hydrated, in execution order.
   *
   * Returns null when the structure does not exist. Throws when it exists but
   * references a rule that has been removed — that is a broken configuration,
   * not a missing record, and it must not produce a quietly incomplete payslip.
   */
  findById(structureId: string): Promise<ResolvedSalaryStructure | null>
}
