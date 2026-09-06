


import { authorize, DomainError, Err, Ok, type Actor, type Result } from '@/modules/shared'
import type { Attendance } from '../domain/attendance'
import type { AttendanceRepositoryPort } from './ports/attendance-repository.port'
import type { ScheduleLookupPort } from './ports/schedule-lookup.port'
import type { AttendanceStatus } from '../domain/exception'

export interface CorrectAttendanceInput {
  actor: Actor
  attendanceId: string
  checkIn?: Date
  checkOut?: Date | null
  breakMinutes?: number
}

export interface CorrectAttendanceOutput {
  attendance: Attendance
  status: AttendanceStatus
}

export class CorrectAttendanceUseCase {
  constructor(
    private readonly repo: AttendanceRepositoryPort,
    private readonly schedules: ScheduleLookupPort,
  ) {}

  async execute(input: CorrectAttendanceInput): Promise<Result<CorrectAttendanceOutput>> {
    const authz = authorize(input.actor, 'attendance', 'update')
    if (!authz.ok) return authz

    const record = await this.repo.findById(input.attendanceId)
    const existing = record?.attendance ?? null
    if (!existing) {
      return Err(DomainError.notFound('ATTENDANCE_NOT_FOUND', 'Attendance record not found'))
    }

    const corrected = existing.correct({
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      breakMinutes: input.breakMinutes,
    })
    if (!corrected.ok) return corrected

    const schedule = await this.schedules.scheduleForDay(corrected.value.employeeId, corrected.value.checkIn)
    const status = corrected.value.status(schedule)
    const saved = await this.repo.save(corrected.value, status)

    return Ok({ attendance: saved, status })
  }
}
