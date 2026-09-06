


import {
  authorizeOwned,
  DomainError,
  Err,
  istDay,
  Ok,
  type Actor,
  type Result,
} from '@/modules/shared'
import { Attendance } from '../domain/attendance'
import type { WorkMode } from '../domain/work-mode'
import type { AttendanceRepositoryPort } from './ports/attendance-repository.port'
import type { ScheduleLookupPort } from './ports/schedule-lookup.port'
import type { AttendanceStatus } from '../domain/exception'

export interface CheckInInput {
  actor: Actor
  employeeId: string
  checkIn?: Date
  breakMinutes?: number
  
  workMode?: WorkMode | null
}

export interface CheckInOutput {
  attendance: Attendance
  status: AttendanceStatus
}

export class CheckInUseCase {
  constructor(
    private readonly repo: AttendanceRepositoryPort,
    private readonly schedules: ScheduleLookupPort,
  ) {}

  async execute(input: CheckInInput): Promise<Result<CheckInOutput>> {
    const authz = authorizeOwned(input.actor, 'attendance', 'create', input.employeeId)
    if (!authz.ok) return authz

    const checkIn = input.checkIn ?? new Date()
    const today = new Date(`${istDay(checkIn)}T00:00:00.000Z`)

    


    await this.repo.closeStaleOpenShifts(today)

    const existing = await this.repo.findForEmployeeOnDay(input.employeeId, today)

    


    if (existing && existing.attendance.isOpen) {
      return Err(
        DomainError.conflict(
          'ALREADY_CHECKED_IN',
          'You are already checked in. Check out before checking in again.',
        ),
      )
    }

    


    const next = existing
      ? existing.attendance.resume(checkIn, input.workMode ?? null)
      : Attendance.checkIn({
          employeeId: input.employeeId,
          checkIn,
          breakMinutes: input.breakMinutes,
          workMode: input.workMode ?? null,
        })
    if (!next.ok) return next

    const schedule = await this.schedules.scheduleForDay(input.employeeId, checkIn)
    const status = next.value.status(schedule)
    const saved = await this.repo.save(next.value, status)

    return Ok({ attendance: saved, status })
  }
}
