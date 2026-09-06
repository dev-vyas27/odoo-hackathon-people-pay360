


import {
  Ok,
  authorizeOwned,
  startOfDay,
  type Actor,
  type LeaveBalanceView,
  type Result,
  type UseCase,
} from '@/modules/shared'
import { buildBalances } from '../domain/balance.service'
import type { UnitOfWorkPort } from './ports/unit-of-work.port'

export interface GetBalanceInput {
  actor: Actor
  employeeId: string
  
  on?: Date
}

export class GetBalanceUseCase implements UseCase<GetBalanceInput, LeaveBalanceView[]> {
  constructor(private readonly uow: UnitOfWorkPort) {}

  async execute(input: GetBalanceInput): Promise<Result<LeaveBalanceView[]>> {
    const allowed = authorizeOwned(input.actor, 'allocation', 'read', input.employeeId)
    if (!allowed.ok) return allowed

    const { types, allocations, requests } = this.uow.repos
    const on = startOfDay(input.on ?? new Date())

    const [allTypes, employeeAllocations, employeeRequests] = await Promise.all([
      types.findAll(true),
      allocations.findForEmployee(input.employeeId),
      requests.findForEmployee(input.employeeId),
    ])

    


    const withBalances = allTypes.filter((type) => type.requiresAllocation)

    return Ok(buildBalances(withBalances, employeeAllocations, employeeRequests, on))
  }
}
