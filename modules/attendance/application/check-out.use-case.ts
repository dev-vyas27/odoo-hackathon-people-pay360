/**
 * CheckOutUseCase — completes an open attendance record.
 *
 * Same authorization story as check-in: this is the employee finishing their
 * own day, not a correction, so it is scoped as `attendance:create` against
 * the record's owning employee. An HR/manual edit after the fact goes through
 * correct-attendance.use-case.ts instead, which requires `attendance:update`.
 */
import { authorizeOwned, DomainError, Err, Ok, type Actor, type Result } from '@/modules/shared'
import type { Attendance } from '../domain/attendance'
import type { AttendanceRepositoryPort } from './ports/attendance-repository.port'
import type { ScheduleLookupPort } from './ports/schedule-lookup.port'
import type { AttendanceStatus } from '../domain/exception'

export interface CheckOutInput {
  actor: Actor
  attendanceId: string
  checkOut?: Date
  breakMinutes?: number
}

export interface CheckOutOutput {
  attendance: Attendance
  status: AttendanceStatus
}

export class CheckOutUseCase {
  constructor(
    private readonly repo: AttendanceRepositoryPort,
    private readonly schedules: ScheduleLookupPort,
  ) {}

  async execute(input: CheckOutInput): Promise<Result<CheckOutOutput>> {
    const record = await this.repo.findById(input.attendanceId)
    const existing = record?.attendance ?? null
    if (!existing) {
      return Err(DomainError.notFound('ATTENDANCE_NOT_FOUND', 'Attendance record not found'))
    }

    const authz = authorizeOwned(input.actor, 'attendance', 'create', existing.employeeId)
    if (!authz.ok) return authz

    const updated = existing.recordCheckOut(input.checkOut ?? new Date(), input.breakMinutes)
    if (!updated.ok) return updated

    const schedule = await this.schedules.scheduleForDay(existing.employeeId, existing.checkIn)
    const status = updated.value.status(schedule)
    const saved = await this.repo.save(updated.value, status)

    return Ok({ attendance: saved, status })
  }
}
