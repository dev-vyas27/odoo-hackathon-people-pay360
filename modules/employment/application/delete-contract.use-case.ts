import { authorize, DomainError, Err, Ok, type Actor, type Result, type UseCase } from '@/modules/shared'
import type { ContractRepositoryPort } from './ports/contract-repository.port'

export interface DeleteContractInput {
  actor: Actor
  id: string
}

export class DeleteContractUseCase implements UseCase<DeleteContractInput, true> {
  constructor(private readonly contracts: ContractRepositoryPort) {}

  async execute(input: DeleteContractInput): Promise<Result<true>> {
    const auth = authorize(input.actor, 'contract', 'delete')
    if (!auth.ok) return auth

    const deleted = await this.contracts.delete(input.id)
    if (!deleted) return Err(DomainError.notFound('CONTRACT_NOT_FOUND', 'Contract not found'))
    return Ok(true)
  }
}
