import { describe, expect, it } from 'vitest'
import type { Actor } from '@/modules/shared'
import { CheckInUseCase } from './check-in.use-case'
import { DeleteAttendanceUseCase } from './delete-attendance.use-case'
import { InMemoryAttendanceRepository } from './test-support/in-memory-attendance.repository'
import { FakeScheduleLookup } from './test-support/fake-schedule-lookup'

function employeeActor(): Actor {
  return { employeeId: 'emp-1', role: 'employee', email: 'e@x.com', name: 'Employee' }
}

function hrActor(): Actor {
  return { employeeId: 'emp-actor', role: 'hr_manager', email: 'hr@x.com', name: 'HR' }
}

describe('DeleteAttendanceUseCase', () => {
  it('forbids an employee from deleting attendance', async () => {
    const repo = new InMemoryAttendanceRepository()
    const useCase = new DeleteAttendanceUseCase(repo)
    const result = await useCase.execute({ actor: employeeActor(), attendanceId: 'whatever' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('forbidden')
  })

  it('lets hr_manager delete an existing record', async () => {
    const repo = new InMemoryAttendanceRepository()
    const checkIn = await new CheckInUseCase(repo, new FakeScheduleLookup()).execute({
      actor: hrActor(),
      employeeId: 'emp-1',
      checkIn: new Date('2026-03-10T09:00:00Z'),
    })
    if (!checkIn.ok) throw new Error('setup failed')

    const useCase = new DeleteAttendanceUseCase(repo)
    const result = await useCase.execute({ actor: hrActor(), attendanceId: checkIn.value.attendance.id })
    expect(result.ok).toBe(true)

    const gone = await repo.findById(checkIn.value.attendance.id)
    expect(gone).toBeNull()
  })
})
