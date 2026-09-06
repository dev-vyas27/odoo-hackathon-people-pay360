import { describe, expect, it } from 'vitest'
import type { Actor } from '@/modules/shared'
import { CheckInUseCase } from './check-in.use-case'
import { CorrectAttendanceUseCase } from './correct-attendance.use-case'
import { InMemoryAttendanceRepository } from './test-support/in-memory-attendance.repository'
import { FakeScheduleLookup } from './test-support/fake-schedule-lookup'

function employeeActor(): Actor {
  return { employeeId: 'emp-1', role: 'employee', email: 'e@x.com', name: 'Employee' }
}

function hrActor(): Actor {
  return { employeeId: 'emp-actor', role: 'hr_manager', email: 'hr@x.com', name: 'HR' }
}

describe('CorrectAttendanceUseCase', () => {
  async function checkedIn(repo: InMemoryAttendanceRepository) {
    const checkInUseCase = new CheckInUseCase(repo, new FakeScheduleLookup())
    const result = await checkInUseCase.execute({
      actor: employeeActor(),
      employeeId: 'emp-1',
      checkIn: new Date('2026-03-10T09:00:00Z'),
    })
    if (!result.ok) throw new Error('setup failed')
    return result.value.attendance.id
  }

  it('forbids an employee from correcting their own record', async () => {
    const repo = new InMemoryAttendanceRepository()
    const id = await checkedIn(repo)

    const useCase = new CorrectAttendanceUseCase(repo, new FakeScheduleLookup())
    const result = await useCase.execute({
      actor: employeeActor(),
      attendanceId: id,
      checkOut: new Date('2026-03-10T17:00:00Z'),
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('forbidden')
  })

  it('lets an hr_manager correct a record and flags it manual', async () => {
    const repo = new InMemoryAttendanceRepository()
    const id = await checkedIn(repo)

    const useCase = new CorrectAttendanceUseCase(repo, new FakeScheduleLookup())
    const result = await useCase.execute({
      actor: hrActor(),
      attendanceId: id,
      checkOut: new Date('2026-03-10T17:00:00Z'),
      breakMinutes: 30,
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.attendance.manual).toBe(true)
      expect(result.value.status).toBe('manual')
    }
  })

  it('returns not_found for an unknown record', async () => {
    const repo = new InMemoryAttendanceRepository()
    const useCase = new CorrectAttendanceUseCase(repo, new FakeScheduleLookup())

    const result = await useCase.execute({ actor: hrActor(), attendanceId: 'missing' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('not_found')
  })
})
