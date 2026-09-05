/**
 * CheckInUseCase — an employee (or an HR user on their behalf) starts an
 * attendance record for the day.
 *
 * Authorization: check-in is the employee's own self-service action, so it is
 * authorized as `attendance:create` (row-scoped to the employee's own id),
 * the same permission the spec grants an `employee` role. Correcting a
 * record afterwards is a different action (`update`) and is deliberately not
 * reachable from here — see correct-attendance.use-case.ts.
 */
import { authorizeOwned, DomainError, Err, Ok, type Actor, type Result } from '@/modules/shared'
import { Attendance } from '../domain/attendance'
import type { AttendanceRepositoryPort } from './ports/attendance-repository.port'
import type { ScheduleLookupPort } from './ports/schedule-lookup.port'
import type { AttendanceStatus } from '../domain/exception'

export interface CheckInInput {
  actor: Actor
  employeeId: string
  checkIn?: Date
  breakMinutes?: number
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

    const open = await this.repo.findOpenForEmployee(input.employeeId)
    if (open) {
      return Err(
        DomainError.conflict(
          'ALREADY_CHECKED_IN',
          'This employee already has an open attendance record for a previous check-in',
        ),
      )
    }

    const checkIn = input.checkIn ?? new Date()
    const created = Attendance.checkIn({
      employeeId: input.employeeId,
      checkIn,
      breakMinutes: input.breakMinutes,
    })
    if (!created.ok) return created

    const schedule = await this.schedules.scheduleForDay(input.employeeId, checkIn)
    const status = created.value.status(schedule)
    const saved = await this.repo.save(created.value, status)

    return Ok({ attendance: saved, status })
  }
}
