


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
import type { EmployeeLookupPort } from './ports/employee-lookup.port'
import type { ScheduleQueryPort } from './ports/schedule-lookup.port'
import type { UnitOfWorkPort } from './ports/unit-of-work.port'

export interface RequestLeaveInput {
  actor: Actor
  employeeId: string
  timeOffTypeId: string
  start: Date
  end: Date
  
  duration?: number
  reason?: string | null
  
  asDraft?: boolean
}

export class RequestLeaveUseCase implements UseCase<RequestLeaveInput, LeaveRequestView> {
  constructor(
    private readonly uow: UnitOfWorkPort,
    private readonly events: IEventBus,
    private readonly employees: EmployeeLookupPort,
    private readonly schedules: ScheduleQueryPort,
  ) {}

  


  private async workingDaysIn(employeeId: string, period: Period): Promise<number | undefined> {
    const employee = await this.employees.findById(employeeId)
    const scheduleId = employee?.workingScheduleId
    if (!scheduleId) return undefined

    
    const schedule = await this.schedules.findById(scheduleId)
    if (!schedule) return undefined

    return this.schedules.expectedDays(scheduleId, period)
  }

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
      const duration = LeaveRequest.defaultDuration(
        period,
        type.unit,
        input.duration,
        await this.workingDaysIn(input.employeeId, period),
      )

      const candidate = LeaveRequest.from({
        
        
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
