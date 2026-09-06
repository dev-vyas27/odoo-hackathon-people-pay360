/**
 * Raise a leave request.
 *
 * An employee may request leave for themselves; HR may request on anyone's
 * behalf. That distinction is `authorizeOwned`, not an `if` in a controller.
 *
 * The balance is checked here as a courtesy — a request that obviously cannot be
 * funded is refused at entry rather than wasting an approver's time — but the
 * authoritative check happens again at approval, because the balance can change
 * in between. Checking twice is not redundancy; the two checks answer different
 * questions at different moments.
 *
 * When the type auto-approves and the request is submitted (not saved as a
 * draft), "approval" is one of those two checks happening for real: the same
 * `consumeAllocationForApproval` helper `approve-leave` uses runs inside the
 * SAME transaction that creates the row, so the request is never persisted in
 * an approved state that has not actually consumed its allocation. If the
 * authoritative consume fails — balance moved between the courtesy check and
 * now — the whole transaction rolls back and no request is created at all,
 * the same fail-fast posture this use case already takes for an unfundable
 * draft.
 */
import {
  DomainError,
  Err,
  Ok,
  Period,
  authorizeOwned,
  type Actor,
  type IEventBus,
  type Result,
  type UseCase,
} from '@/modules/shared'
import { LeaveRequest, type LeaveRequestView } from '../domain/leave-request'
import { assertNoOverlap, selectAllocation } from '../domain/balance.service'
import { consumeAllocationForApproval } from './approval.service'
import type { UnitOfWorkPort } from './ports/unit-of-work.port'

export interface RequestLeaveInput {
  actor: Actor
  employeeId: string
  timeOffTypeId: string
  start: Date
  end: Date
  /** Omit for whole-day leave; required for hour-unit types. */
  duration?: number
  reason?: string | null
  /** Save as a draft instead of sending straight for approval. */
  asDraft?: boolean
}

export class RequestLeaveUseCase implements UseCase<RequestLeaveInput, LeaveRequestView> {
  constructor(
    private readonly uow: UnitOfWorkPort,
    private readonly events: IEventBus,
  ) {}

  async execute(input: RequestLeaveInput): Promise<Result<LeaveRequestView>> {
    const allowed = authorizeOwned(input.actor, 'leave_request', 'create', input.employeeId)
    if (!allowed.ok) return allowed

    const { types, allocations, requests } = this.uow.repos

    const type = await types.findById(input.timeOffTypeId)
    if (!type) {
      return Err(DomainError.notFound('TIME_OFF_TYPE_NOT_FOUND', 'That leave type does not exist'))
    }
    if (!type.isActive) {
      return Err(
        DomainError.rule('TIME_OFF_TYPE_INACTIVE', `${type.name} is no longer available`),
      )
    }

    try {
      const period = Period.of(input.start, input.end)
      const duration = LeaveRequest.defaultDuration(period, type.unit, input.duration)

      const candidate = LeaveRequest.from({
        // The repository assigns the real id; overlap detection only needs this
        // one to differ from every persisted id, which a sentinel guarantees.
        id: 'new',
        employeeId: input.employeeId,
        timeOffTypeId: type.id,
        period,
        unit: type.unit,
        duration,
        reason: input.reason ?? null,
        status: 'draft',
      })

      assertNoOverlap(candidate, await requests.findForEmployee(input.employeeId))

      if (type.requiresAllocation) {
        // Throws with the shortfall in the message when it cannot be funded.
        selectAllocation(await allocations.findForEmployee(input.employeeId, type.id), {
          employeeId: input.employeeId,
          timeOffTypeId: type.id,
          period,
          duration,
        })
      }

      if (!input.asDraft) candidate.submit()

      const willAutoApprove = !input.asDraft && type.autoApprove

      const saved = await this.uow.transaction(async (repos) => {
        // Built field by field rather than spreading `toProps()`: the aggregate
        // carries a sentinel id that must not reach the database.
        const created = await repos.requests.create({
          employeeId: input.employeeId,
          timeOffTypeId: type.id,
          period,
          unit: type.unit,
          duration,
          reason: input.reason ?? null,
          status: candidate.status,
        })

        if (!willAutoApprove) return created

        // `null`: the policy decided, not a person — see LeaveRequest.approve.
        const allocationId = await consumeAllocationForApproval(repos, type, created)
        created.approve(null, allocationId)
        return repos.requests.save(created)
      })

      if (willAutoApprove) {
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
