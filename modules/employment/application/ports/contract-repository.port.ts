/**
 * Write-side contract repository, as the application layer sees it.
 *
 * Extends the generic `IRepository<Contract>` with the one extra query every
 * contract use case needs: the employee's full contract history, to run
 * write-time overlap prevention against (spec A2 rule 3).
 */
import type { IRepository } from '@/modules/shared'
import type { Contract } from '../../domain/contract'

export interface ContractRepositoryPort extends IRepository<Contract> {
  findByEmployee(employeeId: string): Promise<Contract[]>
}
