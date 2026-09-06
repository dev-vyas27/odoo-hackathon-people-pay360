


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

        


        if (request.consumesBalance && request.allocationId) {
          const allocation = await repos.allocations.findByIdForUpdate(request.allocationId)
          if (allocation) {
            allocation.restore(request.duration)
            await repos.allocations.save(allocation)
          }
          
          
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
