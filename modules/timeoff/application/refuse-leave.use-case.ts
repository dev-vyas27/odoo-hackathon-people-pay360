/**
 * Refuse a leave request — and give the balance back if it had been approved.
 *
 * Refusing is how an approval is undone, so this is the mirror image of
 * `approve-leave`: same transaction, same locks, opposite direction. Skipping
 * the restore would quietly destroy an employee's entitlement, and it is the
 * kind of bug nobody notices until someone counts their remaining days in
 * December.
 *
 * `request.allocationId` is why this can be exact. With two overlapping
 * allocations, guessing which one to credit is wrong half the time; the
 * approval recorded which one it drew from.
 */
import {
  DomainError,
  Err,
  Ok,
  authorize,
  type Actor,
  type IEventBus,
  type Result,
  type UseCase,
} from '@/modules/shared'
import type { LeaveRequestView } from '../domain/leave-request'
import type { UnitOfWorkPort } from './ports/unit-of-work.port'

export interface RefuseLeaveInput {
  actor: Actor
  requestId: string
}

export class RefuseLeaveUseCase implements UseCase<RefuseLeaveInput, LeaveRequestView> {
  constructor(
    private readonly uow: UnitOfWorkPort,
    private readonly events: IEventBus,
  ) {}

  async execute(input: RefuseLeaveInput): Promise<Result<LeaveRequestView>> {
    const allowed = authorize(input.actor, 'leave_request', 'approve')
    if (!allowed.ok) return allowed

    try {
      const saved = await this.uow.transaction(async (repos) => {
        const request = await repos.requests.findByIdForUpdate(input.requestId)
        if (!request) {
          throw DomainError.notFound('LEAVE_NOT_FOUND', 'That leave request does not exist')
        }

        if (input.actor.employeeId && input.actor.employeeId === request.employeeId) {
          throw DomainError.forbidden(
            'LEAVE_SELF_DECISION',
            'You cannot decide on your own leave request',
          )
        }

        /**
         * Restore BEFORE the state change, for the same reason approval
         * consumes before it: the state machine is what decides whether this
         * transition is legal at all, and `consumesBalance` is only true while
         * the request is still in the approved state.
         */
        if (request.consumesBalance && request.allocationId) {
          const allocation = await repos.allocations.findByIdForUpdate(request.allocationId)
          if (allocation) {
            allocation.restore(request.duration)
            await repos.allocations.save(allocation)
          }
          // A missing allocation is not fatal here. It would mean the data is
          // already inconsistent, and refusing the refusal helps nobody.
          request.releaseAllocation()
        }

        request.refuse(input.actor.employeeId)
        return repos.requests.save(request)
      })

      await this.events.publish({
        type: 'leave_request.refused',
        occurredAt: new Date(),
        requestId: saved.id,
        employeeId: saved.employeeId,
      })

      return Ok(saved.toView())
    } catch (reason) {
      if (DomainError.is(reason)) return Err(reason)
      throw reason
    }
  }
}
