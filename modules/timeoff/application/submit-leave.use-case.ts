


import {
  DomainError,
  Err,
  Ok,
  authorizeOwned,
  type Actor,
  type IEventBus,
  type Result,
  type UseCase,
} from '@/modules/shared'
import type { LeaveRequestView } from '../domain/leave-request'
import { consumeAllocationForApproval } from './approval.service'
import type { UnitOfWorkPort } from './ports/unit-of-work.port'

export interface SubmitLeaveInput {
  actor: Actor
  requestId: string
}

export class SubmitLeaveUseCase implements UseCase<SubmitLeaveInput, LeaveRequestView> {
  constructor(
    private readonly uow: UnitOfWorkPort,
    private readonly events: IEventBus,
  ) {}

  async execute(input: SubmitLeaveInput): Promise<Result<LeaveRequestView>> {
    try {
      const existing = await this.uow.repos.requests.findById(input.requestId)
      if (!existing) {
        return Err(DomainError.notFound('LEAVE_NOT_FOUND', 'That leave request does not exist'))
      }

      
      const allowed = authorizeOwned(input.actor, 'leave_request', 'update', existing.employeeId)
      if (!allowed.ok) return allowed

      let autoApproved = false

      const saved = await this.uow.transaction(async (repos) => {
        const request = await repos.requests.findByIdForUpdate(input.requestId)
        if (!request) {
          throw DomainError.notFound('LEAVE_NOT_FOUND', 'That leave request does not exist')
        }

        request.submit()

        const type = await repos.types.findById(request.timeOffTypeId)
        if (!type) {
          throw DomainError.notFound('TIME_OFF_TYPE_NOT_FOUND', 'That leave type does not exist')
        }

        if (type.autoApprove) {
          
          const allocationId = await consumeAllocationForApproval(repos, type, request)
          request.approve(null, allocationId)
          autoApproved = true
        }

        return repos.requests.save(request)
      })

      
      
      if (autoApproved) {
        await this.events.publish({
          type: 'leave_request.approved',
          occurredAt: new Date(),
          requestId: saved.id,
          employeeId: saved.employeeId,
          timeOffTypeId: saved.timeOffTypeId,
          duration: saved.duration,
          unit: saved.unit,
        })
      }

      return Ok(saved.toView())
    } catch (reason) {
      if (DomainError.is(reason)) return Err(reason)
      throw reason
    }
  }
}

export interface DeleteLeaveInput {
  actor: Actor
  requestId: string
}



export class DeleteLeaveUseCase implements UseCase<DeleteLeaveInput, true> {
  constructor(private readonly uow: UnitOfWorkPort) {}

  async execute(input: DeleteLeaveInput): Promise<Result<true>> {
    const request = await this.uow.repos.requests.findById(input.requestId)
    if (!request) {
      return Err(DomainError.notFound('LEAVE_NOT_FOUND', 'That leave request does not exist'))
    }

    const allowed = authorizeOwned(input.actor, 'leave_request', 'delete', request.employeeId)
    if (!allowed.ok) return allowed

    if (!request.isEditable) {
      return Err(
        DomainError.rule(
          'LEAVE_NOT_EDITABLE',
          `A ${request.status.replace(/_/g, ' ')} request cannot be deleted. Refuse it instead.`,
        ),
      )
    }

    await this.uow.repos.requests.delete(input.requestId)
    return Ok(true)
  }
}
