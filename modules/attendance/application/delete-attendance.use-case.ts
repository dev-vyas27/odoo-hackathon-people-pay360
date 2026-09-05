/**
 * DeleteAttendanceUseCase — authorized users only (`attendance:delete`,
 * granted to hr_manager and above, never to `employee`).
 */
import { authorize, DomainError, Err, Ok, type Actor, type Result } from '@/modules/shared'
import type { AttendanceRepositoryPort } from './ports/attendance-repository.port'

export interface DeleteAttendanceInput {
  actor: Actor
  attendanceId: string
}

export class DeleteAttendanceUseCase {
  constructor(private readonly repo: AttendanceRepositoryPort) {}

  async execute(input: DeleteAttendanceInput): Promise<Result<true>> {
    const authz = authorize(input.actor, 'attendance', 'delete')
    if (!authz.ok) return authz

    const existing = await this.repo.findById(input.attendanceId)
    if (!existing) {
      return Err(DomainError.notFound('ATTENDANCE_NOT_FOUND', 'Attendance record not found'))
    }

    await this.repo.deleteById(input.attendanceId)
    return Ok(true)
  }
}
