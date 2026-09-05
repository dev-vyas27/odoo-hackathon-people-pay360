import { authorize, Ok, type Actor, type PageQuery, type Paged, type Result, type UseCase } from '@/modules/shared'
import type { Contract } from '../domain/contract'
import type { ContractRepositoryPort } from './ports/contract-repository.port'

export interface ListContractsInput {
  actor: Actor
  query: PageQuery
}

export class ListContractsUseCase implements UseCase<ListContractsInput, Paged<Contract>> {
  constructor(private readonly contracts: ContractRepositoryPort) {}

  async execute(input: ListContractsInput): Promise<Result<Paged<Contract>>> {
    const auth = authorize(input.actor, 'contract', 'read')
    if (!auth.ok) return auth
    return Ok(await this.contracts.findMany(input.query))
  }
}
