


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
import { consumeAllocationForApproval } from './approval.service'
import type { UnitOfWorkPort } from './ports/unit-of-work.port'

export interface ApproveLeaveInput {
  actor: Actor
  requestId: string
}

export class ApproveLeaveUseCase implements UseCase<ApproveLeaveInput, LeaveRequestView> {
  constructor(
    private readonly uow: UnitOfWorkPort,
    private readonly events: IEventBus,
  ) {}

  async execute(input: ApproveLeaveInput): Promise<Result<LeaveRequestView>> {
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
            'LEAVE_SELF_APPROVAL',
            'You cannot approve your own leave request',
          )
        }

        const type = await repos.types.findById(request.timeOffTypeId)
        if (!type) {
          throw DomainError.notFound('TIME_OFF_TYPE_NOT_FOUND', 'That leave type does not exist')
        }

        const allocationId = await consumeAllocationForApproval(repos, type, request)

        request.approve(input.actor.employeeId, allocationId)
        return repos.requests.save(request)
      })

      


      await this.events.publish({
        type: 'leave_request.approved',
        occurredAt: new Date(),
        requestId: saved.id,
        employeeId: saved.employeeId,
        timeOffTypeId: saved.timeOffTypeId,
        duration: saved.duration,
        unit: saved.unit,
      })

      return Ok(saved.toView())
    } catch (reason) {
      if (DomainError.is(reason)) return Err(reason)
      throw reason
    }
  }
}
