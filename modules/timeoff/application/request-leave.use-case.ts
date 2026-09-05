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
 */
import {
  DomainError,
  Err,
  Ok,
  Period,
  authorizeOwned,
  type Actor,
  type Result,
  type UseCase,
} from '@/modules/shared'
import { LeaveRequest, type LeaveRequestView } from '../domain/leave-request'
import { assertNoOverlap, selectAllocation } from '../domain/balance.service'
import type {
  AllocationRepositoryPort,
  LeaveRequestRepositoryPort,
  TimeOffTypeRepositoryPort,
} from './ports/repositories.port'

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
    private readonly requests: LeaveRequestRepositoryPort,
    private readonly allocations: AllocationRepositoryPort,
    private readonly types: TimeOffTypeRepositoryPort,
  ) {}

  async execute(input: RequestLeaveInput): Promise<Result<LeaveRequestView>> {
    const allowed = authorizeOwned(input.actor, 'leave_request', 'create', input.employeeId)
    if (!allowed.ok) return allowed

    const type = await this.types.findById(input.timeOffTypeId)
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

      assertNoOverlap(candidate, await this.requests.findForEmployee(input.employeeId))

      if (type.requiresAllocation) {
        // Throws with the shortfall in the message when it cannot be funded.
        selectAllocation(await this.allocations.findForEmployee(input.employeeId, type.id), {
          employeeId: input.employeeId,
          timeOffTypeId: type.id,
          period,
          duration,
        })
      }

      if (!input.asDraft) candidate.submit()

      // Built field by field rather than spreading `toProps()`: the aggregate
      // carries a sentinel id that must not reach the database.
      const saved = await this.requests.create({
        employeeId: input.employeeId,
        timeOffTypeId: type.id,
        period,
        unit: type.unit,
        duration,
        reason: input.reason ?? null,
        status: candidate.status,
      })

      return Ok(saved.toView())
    } catch (reason) {
      if (DomainError.is(reason)) return Err(reason)
      throw reason
    }
  }
}
