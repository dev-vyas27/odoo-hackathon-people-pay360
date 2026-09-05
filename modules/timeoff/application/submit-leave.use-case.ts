/**
 * The two things you can do to a request that is still yours: send it for
 * approval, or withdraw it.
 *
 * Both are gated by the state machine rather than by an `if` here.
 * `LeaveRequest.submit()` throws on anything that is not a draft, and
 * `isEditable` is false the moment a request reaches an approver — which is the
 * rule that stops someone quietly changing the dates of a request already
 * sitting in a manager's queue.
 */
import {
  DomainError,
  Err,
  Ok,
  authorizeOwned,
  type Actor,
  type Result,
  type UseCase,
} from '@/modules/shared'
import type { LeaveRequestView } from '../domain/leave-request'
import type { UnitOfWorkPort } from './ports/unit-of-work.port'

export interface SubmitLeaveInput {
  actor: Actor
  requestId: string
}

export class SubmitLeaveUseCase implements UseCase<SubmitLeaveInput, LeaveRequestView> {
  constructor(private readonly uow: UnitOfWorkPort) {}

  async execute(input: SubmitLeaveInput): Promise<Result<LeaveRequestView>> {
    try {
      const request = await this.uow.repos.requests.findById(input.requestId)
      if (!request) {
        return Err(DomainError.notFound('LEAVE_NOT_FOUND', 'That leave request does not exist'))
      }

      // You may submit your own; HR may submit on someone's behalf.
      const allowed = authorizeOwned(input.actor, 'leave_request', 'update', request.employeeId)
      if (!allowed.ok) return allowed

      request.submit()
      const saved = await this.uow.repos.requests.save(request)
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

/**
 * Withdraw a request.
 *
 * Only drafts can be deleted. Once a request has been submitted it is part of
 * the record — an approved one especially, since it is the counterpart of an
 * allocation deduction. Removing it would leave `taken` pointing at nothing.
 */
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
