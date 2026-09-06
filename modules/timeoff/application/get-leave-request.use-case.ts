


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
  
  autoApprove: boolean
  isPaid: boolean
  
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

    


    const isOwnRequest =
      input.actor.employeeId !== null && input.actor.employeeId === request.employeeId
    const mayDecide = actorCan(input.actor, 'leave_request', 'approve') && !isOwnRequest

    return Ok({
      ...request.toView(),
      employeeName: employee?.name ?? 'Unknown employee',
      timeOffTypeName: type.name,
      requiresAllocation: type.requiresAllocation,
      autoApprove: type.autoApprove,
      isPaid: type.isPaid,
      balance: balance ?? null,
      canSubmit: request.status === 'draft',
      canApprove: mayDecide && request.status === 'to_approve',
      
      
      canRefuse: mayDecide && (request.status === 'to_approve' || request.status === 'approved'),
      canEdit: request.isEditable,
    })
  }
}
