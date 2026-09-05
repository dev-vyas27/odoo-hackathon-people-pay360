/**
 * GetAttendanceUseCase — fetch one record. An `employee` may fetch only
 * their own; every other role may fetch any record.
 */
import { authorizeOwned, DomainError, Err, Ok, type Actor, type Result } from '@/modules/shared'
import type { Attendance } from '../domain/attendance'
import type { AttendanceRepositoryPort } from './ports/attendance-repository.port'

export interface GetAttendanceInput {
  actor: Actor
  attendanceId: string
}

export class GetAttendanceUseCase {
  constructor(private readonly repo: AttendanceRepositoryPort) {}

  async execute(input: GetAttendanceInput): Promise<Result<Attendance>> {
    const existing = await this.repo.findById(input.attendanceId)
    if (!existing) {
      return Err(DomainError.notFound('ATTENDANCE_NOT_FOUND', 'Attendance record not found'))
    }

    const authz = authorizeOwned(input.actor, 'attendance', 'read', existing.employeeId)
    if (!authz.ok) return authz

    return Ok(existing)
  }
}
