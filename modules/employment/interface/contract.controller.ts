/**
 * Contract controller — the thin seam route handlers call into.
 *
 * Each function wires the real Mongo repository to the relevant use case and
 * runs it. Route handlers stay ~5 lines: parse the request, call one of
 * these, `respond(result)`.
 */
import type { Actor, PageQuery, Paged, Result } from '@/modules/shared'
import type { Contract } from '../domain/contract'
import { MongoContractRepository } from '../infrastructure/mongo-contract.repository'
import { CreateContractUseCase, type CreateContractInput } from '../application/create-contract.use-case'
import { UpdateContractUseCase, type UpdateContractInput } from '../application/update-contract.use-case'
import { ListContractsUseCase } from '../application/list-contracts.use-case'
import { GetContractUseCase } from '../application/get-contract.use-case'
import { DeleteContractUseCase } from '../application/delete-contract.use-case'

function repository() {
  return new MongoContractRepository()
}

export async function listContracts(actor: Actor, query: PageQuery): Promise<Result<Paged<Contract>>> {
  return new ListContractsUseCase(repository()).execute({ actor, query })
}

export async function getContract(actor: Actor, id: string): Promise<Result<Contract>> {
  return new GetContractUseCase(repository()).execute({ actor, id })
}

export async function createContract(
  actor: Actor,
  body: Omit<CreateContractInput, 'actor'>,
): Promise<Result<Contract>> {
  return new CreateContractUseCase(repository()).execute({ actor, ...body })
}

export async function updateContract(
  actor: Actor,
  id: string,
  body: Omit<UpdateContractInput, 'actor' | 'id'>,
): Promise<Result<Contract>> {
  return new UpdateContractUseCase(repository()).execute({ actor, id, ...body })
}

export async function deleteContract(actor: Actor, id: string): Promise<Result<true>> {
  return new DeleteContractUseCase(repository()).execute({ actor, id })
}
