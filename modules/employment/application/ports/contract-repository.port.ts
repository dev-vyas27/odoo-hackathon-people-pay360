

import type { IRepository } from '@/modules/shared'
import type { Contract } from '../../domain/contract'

export interface ContractRepositoryPort extends IRepository<Contract> {
  findByEmployee(employeeId: string): Promise<Contract[]>
}
