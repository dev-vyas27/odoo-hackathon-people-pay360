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
import type { EmployeeLookupPort } from './ports/employee-lookup.port'
import type { ScheduleQueryPort } from './ports/schedule-lookup.port'
import type { UnitOfWorkPort } from './ports/unit-of-work.port'

export interface UpdateLeaveInput {
  actor: Actor
  requestId: string
  timeOffTypeId?: string
  start?: Date
  end?: Date
  duration?: number
  reason?: string | null
}

export class UpdateLeaveUseCase implements UseCase<UpdateLeaveInput, LeaveRequestView> {
  constructor(
    private readonly uow: UnitOfWorkPort,
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

  async execute(input: UpdateLeaveInput): Promise<Result<LeaveRequestView>> {
    try {
      const existing = await this.uow.repos.requests.findById(input.requestId)
      if (!existing) {
        return Err(DomainError.notFound('LEAVE_NOT_FOUND', 'That leave request does not exist'))
      }

      const allowed = authorizeOwned(input.actor, 'leave_request', 'update', existing.employeeId)
      if (!allowed.ok) return allowed

      const saved = await this.uow.transaction(async (repos) => {
        const request = await repos.requests.findByIdForUpdate(input.requestId)
        if (!request) {
          throw DomainError.notFound('LEAVE_NOT_FOUND', 'That leave request does not exist')
        }

        const type = await repos.types.findById(input.timeOffTypeId ?? request.timeOffTypeId)
        if (!type) {
          throw DomainError.notFound('TIME_OFF_TYPE_NOT_FOUND', 'That leave type does not exist')
        }
        if (!type.isActive) {
          throw DomainError.rule('TIME_OFF_TYPE_INACTIVE', `${type.name} is no longer available`)
        }

        const period =
          input.start || input.end
            ? Period.of(input.start ?? request.period.start, input.end ?? request.period.end)
            : request.period

        const reshaped =
          Boolean(input.start || input.end) ||
          (input.timeOffTypeId !== undefined && input.timeOffTypeId !== request.timeOffTypeId)

        const duration =
          input.duration !== undefined || reshaped
            ? LeaveRequest.defaultDuration(
                period,
                type.unit,
                input.duration,
                await this.workingDaysIn(request.employeeId, period),
              )
            : request.duration

        request.amend({
          timeOffTypeId: type.id,
          period,
          unit: type.unit,
          duration,
          reason: input.reason,
        })

        assertNoOverlap(request, await repos.requests.findForEmployee(request.employeeId))

        if (type.requiresAllocation) {
          selectAllocation(await repos.allocations.findForEmployee(request.employeeId, type.id), {
            employeeId: request.employeeId,
            timeOffTypeId: type.id,
            period,
            duration,
          })
        }

        return repos.requests.save(request)
      })

      return Ok(saved.toView())
    } catch (reason) {
      if (DomainError.is(reason)) return Err(reason)
      throw reason
    }
  }
}
