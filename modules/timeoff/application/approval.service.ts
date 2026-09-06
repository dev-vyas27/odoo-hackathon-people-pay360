

import { DomainError } from '@/modules/shared'
import type { LeaveRequest } from '../domain/leave-request'
import type { TimeOffType } from '../domain/time-off-type'
import { selectAllocation } from '../domain/balance.service'
import type { TimeOffRepositories } from './ports/unit-of-work.port'

export async function consumeAllocationForApproval(
  repos: TimeOffRepositories,
  type: TimeOffType,
  request: Pick<LeaveRequest, 'employeeId' | 'timeOffTypeId' | 'period' | 'duration'>,
): Promise<string | null> {
  if (!type.requiresAllocation) return null

  
  
  
  const candidate = selectAllocation(
    await repos.allocations.findForEmployee(request.employeeId, type.id),
    {
      employeeId: request.employeeId,
      timeOffTypeId: type.id,
      period: request.period,
      duration: request.duration,
    },
  )

  const allocation = await repos.allocations.findByIdForUpdate(candidate.id)
  if (!allocation) {
    throw DomainError.notFound('ALLOCATION_NOT_FOUND', 'That allocation no longer exists')
  }

  
  allocation.consume(request.duration)
  await repos.allocations.save(allocation)
  return allocation.id
}
