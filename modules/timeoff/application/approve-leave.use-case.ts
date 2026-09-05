/**
 * Approve a leave request AND deduct the allocation. One transaction.
 *
 * This is the rule the whole module exists to protect, and the spec states it
 * twice: "Approved leave requests automatically deduct from assigned
 * allocations" (A4) and "Approved requests automatically reduce balances for
 * leave types requiring allocation" (B4).
 *
 * Three things make it hold:
 *
 *   1. Approval and deduction are ONE use case. If they lived apart — a
 *      controller, an event handler, a UI callback — they would eventually
 *      diverge and the system would show approved leave nobody paid for.
 *   2. They are ONE transaction. Either both writes land or neither does.
 *   3. Both rows are read FOR UPDATE, so two approvers clicking at once are
 *      serialised rather than both reading the same "before" balance.
 *
 * Order matters: the allocation is consumed FIRST. `consume()` throws when the
 * balance is short, so the request is never marked approved against a balance
 * that could not fund it.
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
import { selectAllocation } from '../domain/balance.service'
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

        /**
         * Nobody approves their own leave. The permission table cannot express
         * this: it is about the relationship between the actor and the row, not
         * about the role.
         */
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

        let allocationId: string | null = null

        if (type.requiresAllocation) {
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
          allocationId = allocation.id
        }

        request.approve(input.actor.userId, allocationId)
        return repos.requests.save(request)
      })

      /**
       * Published AFTER the commit, deliberately. A subscriber that reads the
       * request back must not see a row that is still uncommitted, and a
       * subscriber that throws must not be able to roll back an approval that
       * has already been granted.
       */
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
