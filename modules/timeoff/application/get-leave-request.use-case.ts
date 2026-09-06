/**
 * One request, with everything the Request Form needs to render itself.
 *
 * Spec B4: "Request Form details the request and supports a simple approval or
 * refusal workflow."
 *
 * `canApprove` / `canRefuse` are computed HERE rather than in the component,
 * for the same reason the nav is filtered server-side: the screen and the API
 * must not be able to disagree about what is allowed. The buttons the form
 * renders are exactly the transitions the use cases will accept.
 *
 * The balance snapshot travels with the request so an approver can see what
 * they are spending before they spend it, without a second round trip.
 */
import {
  DomainError,
  Err,
  Ok,
  actorCan,
  authorizeOwned,
  startOfDay,
  type Actor,
  type LeaveBalanceView,
  type Result,
  type UseCase,
} from '@/modules/shared'
import type { LeaveRequestView } from '../domain/leave-request'
import { buildBalances } from '../domain/balance.service'
import type { UnitOfWorkPort } from './ports/unit-of-work.port'
import type { EmployeeLookupPort } from './ports/employee-lookup.port'

export interface LeaveRequestDetail extends LeaveRequestView {
  employeeName: string
  timeOffTypeName: string
  requiresAllocation: boolean
  isPaid: boolean
  /** The employee's balance for this leave type, as of today. */
  balance: LeaveBalanceView | null
  canSubmit: boolean
  canApprove: boolean
  canRefuse: boolean
  canEdit: boolean
}

export interface GetLeaveRequestInput {
  actor: Actor
  requestId: string
}

export class GetLeaveRequestUseCase
  implements UseCase<GetLeaveRequestInput, LeaveRequestDetail>
{
  constructor(
    private readonly uow: UnitOfWorkPort,
    private readonly employees: EmployeeLookupPort,
  ) {}

  async execute(input: GetLeaveRequestInput): Promise<Result<LeaveRequestDetail>> {
    const { requests, allocations, types } = this.uow.repos

    const request = await requests.findById(input.requestId)
    if (!request) {
      return Err(DomainError.notFound('LEAVE_NOT_FOUND', 'That leave request does not exist'))
    }

    // Row-level: an employee may open their own request and nobody else's.
    const allowed = authorizeOwned(input.actor, 'leave_request', 'read', request.employeeId)
    if (!allowed.ok) return allowed

    const type = await types.findById(request.timeOffTypeId)
    if (!type) {
      return Err(DomainError.notFound('TIME_OFF_TYPE_NOT_FOUND', 'That leave type does not exist'))
    }

    const [employee, employeeAllocations, employeeRequests] = await Promise.all([
      this.employees.findById(request.employeeId),
      allocations.findForEmployee(request.employeeId, type.id),
      requests.findForEmployee(request.employeeId, type.id),
    ])

    const [balance] = type.requiresAllocation
      ? buildBalances([type], employeeAllocations, employeeRequests, startOfDay(new Date()))
      : []

    /**
     * An approver may not decide on their own request — the same rule the
     * approve/refuse use cases enforce. Reflecting it here means the button is
     * simply not rendered, rather than rendered and then rejected.
     */
    const isOwnRequest =
      input.actor.employeeId !== null && input.actor.employeeId === request.employeeId
    const mayDecide = actorCan(input.actor, 'leave_request', 'approve') && !isOwnRequest

    return Ok({
      ...request.toView(),
      employeeName: employee?.name ?? 'Unknown employee',
      timeOffTypeName: type.name,
      requiresAllocation: type.requiresAllocation,
      isPaid: type.isPaid,
      balance: balance ?? null,
      canSubmit: request.status === 'draft',
      canApprove: mayDecide && request.status === 'to_approve',
      // Refusing an approved request is how an approval is undone, so it stays
      // available after approval — see leave-request-state.ts.
      canRefuse: mayDecide && (request.status === 'to_approve' || request.status === 'approved'),
      canEdit: request.isEditable,
    })
  }
}
