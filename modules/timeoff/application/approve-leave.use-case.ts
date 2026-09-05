/**
 * Approve a leave request AND deduct the allocation. One use case, on purpose.
 *
 * This is the rule the whole module exists to protect: approving a request whose
 * type `requiresAllocation` draws down the matching allocation, and FAILS when
 * the balance is insufficient. If approval lived in one place and the deduction
 * in another — a controller, an event handler, a UI callback — they would
 * eventually diverge and the system would show approved leave that nobody paid
 * for. Keeping them in a single transaction script makes divergence impossible.
 *
 * Order matters: the allocation is consumed FIRST. Consuming throws when the
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
import type {
  AllocationRepositoryPort,
  LeaveRequestRepositoryPort,
  TimeOffTypeRepositoryPort,
} from './ports/repositories.port'

export interface ApproveLeaveInput {
  actor: Actor
  requestId: string
}

export class ApproveLeaveUseCase implements UseCase<ApproveLeaveInput, LeaveRequestView> {
  constructor(
    private readonly requests: LeaveRequestRepositoryPort,
    private readonly allocations: AllocationRepositoryPort,
    private readonly types: TimeOffTypeRepositoryPort,
    private readonly events: IEventBus,
  ) {}

  async execute(input: ApproveLeaveInput): Promise<Result<LeaveRequestView>> {
    const allowed = authorize(input.actor, 'leave_request', 'approve')
    if (!allowed.ok) return allowed

    const request = await this.requests.findById(input.requestId)
    if (!request) {
      return Err(DomainError.notFound('LEAVE_NOT_FOUND', 'That leave request does not exist'))
    }

    // Nobody approves their own leave. The permission table cannot express this
    // because it is about the relationship between actor and row, not the role.
    if (input.actor.employeeId && input.actor.employeeId === request.employeeId) {
      return Err(
        DomainError.forbidden(
          'LEAVE_SELF_APPROVAL',
          'You cannot approve your own leave request',
        ),
      )
    }

    const type = await this.types.findById(request.timeOffTypeId)
    if (!type) {
      return Err(DomainError.notFound('TIME_OFF_TYPE_NOT_FOUND', 'That leave type does not exist'))
    }

    try {
      let allocationId: string | null = null

      if (type.requiresAllocation) {
        const allocation = selectAllocation(
          await this.allocations.findForEmployee(request.employeeId, type.id),
          {
            employeeId: request.employeeId,
            timeOffTypeId: type.id,
            period: request.period,
            duration: request.duration,
          },
        )

        // Throws on insufficient balance — before the request is touched.
        allocation.consume(request.duration)
        await this.allocations.save(allocation)
        allocationId = allocation.id
      }

      request.approve(input.actor.userId, allocationId)
      const saved = await this.requests.save(request)

      /**
       * Fire and forget. Payroll and analytics react to this; none of them may
       * roll back the approval, which is why the bus swallows handler errors.
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
      if (reason instanceof DomainError) return Err(reason)
      throw reason
    }
  }
}
