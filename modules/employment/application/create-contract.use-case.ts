

import { Money, DomainError, Err, Ok, authorize, type Actor, type Result, type UseCase } from '@/modules/shared'
import { contractsOverlap } from '../domain/contract-resolution'
import type { Contract } from '../domain/contract'
import type { ContractRepositoryPort } from './ports/contract-repository.port'

export interface CreateContractInput {
  actor: Actor
  employeeId: string
  wage: number
  salaryStructureId?: string | null
  workingScheduleId?: string | null
  departmentId?: string | null
  jobPositionName?: string | null
  start: Date
  end?: Date | null
}

export class CreateContractUseCase implements UseCase<CreateContractInput, Contract> {
  constructor(private readonly contracts: ContractRepositoryPort) {}

  async execute(input: CreateContractInput): Promise<Result<Contract>> {
    const auth = authorize(input.actor, 'contract', 'create')
    if (!auth.ok) return auth

    const end = input.end ?? null
    const existing = await this.contracts.findByEmployee(input.employeeId)
    const candidateRange = { start: input.start, end }
    const clash = existing.find((c) => contractsOverlap(c, candidateRange))
    if (clash) {
      return Err(
        DomainError.conflict(
          'CONTRACT_OVERLAP',
          'This employee already has a contract covering that period. Concurrent active contracts are not allowed.',
          { conflictingContractId: clash.id },
        ),
      )
    }

    const created = await this.contracts.create({
      employeeId: input.employeeId,
      wage: Money.of(input.wage),
      salaryStructureId: input.salaryStructureId ?? null,
      workingScheduleId: input.workingScheduleId ?? null,
      departmentId: input.departmentId ?? null,
      jobPositionName: input.jobPositionName ?? null,
      start: input.start,
      end,
    })
    return Ok(created)
  }
}
