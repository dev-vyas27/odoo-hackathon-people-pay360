/**
 * Persistence port for salary structures.
 */
import type { IRepository } from '@/modules/shared'
import type { SalaryStructure } from '../../domain/salary-structure'

export interface SalaryStructureRepositoryPort extends IRepository<SalaryStructure> {
  /** Structures that include a given rule — used before archiving that rule. */
  findByRuleId(ruleId: string): Promise<SalaryStructure[]>
}
