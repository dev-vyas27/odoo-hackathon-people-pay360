


import type { IReadRepository } from '@/modules/shared'
import type { Payrun } from '../../domain/payrun'
import type { PayrunStatus } from '../../domain/payrun-state'

export interface PayrunRepositoryPort extends IReadRepository<Payrun> {
  
  create(payrun: Payrun): Promise<Payrun>
  updateStatus(id: string, status: PayrunStatus): Promise<Payrun | null>
}
