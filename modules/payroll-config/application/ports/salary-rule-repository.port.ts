


import type { IRepository } from '@/modules/shared'
import type { SalaryRule } from '../../domain/salary-rule'

export interface SalaryRuleRepositoryPort extends IRepository<SalaryRule> {
  
  findManyByIds(ids: string[]): Promise<SalaryRule[]>

  
  findByCode(code: string): Promise<SalaryRule | null>
}
