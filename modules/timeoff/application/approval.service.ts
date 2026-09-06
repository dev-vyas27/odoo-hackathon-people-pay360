/**
 * The funding step of an approval: pick, lock, consume.
 *
 * Extracted out of `approve-leave.use-case` so that a manual approval and
 * every auto-approval path (a type configured to skip manual review, driven
 * from `request-leave` and `submit-leave`) run the EXACT same funding rule
 * against the EXACT same lock. An auto-approved request must consume its
 * allocation exactly like a manually approved one — this is the one place
 * that decides how, so the two paths cannot drift apart.
 *
 * Callers run this inside a `UnitOfWorkPort.transaction`, immediately before
 * calling `request.approve(...)` — see approve-leave, request-leave and
 * submit-leave use cases.
 */
import { DomainError } from '@/modules/shared'
import type { LeaveRequest } from '../domain/leave-request'
import type { TimeOffType } from '../domain/time-off-type'
import { selectAllocation } from '../domain/balance.service'
import type { TimeOffRepositories } from './ports/unit-of-work.port'

/**
 * Returns the id of the allocation consumed, or `null` when the type needs
 * none. Throws `INSUFFICIENT_BALANCE` / `NO_ALLOCATION` when nothing can fund
 * the request — the caller's transaction rolls back, so the request is never
 * left half-approved against a balance it could not draw.
 */
export async function consumeAllocationForApproval(
  repos: TimeOffRepositories,
  type: TimeOffType,
  request: Pick<LeaveRequest, 'employeeId' | 'timeOffTypeId' | 'period' | 'duration'>,
): Promise<string | null> {
  if (!type.requiresAllocation) return null

  // Choose the funding allocation from the employee's current set, then
  // re-read it under a lock. Selecting first keeps the pure rule (which
  // allocation, and why) in the domain where it is unit-tested.
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

  // Throws on insufficient balance — before the request is touched.
  allocation.consume(request.duration)
  await repos.allocations.save(allocation)
  return allocation.id
}
