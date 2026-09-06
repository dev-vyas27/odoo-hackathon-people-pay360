


import type { ResolvedSalaryStructure } from '../../domain/salary-structure'

export interface SalaryStructureQueryPort {
  


  findById(structureId: string): Promise<ResolvedSalaryStructure | null>
}
