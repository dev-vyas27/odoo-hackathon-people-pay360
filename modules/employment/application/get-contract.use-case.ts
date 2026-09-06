import { authorize, DomainError, Err, Ok, type Actor, type Result, type UseCase } from '@/modules/shared'
import type { Contract } from '../domain/contract'
import type { ContractRepositoryPort } from './ports/contract-repository.port'

export interface GetContractInput {
  actor: Actor
  id: string
}

export class GetContractUseCase implements UseCase<GetContractInput, Contract> {
  constructor(private readonly contracts: ContractRepositoryPort) {}

  async execute(input: GetContractInput): Promise<Result<Contract>> {
    const auth = authorize(input.actor, 'contract', 'read')
    if (!auth.ok) return auth

    const contract = await this.contracts.findById(input.id)
    if (!contract) return Err(DomainError.notFound('CONTRACT_NOT_FOUND', 'Contract not found'))
    return Ok(contract)
  }
}
