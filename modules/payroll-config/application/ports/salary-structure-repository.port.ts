


import type { IRepository } from '@/modules/shared'
import type { SalaryStructure } from '../../domain/salary-structure'

export interface SalaryStructureRepositoryPort extends IRepository<SalaryStructure> {
  
  findByRuleId(ruleId: string): Promise<SalaryStructure[]>
}
