

import { Money, DomainError, Err, Ok, authorize, type Actor, type Result, type UseCase } from '@/modules/shared'
import { contractsOverlap } from '../domain/contract-resolution'
import type { Contract } from '../domain/contract'
import type { ContractRepositoryPort } from './ports/contract-repository.port'

export interface UpdateContractInput {
  actor: Actor
  id: string
  wage?: number
  salaryStructureId?: string | null
  workingScheduleId?: string | null
  departmentId?: string | null
  jobPositionName?: string | null
  start?: Date
  end?: Date | null
}

export class UpdateContractUseCase implements UseCase<UpdateContractInput, Contract> {
  constructor(private readonly contracts: ContractRepositoryPort) {}

  async execute(input: UpdateContractInput): Promise<Result<Contract>> {
    const auth = authorize(input.actor, 'contract', 'update')
    if (!auth.ok) return auth

    const current = await this.contracts.findById(input.id)
    if (!current) return Err(DomainError.notFound('CONTRACT_NOT_FOUND', 'Contract not found'))

    const start = input.start ?? current.start
    const end = input.end === undefined ? current.end : input.end

    const siblings = await this.contracts.findByEmployee(current.employeeId)
    const clash = siblings.find((c) => c.id !== current.id && contractsOverlap(c, { start, end }))
    if (clash) {
      return Err(
        DomainError.conflict(
          'CONTRACT_OVERLAP',
          'That date range overlaps another contract for this employee. Concurrent active contracts are not allowed.',
          { conflictingContractId: clash.id },
        ),
      )
    }

    const patch: Partial<Contract> = {
      start,
      end,
      ...(input.wage !== undefined ? { wage: Money.of(input.wage) } : {}),
      ...(input.salaryStructureId !== undefined ? { salaryStructureId: input.salaryStructureId } : {}),
      ...(input.workingScheduleId !== undefined ? { workingScheduleId: input.workingScheduleId } : {}),
      ...(input.departmentId !== undefined ? { departmentId: input.departmentId } : {}),
      ...(input.jobPositionName !== undefined ? { jobPositionName: input.jobPositionName } : {}),
    }

    const updated = await this.contracts.update(current.id, patch)
    if (!updated) return Err(DomainError.notFound('CONTRACT_NOT_FOUND', 'Contract not found'))
    return Ok(updated)
  }
}
