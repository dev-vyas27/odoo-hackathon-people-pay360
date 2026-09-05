import { describe, expect, it } from 'vitest'
import type { Actor } from '@/modules/shared'
import { CheckInUseCase } from './check-in.use-case'
import { GetAttendanceUseCase } from './get-attendance.use-case'
import { InMemoryAttendanceRepository } from './test-support/in-memory-attendance.repository'
import { FakeScheduleLookup } from './test-support/fake-schedule-lookup'

function employeeActor(employeeId: string): Actor {
  return { userId: 'u1', employeeId, role: 'employee', email: 'e@x.com', name: 'Employee' }
}

function hrActor(): Actor {
  return { userId: 'u2', employeeId: null, role: 'hr_manager', email: 'hr@x.com', name: 'HR' }
}

describe('GetAttendanceUseCase', () => {
  it('lets an employee read their own record', async () => {
    const repo = new InMemoryAttendanceRepository()
    const checkIn = await new CheckInUseCase(repo, new FakeScheduleLookup()).execute({
      actor: hrActor(),
      employeeId: 'emp-1',
      checkIn: new Date('2026-03-10T09:00:00Z'),
    })
    if (!checkIn.ok) throw new Error('setup failed')

    const useCase = new GetAttendanceUseCase(repo)
    const result = await useCase.execute({ actor: employeeActor('emp-1'), attendanceId: checkIn.value.attendance.id })
    expect(result.ok).toBe(true)
  })

  it('forbids an employee from reading someone else\'s record', async () => {
    const repo = new InMemoryAttendanceRepository()
    const checkIn = await new CheckInUseCase(repo, new FakeScheduleLookup()).execute({
      actor: hrActor(),
      employeeId: 'emp-1',
      checkIn: new Date('2026-03-10T09:00:00Z'),
    })
    if (!checkIn.ok) throw new Error('setup failed')

    const useCase = new GetAttendanceUseCase(repo)
    const result = await useCase.execute({ actor: employeeActor('emp-2'), attendanceId: checkIn.value.attendance.id })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('forbidden')
  })
})
